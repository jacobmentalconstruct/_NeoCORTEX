import os
import sys
import struct
import re
import time
import json
from typing import List, Dict, Any
from sentence_transformers import SentenceTransformer
from database import get_db_connection

# --- Configuration ---
CHUNK_SIZE = 500  # Characters per thought bubble (hunk)
OVERLAP = 50      # Context overlap between bubbles

# ==========================================
#        GLOBAL STATE (For UI Monitoring)
# ==========================================

ingestion_status = {
    "is_running": False,
    "current_file": "",
    "progress_percent": 0,
    "total_files": 0,
    "processed_files": 0,
    "log": [] 
}

# NEW: The Inspector Buffer for the "Thought Bubble" Pane
# The frontend will poll this to animate the bubbles appearing
inspection_buffer: List[Dict[str, Any]] = []

def update_status(file_name: str, processed: int, total: int, log_msg: str = None):
    ingestion_status["is_running"] = True
    ingestion_status["current_file"] = file_name
    ingestion_status["processed_files"] = processed
    ingestion_status["total_files"] = total
    if total > 0:
        ingestion_status["progress_percent"] = int((processed / total) * 100)
    
    if log_msg:
        # Timestamp for the log
        timestamp = time.strftime("%H:%M:%S", time.localtime())
        ingestion_status["log"].append(f"[{timestamp}] {log_msg}")
        if len(ingestion_status["log"]) > 50:
            ingestion_status["log"].pop(0)

def push_inspection_frame(file_name: str, chunk_index: int, content: str, embedding_preview: List[float]):
    """Pushes a 'Thought Bubble' frame to the UI with a semantic color."""
    
    # Generate a "Concept Color" from the first 3 dimensions of the vector
    # We normalize the float (-1.0 to 1.0) to 0-255 for RGB
    r = int((embedding_preview[0] + 1) * 127.5)
    g = int((embedding_preview[1] + 1) * 127.5)
    b = int((embedding_preview[2] + 1) * 127.5)
    
    # Clamp values just in case
    r, g, b = [max(0, min(255, x)) for x in (r, g, b)]
    hex_color = "#{:02x}{:02x}{:02x}".format(r, g, b)

    frame = {
        "id": f"{file_name}_{chunk_index}",
        "file": file_name,
        "chunk_index": chunk_index,
        "content": content,
        "vector_preview": embedding_preview[:5], 
        "concept_color": hex_color, # <--- NEW: CSS-ready color
        "timestamp": time.time()
    }
    
    inspection_buffer.append(frame)
    if len(inspection_buffer) > 20: 
        inspection_buffer.pop(0)

def finish_status(msg: str):
    ingestion_status["is_running"] = False
    ingestion_status["progress_percent"] = 100
    update_status("", ingestion_status["processed_files"], ingestion_status["total_files"], msg)

# ==========================================
#        LOGIC CORE
# ==========================================

class Chunker:
    """Splits code into digestible 'Thought Bubbles'."""
    def chunk_text(self, text: str) -> List[str]:
        # Simple sliding window for now. 
        # Future upgrade: AST-based chunking for Python/JS.
        chunks = []
        start = 0
        text_len = len(text)
        
        while start < text_len:
            end = start + CHUNK_SIZE
            chunk = text[start:end]
            chunks.append(chunk)
            start += CHUNK_SIZE - OVERLAP
            
        return chunks

class SynapseWeaver:
    def __init__(self):
        self.py_pattern = re.compile(r'^\s*(?:from|import)\s+([\w\.]+)')
        self.js_pattern = re.compile(r'(?:import\s+.*?from\s+[\'"]|require\([\'"])([\.\/\w\-_]+)[\'"]')

    def extract_dependencies(self, content: str, file_type: str) -> List[str]:
        dependencies = []
        lines = content.split('\n')
        for line in lines:
            match = None
            if file_type == 'python':
                match = self.py_pattern.match(line)
            elif file_type in ['js', 'ts', 'tsx']:
                match = self.js_pattern.search(line)
            
            if match:
                raw_dep = match.group(1)
                clean_dep = raw_dep.split('.')[-1].split('/')[-1]
                if clean_dep not in dependencies:
                    dependencies.append(clean_dep)
        return dependencies

class IngestionEngine:
    def __init__(self):
        print("⚡ Loading Embedding Model...")
        try:
            self.model = SentenceTransformer('all-MiniLM-L6-v2')
            print("✔ Model Loaded.")
        except Exception as e:
            print(f"❌ Model Load Failed: {e}")
            self.model = None

    def ingest_from_manifest(self, db_name: str, root_path: str, files: List[str], llm_model: str = "none"):
        print(f"⚡ Starting Ingestion for DB: {db_name}")
        
        if self.model is None:
            update_status("Error", 0, 0, "❌ Logic Core Failed: Embedding Model not loaded.")
            return

        conn = get_db_connection(db_name)
        cursor = conn.cursor()
        weaver = SynapseWeaver()
        chunker = Chunker()

        total_files = len(files)
        # Clear inspection buffer at start
        inspection_buffer.clear()
        
        processed_count = 0

        # Store Agent Config
        cursor.execute("INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)", 
                      ('preferred_agent_model', llm_model))

        filename_to_id = {}

        for index, rel_path in enumerate(files):
            full_path = os.path.join(root_path, rel_path)
            file_name = os.path.basename(full_path)
            
            update_status(file_name, index + 1, total_files, f"Reading {file_name}...")

            try:
                with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read().strip()
                
                if not content:
                    update_status(file_name, index + 1, total_files, f"Skipped empty file: {file_name}")
                    continue

                # --- 1. Create File Node (Prong II: Graph) ---
                cursor.execute(
                    "INSERT INTO nodes (label, type, properties) VALUES (?, ?, ?) RETURNING id", 
                    (file_name, 'file', json.dumps({"path": rel_path}))
                )
                file_node_id = cursor.fetchone()[0]
                filename_to_id[file_name] = file_node_id

                # --- 2. Chunking & Vectorization (Prong I & III) ---
                chunks = chunker.chunk_text(content)
                
                for i, chunk in enumerate(chunks):
                    # Embed
                    vec = self.model.encode(chunk)
                    vec_bytes = struct.pack(f'{len(vec)}f', *vec)
                    
                    # Store Chunk (Lexical)
                    cursor.execute("INSERT INTO knowledge_chunks (content, file_path, source_type) VALUES (?, ?, 'code') RETURNING id", 
                                  (chunk, rel_path))
                    chunk_id = cursor.fetchone()[0]

                    # Store FTS (Search)
                    cursor.execute("INSERT INTO documents_fts (rowid, content, file_path) VALUES (?, ?, ?)", 
                                  (chunk_id, chunk, rel_path))

                    # Store Vector (Semantic)
                    cursor.execute("INSERT INTO knowledge_vectors (rowid, embedding, chunk_id) VALUES (?, ?, ?)", 
                                  (chunk_id, vec_bytes, chunk_id))
                    
                    # Link Chunk to File Node
                    # (Optional: You could make chunks nodes too, but for now let's keep graph simple)

                    # LIVE INSPECTION UPDATE
                    # Send this hunk to the "Thought Bubble" pane
                    push_inspection_frame(file_name, i, chunk, vec.tolist())

                processed_count += 1

            except Exception as e:
                # This catches the specific error causing "0 files processed"
                update_status(file_name, index + 1, total_files, f"❌ Err {file_name}: {str(e)}")
                print(f"CRITICAL ERROR on {file_name}: {e}")

        # --- PHASE 3: WEAVE EDGES ---
        update_status("Graph Weaver", total_files, total_files, "Weaving Dependencies...")
        
        # (This logic remains largely the same, utilizing the file content for imports)
        # Note: Ideally we weave based on chunks, but weaving file-to-file is okay for prototype.
        
        conn.commit()
        conn.close()
        finish_status(f"Ingestion Complete. {processed_count} files processed.")
        print("✅ Ingestion Complete")

engine = IngestionEngine()
import sys
import os
import struct
import networkx as nx
import urllib.request # Added for Ollama connectivity
import json
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

# Import our local modules
sys.path.append(os.path.dirname(__file__))
from database import get_db_connection, init_db, KB_DIR
from ingest import engine, ingestion_status, inspection_buffer
from scanner import ProjectScanner

app = FastAPI(title="Cortex API - Multi-Project")

# Enable CORS for React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models ---

class KBRequest(BaseModel):
    name: str

class ScanRequest(BaseModel):
    path: str
    type: str = "folder" # 'folder' | 'file' | 'web'

class IngestRequest(BaseModel):
    db_name: str
    root_path: str
    files: List[str]     # The specific manifest of files to ingest
    llm_model: Optional[str] = "none"

# ==========================================
#        KNOWLEDGE BASE MANAGER
# ==========================================

@app.get("/kb/list")
def list_knowledge_bases():
    """Lists all available SQLite databases in the data directory."""
    if not os.path.exists(KB_DIR):
        return {"databases": []}
    
    dbs = [f for f in os.listdir(KB_DIR) if f.endswith(".db")]
    return {"databases": dbs}

@app.post("/kb/create")
def create_knowledge_base(req: KBRequest):
    """Initializes a new empty Knowledge Base."""
    try:
        init_db(req.name)
        return {"status": "success", "message": f"Created {req.name}.db"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
#        OLLAMA INTEGRATION (NEW)
# ==========================================

@app.get("/llm/models")
def get_ollama_models():
    """
    Connects to local Ollama instance (default port 11434) 
    and retrieves the list of available models.
    """
    ollama_url = "http://localhost:11434/api/tags"
    try:
        with urllib.request.urlopen(ollama_url) as response:
            if response.status == 200:
                data = json.loads(response.read().decode())
                # Extract model names from Ollama response
                models = [m['name'] for m in data.get('models', [])]
                return {"status": "online", "models": models}
            else:
                return {"status": "error", "models": [], "detail": "Ollama returned non-200 status"}
    except Exception as e:
        # If connection fails, assume Ollama is not running
        return {"status": "offline", "models": [], "detail": str(e)}

# ==========================================
#        STAGING & INGESTION
# ==========================================

@app.post("/stage/scan")
def scan_source(req: ScanRequest):
    """
    Scans a target path and returns a file tree.
    Does NOT ingest yet. Just maps the territory.
    """
    if req.type == "folder":
        scanner = ProjectScanner(req.path)
        tree = scanner.scan()
        if "error" in tree:
            raise HTTPException(status_code=400, detail=tree["error"])
        return {"tree": tree}
    
    return {"status": "error", "message": "Type not supported yet"}

@app.post("/ingest/execute")
def execute_ingest(req: IngestRequest, background_tasks: BackgroundTasks):
    """
    Starts the heavy lifting in the background.
    """
    if ingestion_status["is_running"]:
        raise HTTPException(status_code=409, detail="Ingestion already in progress")
    
    # Pass the job to the background
    background_tasks.add_task(
        engine.ingest_from_manifest, 
        req.db_name, 
        req.root_path, 
        req.files, 
        req.llm_model
    )
    return {"status": "started", "message": "Ingestion started in background"}

@app.get("/ingest/status")
def get_ingest_status():
    """
    Polled by UI to show progress bar.
    """
    return ingestion_status

# ==========================================
#        QUERY & SEARCH (Dynamic DB)
# ==========================================

@app.get("/search")
def hybrid_search(q: str, db_name: str, limit: int = 10):
    """
    Performs Hybrid Search on a SPECIFIC database.
    """
    try:
        conn = get_db_connection(db_name)
    except Exception as e:
        raise HTTPException(status_code=404, detail="Database not found")
        
    cursor = conn.cursor()

    # 1. Generate Query Vector
    query_vector = engine.model.encode(q)
    query_bytes = struct.pack(f'{len(query_vector)}f', *query_vector)

    # 2. Execute RRF Query (Vector + FTS)
    sql = """
    WITH 
    vec_results AS (
        SELECT rowid, distance,
        row_number() OVER (ORDER BY distance) as rank
        FROM knowledge_vectors
        WHERE embedding MATCH ?
        AND k = 50
    ),
    fts_results AS (
        SELECT rowid, rank as fts_rank,
        row_number() OVER (ORDER BY rank) as rank
        FROM documents_fts
        WHERE documents_fts MATCH ?
        LIMIT 50
    )
    SELECT 
        kc.id,
        kc.file_path,
        kc.content,
        (
            COALESCE(1.0 / (60 + v.rank), 0.0) +
            COALESCE(1.0 / (60 + f.rank), 0.0)
        ) as rrf_score
    FROM knowledge_chunks kc
    LEFT JOIN vec_results v ON kc.id = v.rowid
    LEFT JOIN fts_results f ON kc.id = f.rowid
    WHERE v.rowid IS NOT NULL OR f.rowid IS NOT NULL
    ORDER BY rrf_score DESC
    LIMIT ?;
    """
    
    # Escape quotes for FTS
    fts_query = f'"{q.replace('"', '""')}"'
    
    results = []
    try:
        rows = cursor.execute(sql, (query_bytes, fts_query, limit)).fetchall()
        for r in rows:
            results.append({
                "id": r[0],
                "path": r[1],
                "content_snippet": r[2][:200] + "...", 
                "score": round(r[3], 4)
            })
    except Exception as e:
        print(f"Search Error: {e}")
        pass

    return {"results": results}

@app.get("/graph")
def get_graph_data(db_name: str):
    """
    Visualizes the dependency graph for a SPECIFIC database.
    """
    try:
        conn = get_db_connection(db_name)
    except Exception:
        raise HTTPException(status_code=404, detail="Database not found")
        
    cursor = conn.cursor()
    
    db_nodes = cursor.execute("SELECT id, label, type FROM nodes").fetchall()
    
    # Optimization: Don't fetch all content, just paths
    chunk_rows = cursor.execute("SELECT file_path FROM knowledge_chunks").fetchall()
    
    db_edges = cursor.execute("SELECT source_id, target_id FROM edges").fetchall()
    
    G = nx.DiGraph()
    for n in db_nodes:
        G.add_node(n[0], label=n[1], type=n[2])
        
    for e in db_edges:
        G.add_edge(e[0], e[1])
        
    try:
        pos = nx.spring_layout(G, k=0.5, iterations=50)
    except:
        pos = {n[0]: (0,0) for n in db_nodes}
    
    formatted_nodes = []
    for node_id, coords in pos.items():
        attrs = G.nodes[node_id]
        formatted_nodes.append({
            "id": str(node_id),
            "label": attrs['label'],
            "type": attrs['type'],
            "x": coords[0] * 1000, # Scale up for UI
            "y": coords[1] * 1000
        })

    formatted_links = [{"source": str(e[0]), "target": str(e[1])} for e in db_edges]

    return {"nodes": formatted_nodes, "links": formatted_links}

@app.get("/ingest/inspection")
def get_inspection_frame():
    """
    Returns the latest processing artifacts for the visualization pane.
    The frontend should poll this every ~200ms.
    """
    if not inspection_buffer:
        return {"frames": []}
    
    # Return all current frames and clear buffer to prevent sending duplicates
    # (Or keep them if you want the frontend to manage deduping)
    frames = list(inspection_buffer)
    inspection_buffer.clear() 
    return {"frames": frames}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
# database.py
import os
import sqlite3
import sqlite_vec

# --- Configuration ---
# Stores all user Knowledge Bases in a 'data' subfolder
KB_DIR = os.path.join(os.path.dirname(__file__), "../data")
os.makedirs(KB_DIR, exist_ok=True)

# Blueprint Section 6.2: 30GB mmap limit
MMAP_SIZE = 30 * 1024 * 1024 * 1024 

def get_db_path(db_name: str) -> str:
    """Sanitizes and resolves the database filename."""
    clean_name = os.path.basename(db_name)
    if not clean_name.endswith(".db"):
        clean_name += ".db"
    return os.path.join(KB_DIR, clean_name)

def get_db_connection(db_name: str):
    """
    Establishes a connection to a SPECIFIC Knowledge Base.
    """
    db_path = get_db_path(db_name)
    conn = sqlite3.connect(db_path)
    conn.enable_load_extension(True)

    try:
        sqlite_vec.load(conn)
    except Exception as e:
        print(f"⚠ Warning: Could not load sqlite-vec extension: {e}")

    # Mechanical Sympathy Optimizations
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute(f"PRAGMA mmap_size = {MMAP_SIZE};")
    conn.execute("PRAGMA foreign_keys = ON;")
    
    return conn

def init_db(db_name: str):
    """
    Initializes the schema for a NEW Knowledge Base.
    """
    # FIX: Resolve path here for the print statement
    db_path = get_db_path(db_name)
    conn = get_db_connection(db_name)
    cursor = conn.cursor()

    print(f"Initializing Cortex Database at {os.path.abspath(db_path)}...")

    # --- PRONG II: STRUCTURAL ENGINE (Graph) ---
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        properties JSON,
        type TEXT DEFAULT 'concept',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Edges Table (WITHOUT ROWID Optimization)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS edges (
        source_id INTEGER,
        target_id INTEGER,
        relationship_type TEXT,
        weight REAL DEFAULT 1.0,
        PRIMARY KEY (source_id, target_id, relationship_type),
        FOREIGN KEY (source_id) REFERENCES nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (target_id) REFERENCES nodes(id) ON DELETE CASCADE
    ) WITHOUT ROWID;
    """)

    # --- PRONG III Base: RELATIONAL CHUNKS (Shadow Table) ---
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT,
        file_path TEXT,
        source_type TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # --- PRONG III: LEXICAL ENGINE (Full-Text Search) ---
    cursor.execute("""
    CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
        content,
        file_path,
        tokenize='porter'
    );
    """)

    # --- PRONG I: SEMANTIC ENGINE (Vector Search) ---
    try:
        cursor.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_vectors USING vec0(
            embedding float[384],          
            +chunk_id INTEGER,             -- Link to knowledge_chunks
            +document_type TEXT            -- Partition key candidate
        );
        """)
        print("✔ Semantic Engine (vec0) initialized.")
    except sqlite3.OperationalError as e:
        print("❌ Failed to initialize Vector Table. Ensure sqlite-vec is installed and loaded. Error:", e)

    # --- SYSTEM CONFIG (For LLM Preferences) ---
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS system_config (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()
    print(f"✔ Knowledge Base '{db_name}' initialized.")

if __name__ == "__main__":
    # FIX: Provide a default name for testing
    init_db("default_test")
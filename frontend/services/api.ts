import { KnowledgeBase, TreeResponse, IngestStatus, SearchResult, GraphData, InspectionFrame } from '../types';

const API_BASE = 'http://localhost:8000';

export const api = {
  // Knowledge Bases
  listKBs: async (): Promise<{ databases: string[] }> => {
    const res = await fetch(`${API_BASE}/kb/list`);
    return res.json();
  },

  createKB: async (name: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/kb/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Failed to create DB');
    return res.json();
  },

  // Scanning & Ingest
  scanPath: async (path: string): Promise<TreeResponse> => {
    const res = await fetch(`${API_BASE}/stage/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, type: 'folder' }),
    });
    if (!res.ok) throw new Error('Scan failed');
    return res.json();
  },

  executeIngest: async (dbName: string, rootPath: string, files: string[], llmModel: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/ingest/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        db_name: dbName,
        root_path: rootPath,
        files: files,
        llm_model: llmModel
      }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Ingest failed');
    }
    return res.json();
  },

  getIngestStatus: async (): Promise<IngestStatus> => {
    const res = await fetch(`${API_BASE}/ingest/status`);
    return res.json();
  },

  getInspectionFrames: async (): Promise<{ frames: InspectionFrame[] }> => {
    // The backend should drain the buffer when this is called to prevent duplicates
    const res = await fetch(`${API_BASE}/ingest/inspection`);
    if (!res.ok) return { frames: [] };
    return res.json();
  },

  // Explorer
  search: async (q: string, dbName: string): Promise<{ results: SearchResult[] }> => {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}&db_name=${encodeURIComponent(dbName)}`);
    return res.json();
  },

  // Graph
  getGraph: async (dbName: string): Promise<GraphData> => {
    const res = await fetch(`${API_BASE}/graph?db_name=${encodeURIComponent(dbName)}`);
    if (!res.ok) throw new Error('Failed to fetch graph data');
    return res.json();
  }
};
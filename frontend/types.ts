export interface KnowledgeBase {
  name: string;
}

export interface FileNode {
  name: string;
  path: string; // Absolute path
  rel_path: string; // Display path
  type: 'folder' | 'file' | 'binary';
  checked: boolean;
  children?: FileNode[];
  error?: string;
}

export interface IngestStatus {
  is_running: boolean;
  current_file: string;
  progress_percent: number;
  processed_files: number;
  total_files: number;
  log: string[];
}

export interface SearchResult {
  id: number;
  path: string;
  content_snippet: string;
  score: number;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface TreeResponse {
  tree: FileNode;
  error?: string;
}

export interface InspectionFrame {
  file_path: string;
  line_number: number;
  content_snippet: string;
  vector_preview: number[]; // Array of floats (e.g., first 5 dims)
  imports: string[];
  timestamp?: string;
}
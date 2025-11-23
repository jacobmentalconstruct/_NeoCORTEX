import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FolderSearch, Play, Server, Loader2, ChevronUp, ChevronDown, Terminal, Layout, Columns } from 'lucide-react';
import { api } from '../services/api';
import { FileTree } from './FileTree';
import { ThoughtStream } from './ThoughtStream';
import { FileNode, IngestStatus } from '../types';

interface IngestViewProps {
  activeDB: string | null;
}

// Helper to clone tree and toggle checked status
const updateNodeChecked = (root: FileNode, targetPath: string, newChecked: boolean): FileNode => {
  if (root.path === targetPath) {
    const updateRecursive = (n: FileNode, checked: boolean): FileNode => ({
      ...n,
      checked,
      children: n.children ? n.children.map(c => updateRecursive(c, checked)) : undefined
    });
    return updateRecursive(root, newChecked);
  }

  if (root.children) {
    return {
      ...root,
      children: root.children.map(child => updateNodeChecked(child, targetPath, newChecked))
    };
  }

  return root;
};

// Helper to extract all checked relative paths
const extractCheckedFiles = (node: FileNode): string[] => {
  let files: string[] = [];
  if (node.type === 'file' && node.checked) {
    files.push(node.rel_path);
  }
  if (node.children) {
    node.children.forEach(child => {
      files = files.concat(extractCheckedFiles(child));
    });
  }
  return files;
};

export const IngestView: React.FC<IngestViewProps> = ({ activeDB }) => {
  const [targetPath, setTargetPath] = useState("");
  const [sourceType, setSourceType] = useState("folder");
  const [tree, setTree] = useState<FileNode | null>(null);
  const [loadingScan, setLoadingScan] = useState(false);
  const [llmModel, setLlmModel] = useState("none");
  const [status, setStatus] = useState<IngestStatus>({
    is_running: false,
    current_file: "",
    progress_percent: 0,
    processed_files: 0,
    total_files: 0,
    log: []
  });
  const [isConsoleExpanded, setIsConsoleExpanded] = useState(false);
  const [showInspector, setShowInspector] = useState(true); // Toggle for the right pane

  const logEndRef = useRef<HTMLDivElement>(null);

  // Polling Effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const poll = async () => {
      try {
        const s = await api.getIngestStatus();
        setStatus(s);
        // Auto-expand if error occurs or running
        if (s.is_running && !isConsoleExpanded) {
             // We keep console small if inspector is open to avoid clutter
             // setIsConsoleExpanded(true); 
        }
      } catch (e) {
        console.error("Polling failed", e);
      }
    };

    // Initial poll
    poll();
    
    interval = setInterval(poll, 1000);

    return () => clearInterval(interval);
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (isConsoleExpanded) {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [status.log, isConsoleExpanded]);

  const handleScan = async () => {
    const path = targetPath.trim() || "."; // Default to current directory if empty
    setLoadingScan(true);
    try {
      const res = await api.scanPath(path);
      if (res.tree) {
        setTree(res.tree);
      }
    } catch (e) {
      alert('Scan failed: ' + e);
    } finally {
      setLoadingScan(false);
    }
  };

  const handleToggleCheck = (node: FileNode, isChecked: boolean) => {
    if (tree) {
      setTree(updateNodeChecked(tree, node.path, isChecked));
    }
  };

  const handleStartIngest = async () => {
    if (!activeDB) {
      alert("Please select a Knowledge Base first!");
      return;
    }
    if (!tree) return;

    const files = extractCheckedFiles(tree);
    if (files.length === 0) {
      return;
    }

    try {
      const path = targetPath.trim() || ".";
      await api.executeIngest(activeDB, path, files, llmModel);
      setShowInspector(true); // Auto open inspector on start
    } catch (e: any) {
      alert("Ingest Error: " + e.message);
    }
  };

  const selectedFilesCount = useMemo(() => {
      return tree ? extractCheckedFiles(tree).length : 0;
  }, [tree]);

  const isStartDisabled = !tree || selectedFilesCount === 0 || status.is_running || !activeDB;

  return (
    <div className="flex flex-col h-full relative">
      {/* TOP: Staging Controls */}
      <div className="h-auto min-h-[80px] p-4 border-b border-gray-800 flex items-end gap-4 bg-[#1e1e2f]">
        <div className="flex-grow">
          <label className="block text-xs font-mono text-[#007ACC] mb-1">TARGET ROOT PATH</label>
          <div className="relative">
            <input 
              type="text"
              value={targetPath}
              onChange={(e) => setTargetPath(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 text-gray-200 text-sm px-3 py-2 rounded focus:border-[#007ACC] outline-none font-mono placeholder-gray-600"
              placeholder="Absolute path (e.g. C:\Projects\MyCode) or leave empty for '.'"
            />
          </div>
          <p className="text-[10px] text-gray-500 mt-1 font-mono">
            Leave empty to scan current directory of backend.
          </p>
        </div>
        <div className="w-40">
          <label className="block text-xs font-mono text-gray-500 mb-1">SOURCE TYPE</label>
          <select 
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 text-gray-200 text-sm px-3 py-2 rounded focus:border-[#007ACC] outline-none"
          >
            <option value="folder">Folder</option>
            <option value="file">File</option>
            <option value="web">Web (TODO)</option>
          </select>
        </div>
        <button 
          onClick={handleScan}
          disabled={loadingScan}
          className="h-[38px] px-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 rounded flex items-center gap-2 transition-colors mb-[2px]"
        >
          {loadingScan ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderSearch className="w-4 h-4" />}
          SCAN
        </button>

        {/* Toggle Inspector */}
        <button 
          onClick={() => setShowInspector(!showInspector)}
          title="Toggle Inspector Pane"
          className={`h-[38px] w-[38px] flex items-center justify-center rounded border transition-colors mb-[2px]
            ${showInspector ? 'bg-[#007ACC]/20 border-[#007ACC] text-[#007ACC]' : 'bg-gray-800 border-gray-600 text-gray-400'}
          `}
        >
            <Columns className="w-4 h-4" />
        </button>
      </div>

      {/* MIDDLE: Split View (Tree | Inspector) */}
      <div className="flex-grow flex overflow-hidden bg-[#13131f] pb-32 relative">
        
        {/* Left: File Tree */}
        <div className="flex-grow overflow-y-auto p-4">
            {!tree && !loadingScan && (
            <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                <Server className="w-16 h-16 mb-4 stroke-[1]" />
                <p className="font-mono text-sm">Enter path and scan to view files.</p>
            </div>
            )}
            {tree && (
            <FileTree node={tree} onToggleCheck={handleToggleCheck} />
            )}
        </div>

        {/* Right: Thought Stream */}
        {showInspector && (
            <ThoughtStream isRunning={status.is_running} />
        )}
      </div>

      {/* FLOATING EXECUTION BAR */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col">
        
        {/* Action Bar */}
        <div className="bg-[#1e1e2f] border-t border-gray-800 p-4 shadow-[0_-5px_20px_rgba(0,0,0,0.5)] flex items-center justify-between relative z-20">
             <div className="flex items-center gap-6">
                <div>
                    <label className="block text-xs font-mono text-gray-500 mb-1">LLM MODEL</label>
                    <select 
                    value={llmModel}
                    onChange={(e) => setLlmModel(e.target.value)}
                    className="w-40 bg-gray-900 border border-gray-700 text-gray-200 text-sm px-2 py-1 rounded outline-none"
                    >
                    <option value="none">None (Embed Only)</option>
                    <option value="llama3">Llama 3 (Local)</option>
                    <option value="mistral">Mistral (Local)</option>
                    </select>
                </div>
                
                <div className="h-full flex flex-col justify-center">
                    <span className="text-xs font-mono text-gray-500 block mb-1">SELECTION</span>
                    <span className={`text-sm font-mono font-bold ${selectedFilesCount > 0 ? 'text-[#007ACC]' : 'text-gray-600'}`}>
                        {selectedFilesCount} FILES
                    </span>
                </div>
             </div>

            <button 
            onClick={handleStartIngest}
            disabled={isStartDisabled}
            title={isStartDisabled ? "Scan a folder and select files to begin" : "Start Ingestion"}
            className={`
                px-6 py-2 rounded font-bold flex items-center gap-2 transition-all
                ${isStartDisabled 
                ? 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700' 
                : 'bg-[#007ACC] hover:bg-[#0063a6] text-white shadow-[0_0_15px_rgba(0,122,204,0.4)] hover:shadow-[0_0_20px_rgba(0,122,204,0.6)]'}
            `}
            >
            {status.is_running ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            {status.is_running ? 'PROCESSING...' : 'START INGESTION'}
            </button>
        </div>

        {/* Collapsible Console */}
        <div 
            className={`bg-black border-t border-gray-800 transition-all duration-300 ease-in-out flex flex-col ${isConsoleExpanded ? 'h-64' : 'h-8'}`}
        >
            {/* Console Header (Always Visible) */}
            <div 
                onClick={() => setIsConsoleExpanded(!isConsoleExpanded)}
                className="h-8 min-h-[32px] bg-[#0f0f15] hover:bg-[#1a1a25] cursor-pointer flex items-center justify-between px-4 border-b border-gray-800"
            >
                <div className="flex items-center gap-3 text-xs font-mono">
                    <Terminal className="w-3 h-3 text-gray-500" />
                    <span className={status.is_running ? "text-green-400" : "text-gray-500"}>
                        STATUS: {status.is_running ? "RUNNING" : "IDLE"}
                    </span>
                    <span className="text-gray-600">|</span>
                    <span className="text-gray-400">
                        {status.processed_files} / {status.total_files} PROCESSED
                    </span>
                </div>
                
                <div className="flex items-center gap-2">
                    {/* Mini Progress Bar in Header when collapsed */}
                    {!isConsoleExpanded && status.total_files > 0 && (
                         <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500" style={{ width: `${status.progress_percent}%` }}></div>
                         </div>
                    )}
                    {isConsoleExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronUp className="w-4 h-4 text-gray-500" />}
                </div>
            </div>

            {/* Console Body */}
            <div className="flex-grow overflow-hidden flex flex-col bg-black p-2 relative">
                {/* Full Progress Bar */}
                <div className="w-full h-1 bg-gray-900 mb-2 shrink-0">
                     <div 
                        className="h-full bg-[#007ACC] shadow-[0_0_10px_#007ACC]"
                        style={{ width: `${status.progress_percent}%` }}
                     />
                </div>

                {/* Logs */}
                <div className="flex-grow overflow-y-auto font-mono text-xs space-y-1 pb-2">
                    {status.log.length === 0 && (
                        <div className="text-gray-700 italic p-2">System Ready. Logs will appear here...</div>
                    )}
                    {status.log.map((line, i) => (
                        <div key={i} className="break-all text-green-500 border-l-2 border-green-900 pl-2">
                            <span className="text-gray-600 mr-2">[{new Date().toLocaleTimeString()}]</span>
                            {line}
                        </div>
                    ))}
                    <div ref={logEndRef} />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
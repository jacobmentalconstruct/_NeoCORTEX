import React, { useState } from 'react';
import { Search, FileText, X } from 'lucide-react';
import { api } from '../services/api';
import { SearchResult } from '../types';

interface ExplorerViewProps {
  activeDB: string | null;
}

export const ExplorerView: React.FC<ExplorerViewProps> = ({ activeDB }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SearchResult | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDB) {
      alert("Select a Knowledge Base first");
      return;
    }
    if (!query.trim()) return;

    setLoading(true);
    try {
      const res = await api.search(query, activeDB);
      setResults(res.results);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-6">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-6 h-6" />
          <input 
            type="text" 
            placeholder="Hybrid Search Query (Vector + FTS)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-[#13131f] border border-gray-700 text-gray-100 text-lg pl-14 pr-4 py-4 rounded-lg focus:border-[#007ACC] focus:ring-1 focus:ring-[#007ACC] outline-none transition-all placeholder-gray-600"
          />
          <button 
            type="submit"
            disabled={loading}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#007ACC] text-white px-4 py-2 rounded hover:bg-[#0063a6] transition-colors"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {/* Results Table */}
      <div className="flex-grow overflow-hidden flex flex-col bg-[#1e1e2f] border border-gray-800 rounded-lg">
        <div className="flex items-center bg-gray-900/50 p-3 border-b border-gray-800 text-xs font-bold text-gray-500 tracking-wider">
          <div className="w-[10%] text-right pr-4">SCORE</div>
          <div className="w-[30%] pl-2">PATH</div>
          <div className="w-[60%]">CONTENT SNIPPET</div>
        </div>
        
        <div className="overflow-y-auto flex-grow">
          {results.length === 0 && !loading && (
            <div className="p-8 text-center text-gray-600 italic">No results found. Try a different query.</div>
          )}
          
          {results.map((res) => (
            <div 
              key={res.id}
              onClick={() => setSelectedFile(res)}
              className="flex items-center border-b border-gray-800/50 hover:bg-[#2d2d44] cursor-pointer group transition-colors py-3 px-3"
            >
              <div className="w-[10%] text-right pr-4 font-mono text-[#007ACC] group-hover:text-white">
                {res.score.toFixed(4)}
              </div>
              <div className="w-[30%] pl-2 text-sm text-gray-400 truncate font-mono" title={res.path}>
                {res.path}
              </div>
              <div className="w-[60%] text-sm text-gray-300 line-clamp-2 pl-2 border-l border-gray-700/50">
                {res.content_snippet}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* File Detail Modal */}
      {selectedFile && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-10">
          <div className="bg-[#1e1e2f] border border-gray-700 rounded-lg w-full max-w-4xl h-full max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900 rounded-t-lg">
              <div className="flex items-center gap-3">
                <FileText className="text-[#007ACC]" />
                <h2 className="text-gray-200 font-mono text-sm">{selectedFile.path}</h2>
              </div>
              <button onClick={() => setSelectedFile(null)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-grow overflow-auto p-4 bg-[#13131f]">
              <pre className="font-mono text-sm text-gray-300 whitespace-pre-wrap">
                {selectedFile.content_snippet} 
                {/* Note: In a real app, we would fetch full content here using ID. Snippet is placeholder. */}
                {'\n\n... [End of Snippet] ...'}
              </pre>
            </div>
            <div className="p-3 border-t border-gray-700 bg-gray-900 text-right">
              <button 
                onClick={() => setSelectedFile(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
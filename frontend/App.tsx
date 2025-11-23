import React, { useState } from 'react';
import { Upload, Telescope, Share2, Database } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { IngestView } from './components/IngestView';
import { ExplorerView } from './components/ExplorerView';
import { GraphView } from './components/GraphView';

const App: React.FC = () => {
  const [activeDB, setActiveDB] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ingest' | 'explorer' | 'graph'>('ingest');

  return (
    <div className="flex h-screen w-screen bg-[#1e1e2f] text-gray-200 font-sans overflow-hidden">
      {/* LEFT: Sidebar */}
      <Sidebar activeDB={activeDB} setActiveDB={setActiveDB} />

      {/* RIGHT: Main Content */}
      <div className="flex-grow flex flex-col">
        {/* Top Navigation */}
        <div className="h-14 bg-[#1e1e2f] border-b border-gray-800 flex items-center px-4 gap-6 shadow-md z-20">
          
          {/* Active DB Indicator */}
          <div className="mr-6 text-sm font-mono text-gray-500 border-r border-gray-700 pr-6 h-8 flex items-center select-none">
            CTX: <span className={`ml-2 font-bold ${activeDB ? 'text-green-400' : 'text-red-500 animate-pulse'}`}>
              {activeDB ? activeDB.toUpperCase() : "NO_DB_SELECTED"}
            </span>
          </div>

          <button 
            onClick={() => setActiveTab('ingest')}
            disabled={!activeDB}
            className={`flex items-center gap-2 h-full px-2 border-b-2 transition-colors ${
              activeTab === 'ingest' && activeDB 
                ? 'border-[#007ACC] text-white' 
                : 'border-transparent text-gray-500'
            } ${!activeDB ? 'opacity-50 cursor-not-allowed' : 'hover:text-gray-300'}`}
          >
            <Upload className="w-4 h-4" />
            <span className="text-sm font-medium uppercase tracking-wide">Ingest</span>
          </button>

          <button 
            onClick={() => setActiveTab('explorer')}
            disabled={!activeDB}
            className={`flex items-center gap-2 h-full px-2 border-b-2 transition-colors ${
              activeTab === 'explorer' && activeDB
                ? 'border-[#007ACC] text-white' 
                : 'border-transparent text-gray-500'
            } ${!activeDB ? 'opacity-50 cursor-not-allowed' : 'hover:text-gray-300'}`}
          >
            <Telescope className="w-4 h-4" />
            <span className="text-sm font-medium uppercase tracking-wide">Explorer</span>
          </button>

          <button 
            onClick={() => setActiveTab('graph')}
            disabled={!activeDB}
            className={`flex items-center gap-2 h-full px-2 border-b-2 transition-colors ${
              activeTab === 'graph' && activeDB
                ? 'border-[#007ACC] text-white' 
                : 'border-transparent text-gray-500'
            } ${!activeDB ? 'opacity-50 cursor-not-allowed' : 'hover:text-gray-300'}`}
          >
            <Share2 className="w-4 h-4" />
            <span className="text-sm font-medium uppercase tracking-wide">Graph</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-grow overflow-hidden bg-[#171725] relative">
          {!activeDB ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 select-none z-10 bg-[#171725]">
               <div className="p-8 border border-gray-800 rounded-2xl bg-[#1e1e2f] flex flex-col items-center shadow-2xl max-w-md text-center">
                  <Database className="w-16 h-16 mb-4 text-gray-700" />
                  <h2 className="text-xl font-bold text-gray-400 tracking-widest mb-2">SYSTEM LOCKED</h2>
                  <p className="text-sm text-gray-600 mb-4">
                    Knowledge Base connection required.<br/>
                    Select or Initialize a DB from the sidebar.
                  </p>
               </div>
             </div>
          ) : (
            <>
              {activeTab === 'ingest' && <IngestView activeDB={activeDB} />}
              {activeTab === 'explorer' && <ExplorerView activeDB={activeDB} />}
              {activeTab === 'graph' && <GraphView activeDB={activeDB} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
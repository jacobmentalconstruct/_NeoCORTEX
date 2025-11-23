import React, { useEffect, useState, useRef } from 'react';
import { BrainCircuit, Code, Hash, Share2 } from 'lucide-react';
import { api } from '../services/api';
import { InspectionFrame } from '../types';

interface ThoughtStreamProps {
  isRunning: boolean;
}

export const ThoughtStream: React.FC<ThoughtStreamProps> = ({ isRunning }) => {
  const [frames, setFrames] = useState<InspectionFrame[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Polling for Inspection Frames
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(async () => {
      try {
        const data = await api.getInspectionFrames();
        if (data.frames && data.frames.length > 0) {
          setFrames((prev) => [...prev, ...data.frames].slice(-50)); // Keep last 50 to manage memory
        }
      } catch (e) {
        // Silent fail on polling
      }
    }, 800); // Poll slightly faster than the status update

    return () => clearInterval(interval);
  }, [isRunning]);

  // Auto-scroll to bottom of stream
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [frames]);

  return (
    <div className="h-full flex flex-col bg-[#13131f] border-l border-gray-800 w-[400px]">
      <div className="p-3 border-b border-gray-800 bg-[#1e1e2f] flex items-center gap-2">
        <BrainCircuit className={`w-4 h-4 ${isRunning ? 'text-pink-500 animate-pulse' : 'text-gray-600'}`} />
        <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">Neural Inspector</span>
      </div>

      <div 
        ref={scrollRef}
        className="flex-grow overflow-y-auto p-3 space-y-4"
      >
        {frames.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-30 text-gray-500 text-center p-4">
            <BrainCircuit className="w-12 h-12 mb-2" />
            <span className="text-xs font-mono">WAITING FOR NEURAL ACTIVITY...</span>
          </div>
        )}

        {frames.map((frame, idx) => (
          <div key={idx} className="bg-[#1a1a25] border border-gray-700/50 rounded-md p-3 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
            
            {/* Header: File & Line */}
            <div className="flex items-center justify-between mb-2 border-b border-gray-800 pb-2">
              <div className="flex items-center gap-1 text-[10px] font-mono text-[#007ACC] truncate max-w-[200px]" title={frame.file_path}>
                <Hash className="w-3 h-3" />
                {frame.file_path.split('/').pop()}:{frame.line_number}
              </div>
              <div className="text-[9px] text-gray-600 font-mono">
                 CHUNK_ID: {Math.floor(Math.random() * 10000)}
              </div>
            </div>

            {/* Content Snippet */}
            <div className="bg-black/40 rounded p-2 mb-2 border border-gray-800">
              <div className="flex items-start gap-2">
                <Code className="w-3 h-3 text-gray-500 mt-1 shrink-0" />
                <pre className="text-[10px] text-gray-300 font-mono overflow-x-hidden whitespace-pre-wrap break-all line-clamp-4 leading-relaxed">
                  {frame.content_snippet}
                </pre>
              </div>
            </div>

            {/* Vector Preview (Sparkline) */}
            <div className="mb-2">
               <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-gray-500 uppercase">Vector Embedding</span>
               </div>
               <div className="flex items-end gap-[2px] h-4 opacity-80">
                  {frame.vector_preview && frame.vector_preview.map((val, vIdx) => {
                    // Normalize visual height roughly
                    const height = Math.max(20, Math.abs(val) * 100); 
                    const color = val > 0 ? 'bg-green-500' : 'bg-pink-500';
                    return (
                        <div 
                            key={vIdx} 
                            className={`w-1 rounded-t-sm ${color} opacity-70`}
                            style={{ height: `${height}%` }}
                        />
                    )
                  })}
                  {(!frame.vector_preview || frame.vector_preview.length === 0) && (
                      <span className="text-[9px] text-gray-600 italic">No vector data</span>
                  )}
               </div>
            </div>

            {/* Imports/Graph */}
            {frame.imports && frame.imports.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-800/50">
                {frame.imports.map((imp, i) => (
                  <span key={i} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-800 text-[9px] text-purple-400 border border-purple-500/20">
                    <Share2 className="w-2 h-2" />
                    {imp}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
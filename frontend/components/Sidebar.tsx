import React, { useEffect, useState } from 'react';
import { Database, Plus } from 'lucide-react';
import { api } from '../services/api';

interface SidebarProps {
  activeDB: string | null;
  setActiveDB: (db: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeDB, setActiveDB }) => {
  const [dbs, setDbs] = useState<string[]>([]);
  const [newDbName, setNewDbName] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchDbs = async () => {
    try {
      const data = await api.listKBs();
      setDbs(data.databases);
    } catch (e) {
      console.error("Failed to load DBs");
    }
  };

  useEffect(() => {
    fetchDbs();
  }, []);

  const handleCreate = async () => {
    if (!newDbName.trim()) return;
    setLoading(true);
    try {
      await api.createKB(newDbName.trim());
      setNewDbName('');
      await fetchDbs();
    } catch (e) {
      alert('Failed to create DB');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-[250px] bg-[#171725] border-r border-gray-800 flex flex-col h-full">
      <div className="p-4 border-b border-gray-800">
        <h3 className="text-[#007ACC] font-bold text-xl tracking-widest">CORTEX DB</h3>
        <p className="text-xs text-gray-600 mt-1">KNOWLEDGE MANAGER v1.0</p>
      </div>

      <div className="p-4 flex-grow overflow-y-auto">
        <p className="text-xs font-bold text-gray-500 mb-3 tracking-wider">AVAILABLE BASES</p>
        <ul className="space-y-1">
          {dbs.map((db) => (
            <li 
              key={db}
              onClick={() => setActiveDB(db.replace('.db', ''))}
              className={`
                flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors
                ${activeDB === db.replace('.db', '') 
                  ? 'bg-[#007ACC]/20 text-[#007ACC] border border-[#007ACC]/30' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}
              `}
            >
              <Database className="w-4 h-4" />
              <span className="text-sm truncate">{db.replace('.db', '')}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="p-4 border-t border-gray-800 bg-[#13131f]">
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="New DB Name..."
            value={newDbName}
            onChange={(e) => setNewDbName(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-[#007ACC]"
          />
          <button 
            onClick={handleCreate}
            disabled={loading}
            className="bg-[#007ACC] hover:bg-[#0063a6] text-white p-1 rounded flex items-center justify-center w-8 h-8 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
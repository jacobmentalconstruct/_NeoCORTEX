import React, { useState } from 'react';
import { Folder, FileCode, File, Lock, ChevronRight, ChevronDown } from 'lucide-react';
import { FileNode } from '../types';

interface FileTreeProps {
  node: FileNode;
  onToggleCheck: (node: FileNode, isChecked: boolean) => void;
  level?: number;
}

export const FileTree: React.FC<FileTreeProps> = ({ node, onToggleCheck, level = 0 }) => {
  const [isOpen, setIsOpen] = useState(true);

  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    onToggleCheck(node, e.target.checked);
  };

  const toggleOpen = () => {
    if (node.type === 'folder') setIsOpen(!isOpen);
  };

  const getIcon = () => {
    if (node.type === 'binary') return <Lock className="w-4 h-4 text-gray-500" />;
    if (node.type === 'folder') return isOpen ? <Folder className="w-4 h-4 text-[#007ACC]" /> : <Folder className="w-4 h-4 text-gray-400" />;
    if (node.name.endsWith('.ts') || node.name.endsWith('.py') || node.name.endsWith('.js')) return <FileCode className="w-4 h-4 text-yellow-500" />;
    return <File className="w-4 h-4 text-gray-400" />;
  };

  const indentation = level * 20;

  return (
    <div className="select-none">
      <div 
        className={`flex items-center py-1 hover:bg-gray-800/50 ${node.type === 'binary' ? 'opacity-50' : ''}`}
        style={{ paddingLeft: `${indentation}px` }}
      >
        {/* Expander for folders */}
        <div 
          className="w-5 h-5 flex items-center justify-center cursor-pointer mr-1"
          onClick={toggleOpen}
        >
          {node.type === 'folder' && (
            isOpen ? <ChevronDown className="w-3 h-3 text-gray-500" /> : <ChevronRight className="w-3 h-3 text-gray-500" />
          )}
        </div>

        {/* Checkbox */}
        <input
          type="checkbox"
          checked={node.checked}
          onChange={handleToggle}
          className="mr-2 rounded border-gray-600 bg-gray-700 text-[#007ACC] focus:ring-offset-gray-900 focus:ring-[#007ACC]"
        />

        {/* Icon & Name */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={toggleOpen}>
          {getIcon()}
          <span className={`text-sm ${node.checked ? 'text-gray-200' : 'text-gray-500'}`}>
            {node.name}
          </span>
          {node.type === 'binary' && <span className="text-xs text-gray-600 ml-2">[BIN]</span>}
          {!node.checked && node.type === 'folder' && <span className="text-xs text-red-900 ml-2">[EXCLUDED]</span>}
        </div>
      </div>

      {/* Children */}
      {node.type === 'folder' && isOpen && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTree 
              key={child.path} 
              node={child} 
              onToggleCheck={onToggleCheck} 
              level={level + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
};
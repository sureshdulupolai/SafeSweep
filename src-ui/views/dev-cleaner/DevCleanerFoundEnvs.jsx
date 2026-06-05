import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useDevCleanerStore } from '../../store/useDevCleanerStore';
import { formatBytes } from './DevCleanerUtils';

export default function DevCleanerFoundEnvs({ checkedEnvs, handleToggleCheck, totalSpace, handleAnalyze }) {
  const { devCaches, isAnalyzing } = useDevCleanerStore();
  
  return (
    <div className="w-full mt-8 text-left">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2 mb-4">
        {devCaches.map((env, i) => (
          <div 
            key={i} 
            className={`border p-3 rounded flex items-start gap-3 transition-colors ${checkedEnvs.includes(env.path) ? 'bg-brand-darkest border-brand-accent/50' : 'bg-brand-darkest/50 border-brand-border opacity-60'}`}
          >
            <input 
              type="checkbox" 
              className="mt-1 w-4 h-4 rounded border-brand-border bg-brand-dark accent-brand-accent cursor-pointer"
              checked={checkedEnvs.includes(env.path)}
              onChange={() => handleToggleCheck(env.path)}
            />
            <div className="flex flex-col w-full min-w-0">
              <span className="text-xs font-mono text-gray-300 truncate" title={env.path}>{env.path}</span>
              <div className="flex justify-between mt-2 text-[10px] text-gray-500 uppercase tracking-wider">
                <span>{env.name} {env.is_python_env && <span className="text-brand-accent ml-1">(Python Env)</span>}</span>
                <span className="text-brand-accent font-semibold">{formatBytes(env.size)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="flex gap-4 p-4 border-t border-brand-border/40 bg-brand-dark/50 items-center justify-between">
        <span className="text-sm text-gray-400">
          {checkedEnvs.length} environments selected ({formatBytes(totalSpace)} total)
        </span>
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || checkedEnvs.length === 0}
          className="bg-brand-accent hover:bg-brand-accent/90 disabled:opacity-50 px-6 py-2 rounded-lg text-white font-medium flex items-center gap-2 transition-colors"
        >
          {isAnalyzing ? "Processing..." : "Proceed to Deletion"}
          {!isAnalyzing && <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

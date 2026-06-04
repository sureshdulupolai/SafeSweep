import React from 'react';
import { useDevCleanerStore } from '../../store/useDevCleanerStore';
import { Terminal, CheckCircle, XCircle } from 'lucide-react';

export default function TerminalLog() {
  const isInstalling = useDevCleanerStore((state) => state.isInstalling);
  const failedInstalls = useDevCleanerStore((state) => state.failedInstalls);
  const targetPath = useDevCleanerStore((state) => state.targetPath);
  
  if (isInstalling) {
    return (
      <div className="bg-black/60 border border-gray-800 rounded-lg p-5 font-mono">
        <div className="flex items-center gap-2 mb-4">
          <Terminal className="text-gray-400 h-5 w-5" />
          <h3 className="font-bold text-gray-300">Terminal Log</h3>
        </div>
        <div className="space-y-2 text-xs text-gray-400">
          <p className="text-brand-accent animate-pulse">{`> python -m venv ${targetPath || 'target_directory'}`}</p>
          <p className="text-brand-accent animate-pulse">{`> Creating isolated environment...`}</p>
          <p className="text-gray-500 italic">Please wait, this may take a few minutes depending on your internet connection.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-black/60 border border-gray-800 rounded-lg p-5 font-mono">
      <div className="flex items-center gap-2 mb-4">
        <Terminal className="text-gray-400 h-5 w-5" />
        <h3 className="font-bold text-gray-300">Installation Report</h3>
      </div>
      
      <div className="space-y-4 text-xs">
        <div className="flex items-start gap-2">
          <CheckCircle className="h-4 w-4 text-brand-green flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-brand-green font-semibold">Environment Built Successfully</span>
            <p className="text-gray-500 mt-0.5">Location: {targetPath}</p>
          </div>
        </div>
        
        {failedInstalls.length > 0 && (
          <div className="bg-brand-rose/10 border border-brand-rose/20 p-3 rounded mt-4">
            <div className="flex items-start gap-2 text-brand-rose mb-2">
              <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span className="font-semibold">The following packages failed to install:</span>
            </div>
            <ul className="list-disc list-inside text-gray-400 ml-6">
              {failedInstalls.map((pkg, idx) => (
                <li key={idx}>{pkg}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { useDevCleanerStore } from '../../store/useDevCleanerStore';
import { ShieldAlert, Trash2, CheckCircle } from 'lucide-react';

export default function AwsDeleteConfirm({ checkedEnvs = [] }) {
  const [confirmText, setConfirmText] = useState('');
  const deleteOldEnvs = useDevCleanerStore((state) => state.deleteOldEnvs);
  const isDeleting = useDevCleanerStore((state) => state.isDeleting);
  const devCaches = useDevCleanerStore((state) => state.devCaches);
  const resetStore = useDevCleanerStore((state) => state.resetStore);
  
  const selectedPaths = checkedEnvs.length > 0 ? checkedEnvs : devCaches.filter(c => c.is_python_env).map(c => c.path);
  
  const handleConfirm = () => {
    if (confirmText === 'delete') {
      deleteOldEnvs(selectedPaths);
    }
  };
  
  return (
    <div className="bg-brand-dark border border-brand-rose/30 rounded-lg p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-brand-rose" />
      
      <div className="flex items-start gap-4 mb-6">
        <div className="h-12 w-12 rounded-full bg-brand-rose/10 flex items-center justify-center border border-brand-rose/20 flex-shrink-0">
          <ShieldAlert className="h-6 w-6 text-brand-rose" />
        </div>
        <div>
          <h3 className="font-bold text-gray-200 text-lg">Permanent Deletion Required</h3>
          <p className="text-sm text-gray-400 mt-1">
            You are about to permanently delete <strong>{selectedPaths.length}</strong> old developer environments to free up space. This action cannot be undone.
          </p>
        </div>
      </div>
      
      <div className="bg-black/40 border border-gray-800 p-4 rounded text-xs font-mono text-gray-400 mb-6 max-h-32 overflow-y-auto">
        {selectedPaths.map((p, i) => (
          <div key={i} className="mb-1">{p}</div>
        ))}
      </div>
      
      <div className="space-y-3">
        <div className="text-xs text-brand-rose/80 font-medium mb-2">
          ⏳ Note: Deletion may take a few minutes if there are many environments. Processing in parallel...
        </div>
        <label className="text-xs font-semibold text-gray-300">
          To confirm deletion, please type <span className="text-brand-rose font-bold">delete</span> below:
        </label>
        <input 
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="delete"
          className="w-full bg-brand-darkest border border-brand-border text-sm rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-brand-rose transition-colors"
        />
        
        <div className="flex gap-3 mt-4">
          <button
            onClick={resetStore}
            disabled={isDeleting}
            className="flex-1 bg-brand-card hover:bg-brand-card/80 border border-brand-border text-gray-300 font-semibold py-3 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
          >
            Cancel / Keep Environments
          </button>
          
          <button
            onClick={handleConfirm}
            disabled={confirmText !== 'delete' || isDeleting}
            className="flex-1 bg-brand-rose hover:bg-brand-rose/90 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Deleting environments...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                <span>Confirm Deletion</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

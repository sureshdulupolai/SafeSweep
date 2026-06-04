import React, { useState } from 'react';
import { useDevCleanerStore } from '../../store/useDevCleanerStore';
import { ShieldAlert, Trash2, CheckCircle } from 'lucide-react';

export default function AwsDeleteConfirm() {
  const [confirmText, setConfirmText] = useState('');
  const deleteOldEnvs = useDevCleanerStore((state) => state.deleteOldEnvs);
  const isDeleting = useDevCleanerStore((state) => state.isDeleting);
  const devCaches = useDevCleanerStore((state) => state.devCaches);
  
  const selectedPaths = devCaches.filter(c => c.is_python_env).map(c => c.path);
  
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
        
        <button
          onClick={handleConfirm}
          disabled={confirmText !== 'delete' || isDeleting}
          className="w-full bg-brand-rose hover:bg-brand-rose/90 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4"
        >
          {isDeleting ? (
            <span>Deleting environments securely...</span>
          ) : (
            <>
              <Trash2 className="h-4 w-4" />
              <span>Confirm Permanent Deletion</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

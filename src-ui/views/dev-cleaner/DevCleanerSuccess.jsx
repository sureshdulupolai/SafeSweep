import React from 'react';
import { CheckCircle } from 'lucide-react';
import { useDevCleanerStore } from '../../store/useDevCleanerStore';

export default function DevCleanerSuccess() {
  const { deleteResults, resetStore } = useDevCleanerStore();
  
  return (
    <div className="glass-card p-10 border border-brand-green/30 flex flex-col items-center justify-center text-center space-y-4">
      <div className="h-20 w-20 bg-brand-green/10 rounded-full flex items-center justify-center mb-2">
        <CheckCircle className="h-10 w-10 text-brand-green" />
      </div>
      <h2 className="text-2xl font-bold text-gray-200">Consolidation Complete!</h2>
      <p className="text-gray-400 text-sm max-w-md">
        Your new master environment has been created successfully, and {deleteResults.filter(r => r.deleted).length} old scattered environments have been permanently wiped from your disk.
      </p>
      <button 
        onClick={resetStore}
        className="mt-6 bg-brand-card hover:bg-brand-card/80 border border-brand-border px-6 py-2 rounded-lg font-semibold transition-colors"
      >
        Return to Dashboard
      </button>
    </div>
  );
}

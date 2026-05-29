import React, { useEffect, useState } from 'react';
import { ShieldCheck, RotateCcw, AlertTriangle, Clock, Archive } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { motion } from 'framer-motion';

export default function QuarantineView() {
  const fetchQuarantine = useAppStore((state) => state.fetchQuarantine);
  const quarantineItems = useAppStore((state) => state.quarantineItems);
  const restoreQuarantineItem = useAppStore((state) => state.restoreQuarantineItem);

  const [restoringId, setRestoringId] = useState(null);

  useEffect(() => {
    fetchQuarantine();
  }, [fetchQuarantine]);

  const handleRestore = (item) => {
    setRestoringId(item.id);
    try {
      restoreQuarantineItem(item.id);
      
      // Flash successful UI notice and reload list
      setTimeout(() => {
        setRestoringId(null);
        fetchQuarantine();
        alert(`Successfully restored file: '${item.name}'`);
      }, 1000);
    } catch (err) {
      setRestoringId(null);
      alert(err.message);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      className="flex-1 p-6 space-y-6 overflow-y-auto select-text text-sm"
    >
      <div>
        <h2 className="text-xl font-bold tracking-tight text-gray-200">Cleaner Quarantine Board</h2>
        <p className="text-xs text-gray-400 mt-0.5">Safely review and restore isolated assets. Restorations are validated cryptographically against original SHA-256 indexes.</p>
      </div>

      <div className="bg-brand-card/50 border border-brand-border rounded-xl p-4 flex gap-3">
        <Clock className="h-5 w-5 text-brand-accent mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="font-semibold text-xs text-gray-200 uppercase tracking-wider">Automated Purge Clock</h4>
          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
            By default, quarantined files automatically expire and are purged from disk permanently after **24 hours** of retention. 
            All quarantine processes operate fully offline and local to your system.
          </p>
        </div>
      </div>

      {quarantineItems.length === 0 ? (
        <div className="glass-card py-16 flex flex-col items-center justify-center text-gray-500 gap-3 border border-brand-border">
          <Archive className="h-10 w-10 text-gray-600" />
          <span>No isolated files inside Quarantine.</span>
        </div>
      ) : (
        <div className="glass-card overflow-hidden border border-brand-border">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-brand-card border-b border-brand-border text-[10px] text-gray-500 font-semibold uppercase tracking-wider font-sans">
                <th className="px-4 py-3">Original Name</th>
                <th className="px-4 py-3">Original Directory Path</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Quarantine Time</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border text-xs font-mono text-gray-300">
              {quarantineItems.map((item) => (
                <tr key={item.id} className="hover:bg-brand-card/25 transition-colors">
                  <td className="px-4 py-3.5 font-semibold text-gray-200 truncate max-w-[150px]">{item.name}</td>
                  <td className="px-4 py-3.5 text-gray-400 truncate max-w-[250px]" title={item.directory}>{item.directory}</td>
                  <td className="px-4 py-3.5 font-sans">{formatBytes(item.size)}</td>
                  <td className="px-4 py-3.5 font-sans text-gray-400">{item.created_at.replace("T", " ").substring(0, 19)}</td>
                  <td className="px-4 py-3.5 text-right font-sans">
                    <button 
                      onClick={() => handleRestore(item)}
                      disabled={restoringId === item.id}
                      className="inline-flex items-center gap-1 bg-brand-card hover:bg-brand-card/80 border border-brand-border text-brand-accent py-1 px-3 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>{restoringId === item.id ? 'Restoring...' : 'Restore'}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}

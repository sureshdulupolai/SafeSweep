import React, { useState, useEffect } from 'react';
import { Play, Square, Layers, ShieldCheck, Trash2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { motion } from 'framer-motion';

export default function DuplicateFinder() {
  const duplicatesStatus = useAppStore((state) => state.duplicatesStatus);
  const duplicatesList = useAppStore((state) => state.duplicatesList);
  const startDeletion = useAppStore((state) => state.startDeletion);

  const [scanFolder, setScanFolder] = useState('C:\\Users\\user\\Downloads');
  const [activeScan, setActiveScan] = useState(false);
  const [progressInfo, setProgressInfo] = useState({ processed_count: 0, total_count: 0 });

  useEffect(() => {
    // Listen to incremental duplicate hashing progress reports
    try {
      const unsubNotify = window.api.onNotification((packet) => {
        if (packet.method === 'duplicates.progress') {
          setProgressInfo(packet.params);
        } else if (packet.method === 'duplicates.completed') {
          setActiveScan(false);
          useAppStore.setState({ duplicatesList: packet.params.duplicates, duplicatesStatus: 'completed' });
        }
      });
      return unsubNotify;
    } catch (e) {}
  }, []);

  const handleStartDuplicateScan = () => {
    if (!scanFolder) return;
    setActiveScan(true);
    useAppStore.setState({ duplicatesStatus: 'scanning', duplicatesList: [] });
    window.api.sendRequest('duplicates:start', { folders: [scanFolder] });
  };

  const handleCancelDuplicateScan = () => {
    // To support cancellations cleanly, we invoke deletions cancel/reset logic on duplicate scanner tasks
    window.api.sendRequest('scanner:cancel');
    setActiveScan(false);
    useAppStore.setState({ duplicatesStatus: 'cancelled' });
  };

  const handleCleanDuplicate = (filePath) => {
    if (confirm(`Are you sure you want to delete this duplicate file copy?\n${filePath}`)) {
      startDeletion([filePath], false); // Safe Recycle Bin Delete
      // Clean locally from UI tree list
      const newList = duplicatesList.map(group => ({
        ...group,
        files: group.files.filter(f => f !== filePath)
      })).filter(group => group.files.length >= 2);
      useAppStore.setState({ duplicatesList: newList });
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
      className="flex-1 p-6 space-y-6 overflow-y-auto select-text text-sm h-full flex flex-col"
    >
      <div>
        <h2 className="text-xl font-bold tracking-tight text-gray-200">Double-Pass Duplicate Finder</h2>
        <p className="text-xs text-gray-400 mt-0.5 font-sans">Locates identical files by matching sizes, first 8 KB block headers, and final sequential SHA-256 signatures.</p>
      </div>

      {/* Target input */}
      <div className="glass-card p-4 flex flex-col md:flex-row items-center gap-3">
        <div className="flex-1 w-full space-y-1">
          <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">Target Scan Directory</label>
          <input 
            type="text" 
            value={scanFolder}
            onChange={(e) => setScanFolder(e.target.value)}
            disabled={activeScan}
            className="w-full bg-brand-darkest border border-brand-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-accent text-xs font-mono text-gray-200"
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto md:self-end">
          {activeScan ? (
            <button 
              onClick={handleCancelDuplicateScan}
              className="flex-1 md:flex-none bg-brand-rose/25 hover:bg-brand-rose/30 border border-brand-rose/40 text-brand-rose py-1.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Square className="h-4 w-4" />
              <span>Cancel Scan</span>
            </button>
          ) : (
            <button 
              onClick={handleStartDuplicateScan}
              className="flex-1 md:flex-none bg-brand-accent hover:bg-brand-accent/95 text-white py-1.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Play className="h-4 w-4" />
              <span>Find Duplicates</span>
            </button>
          )}
        </div>
      </div>

      {/* Process state */}
      {activeScan && (
        <div className="glass-card p-4 space-y-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-gray-400">Comparing file signatures...</span>
            <span className="text-brand-accent font-bold">
              Processed {progressInfo.processed_count} / {progressInfo.total_count || '...'} files
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-brand-darkest rounded-full h-2 overflow-hidden">
            <motion.div 
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="bg-brand-accent h-full"
            />
          </div>
        </div>
      )}

      {/* Duplicates List */}
      {duplicatesStatus === 'completed' && (
        <div className="flex-grow flex flex-col space-y-4">
          {duplicatesList.length === 0 ? (
            <div className="glass-card py-16 flex flex-col items-center justify-center text-gray-500 gap-3 border border-brand-border">
              <ShieldCheck className="h-10 w-10 text-brand-green" />
              <span>Excellent: No duplicate file structures found in directory.</span>
            </div>
          ) : (
            <div className="space-y-4 flex-grow overflow-y-auto max-h-[360px] pr-1">
              {duplicatesList.map((group, idx) => (
                <div key={idx} className="glass-card p-4 border border-brand-border space-y-3">
                  <div className="flex items-center justify-between border-b border-brand-border pb-2">
                    <div className="flex items-center gap-2 text-xs">
                      <Layers className="h-4 w-4 text-brand-accent" />
                      <span className="font-semibold text-gray-300">Hash Match Group ({group.sha256.substring(0, 12)}...)</span>
                    </div>
                    <span className="text-xs text-brand-green font-mono font-semibold">Copy Size: {formatBytes(group.size)}</span>
                  </div>

                  <div className="space-y-2 font-mono text-xs text-gray-400 pl-2">
                    {group.files.map((file, fIdx) => (
                      <div key={fIdx} className="flex justify-between items-center bg-brand-darkest/40 p-1.5 rounded border border-brand-border/40 hover:border-brand-border transition-colors">
                        <span className="truncate pr-4 flex-grow select-text">{file}</span>
                        {fIdx > 0 && (
                          <button 
                            onClick={() => handleCleanDuplicate(file)}
                            className="text-gray-500 hover:text-brand-rose transition-colors flex items-center gap-1 font-sans font-semibold text-[10px]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Remove Copy</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

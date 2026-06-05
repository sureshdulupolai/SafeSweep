import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Loader2, Trash2, ShieldAlert, X, CheckSquare, Square, RefreshCw, Layers } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export default function DuplicateFinder({ isOpen, onClose }) {
  const scanDuplicates = useAppStore(state => state.scanDuplicates);
  const duplicatesList = useAppStore(state => state.duplicatesList);
  const scanStatus = useAppStore(state => state.duplicatesScanStatus);
  const deleteDuplicates = useAppStore(state => state.deleteDuplicates);
  const deleteStatus = useAppStore(state => state.deleteStatus);

  // Set of selected file paths to delete
  const [selectedPaths, setSelectedPaths] = useState(new Set());
  const [reloadCooldown, setReloadCooldown] = useState(0);
  const [showLongScanMsg, setShowLongScanMsg] = useState(false);

  useEffect(() => {
    let timer;
    if (scanStatus === 'scanning') {
      timer = setTimeout(() => setShowLongScanMsg(true), 4000);
    } else {
      setShowLongScanMsg(false);
    }
    return () => clearTimeout(timer);
  }, [scanStatus]);

  useEffect(() => {
    let timer;
    if (reloadCooldown > 0) {
      timer = setTimeout(() => setReloadCooldown(prev => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [reloadCooldown]);

  const handleRescan = () => {
    if (scanStatus === 'scanning' || reloadCooldown > 0 || deleteStatus === 'deleting') return;
    setReloadCooldown(5);
    scanDuplicates();
  };

  useEffect(() => {
    if (isOpen && scanStatus === 'idle') {
      scanDuplicates();
    }
  }, [isOpen, scanStatus, scanDuplicates]);

  useEffect(() => {
    // Smart Auto-Select: Select all duplicates EXCEPT the first one (oldest or newest depending on sort)
    // Here we'll keep the first item in each group as the "original" and select the rest.
    if (scanStatus === 'completed' && duplicatesList && duplicatesList.length > 0) {
      const pathsToDelete = new Set();
      duplicatesList.forEach(group => {
        // Assume group.files is an array of identical files
        if (group.files && group.files.length > 1) {
          // Sort by modified time (oldest first as original)
          const sorted = [...group.files].sort((a, b) => a.modified - b.modified);
          // Select all except the first one
          for (let i = 1; i < sorted.length; i++) {
            pathsToDelete.add(sorted[i].path);
          }
        }
      });
      setSelectedPaths(pathsToDelete);
    }
  }, [scanStatus, duplicatesList]);

  const handleTogglePath = (path) => {
    setSelectedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleToggleGroup = (group) => {
    const allPathsInGroup = group.files.map(f => f.path);
    const allSelected = allPathsInGroup.every(p => selectedPaths.has(p));
    
    setSelectedPaths(prev => {
      const next = new Set(prev);
      if (allSelected) {
        allPathsInGroup.forEach(p => next.delete(p));
      } else {
        // Select all except the first one
        const sorted = [...group.files].sort((a, b) => a.modified - b.modified);
        for (let i = 1; i < sorted.length; i++) {
          next.add(sorted[i].path);
        }
      }
      return next;
    });
  };

  const handleDelete = () => {
    if (selectedPaths.size > 0) {
      deleteDuplicates(Array.from(selectedPaths));
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };
  
  const formatDate = (timestamp) => {
      return new Date(timestamp * 1000).toLocaleDateString();
  }

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          className="bg-brand-dark border border-brand-border rounded-xl shadow-2xl max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="bg-brand-card/80 border-b border-brand-border p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-purple-500/20 p-2 rounded-full border border-purple-500/30">
                <Copy className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-200">Duplicate File Finder</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Identical files across your PC grouped by content hash.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRescan}
                disabled={scanStatus === 'scanning' || reloadCooldown > 0 || deleteStatus === 'deleting'}
                className="p-1.5 text-gray-400 hover:text-brand-accent transition-colors disabled:opacity-50"
                title="Rescan Duplicates"
              >
                <RefreshCw className={`h-4 w-4 ${scanStatus === 'scanning' ? 'animate-spin' : ''}`} />
              </button>
              <button 
                onClick={onClose}
                disabled={deleteStatus === 'deleting'}
                className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 bg-brand-darkest relative">
            {scanStatus === 'scanning' ? (
              <div className="h-full flex flex-col items-center justify-center space-y-4">
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="absolute inset-0 rounded-full border-t-2 border-r-2 border-purple-400 border-opacity-70"
                  />
                  <Layers className="h-8 w-8 text-purple-400 animate-pulse" />
                </div>
                <div className="text-center">
                  <h4 className="text-sm font-bold text-gray-200 mb-1">Scanning for Duplicates</h4>
                  <p className="text-xs text-gray-400">Comparing file hashes across user directories...</p>
                  <AnimatePresence>
                    {showLongScanMsg && (
                      <motion.p 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[11px] text-brand-amber/80 mt-3 p-3 bg-brand-amber/10 rounded-lg border border-brand-amber/20 max-w-sm mx-auto"
                      >
                        Deep hashing large files may take a moment.
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ) : scanStatus === 'completed' ? (
              <div className="space-y-4">
                <div className="bg-brand-card/40 border border-brand-border/50 p-4 rounded-xl flex items-start gap-3">
                   <ShieldAlert className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
                   <div>
                     <h4 className="text-xs font-bold text-gray-200">Review Carefully Before Deleting</h4>
                     <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                       We have grouped identical files by matching their <strong>exact SHA-256 byte signature</strong>. By default, SafeSweep auto-selects the newer copies to delete while preserving the oldest (original) copy. You can customize the selection manually.
                     </p>
                   </div>
                </div>

                <div className="space-y-4">
                  {duplicatesList.map((group, idx) => (
                    <div key={idx} className="bg-brand-card border border-brand-border rounded-xl overflow-hidden shadow-lg transition-all hover:border-brand-border/80">
                      {/* Group Header */}
                      <div className="bg-brand-dark/50 p-3 border-b border-brand-border flex items-center justify-between">
                         <div className="flex items-center gap-3">
                           <Layers className="h-4 w-4 text-purple-400" />
                           <div>
                             <span className="text-xs font-bold text-gray-200 flex items-center gap-2">
                               {group.files[0].name}
                               <span className="bg-brand-darkest px-2 py-0.5 rounded text-[10px] text-purple-400 border border-purple-500/20">
                                 {group.files.length} copies
                               </span>
                             </span>
                             <span className="text-[10px] text-gray-500 mt-0.5 block font-mono">
                               Size: {formatBytes(group.size)}
                             </span>
                           </div>
                         </div>
                         <button
                           onClick={() => handleToggleGroup(group)}
                           className="text-[10px] uppercase font-bold tracking-wider text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 px-3 py-1.5 rounded-lg transition-colors border border-purple-500/20"
                         >
                           Auto-Select Extras
                         </button>
                      </div>
                      
                      {/* Group Items */}
                      <div className="divide-y divide-brand-border/30">
                        {group.files.map((file, fIdx) => {
                          const isSelected = selectedPaths.has(file.path);
                          // Determine if this is the original (oldest)
                          const sorted = [...group.files].sort((a, b) => a.modified - b.modified);
                          const isOriginal = sorted[0].path === file.path;

                          return (
                            <div 
                              key={fIdx}
                              onClick={() => handleTogglePath(file.path)}
                              className={`p-3 flex items-start gap-3 cursor-pointer transition-colors ${
                                isSelected ? 'bg-brand-rose/5 hover:bg-brand-rose/10' : 'hover:bg-brand-darkest'
                              }`}
                            >
                              <div className="mt-0.5">
                                {isSelected ? (
                                  <CheckSquare className="h-4 w-4 text-brand-rose" />
                                ) : (
                                  <Square className="h-4 w-4 text-gray-500" />
                                )}
                              </div>
                              <div className="flex-1 overflow-hidden">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-xs font-mono truncate ${isSelected ? 'text-brand-rose/80 line-through' : 'text-gray-300'}`} title={file.path}>
                                    {file.path}
                                  </span>
                                  {isOriginal && (
                                    <span className="text-[9px] uppercase font-bold text-brand-green bg-brand-green/10 px-1.5 py-0.5 rounded border border-brand-green/20 flex-shrink-0">
                                      Original
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-gray-500">
                                  Modified: {formatDate(file.modified)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  
                  {duplicatesList.length === 0 && (
                    <div className="text-center p-8 bg-brand-card/30 rounded-xl border border-brand-border border-dashed">
                      <Copy className="h-8 w-8 text-gray-500 mx-auto mb-3 opacity-50" />
                      <h4 className="text-sm font-bold text-gray-300">No Duplicates Found</h4>
                      <p className="text-[11px] text-gray-500 mt-1 max-w-sm mx-auto">
                        Your user directories are clean. We didn't find any large identical files cluttering your space.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-brand-rose text-sm">Failed to scan for duplicates. Try again.</p>
              </div>
            )}
          </div>

          {/* Footer */}
          {scanStatus === 'completed' && duplicatesList.length > 0 && (
            <div className="bg-brand-card border-t border-brand-border p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  <span className="text-gray-400">Selected: </span>
                  <span className="text-gray-200 font-bold">{selectedPaths.size}</span>
                  <span className="text-gray-500 text-xs ml-1">items</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={selectedPaths.size === 0 || deleteStatus === 'deleting'}
                  className={`px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                    selectedPaths.size === 0
                      ? 'bg-brand-darkest text-gray-500 cursor-not-allowed border border-brand-border'
                      : 'bg-brand-rose hover:bg-rose-500 text-brand-darkest shadow-lg shadow-brand-rose/20'
                  }`}
                >
                  {deleteStatus === 'deleting' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Delete Selected
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

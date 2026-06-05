import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderX, Loader2, Trash2, ShieldAlert, X, CheckSquare, Square, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export default function EmptyFolderScanner({ isOpen, onClose }) {
  const scanEmptyFolders = useAppStore(state => state.scanEmptyFolders);
  const emptyFoldersList = useAppStore(state => state.emptyFoldersList);
  const scanStatus = useAppStore(state => state.emptyFoldersScanStatus);
  const deleteEmptyFolders = useAppStore(state => state.deleteEmptyFolders);
  const deleteStatus = useAppStore(state => state.deleteStatus);

  const [selectedPaths, setSelectedPaths] = useState([]);
  const [reloadCooldown, setReloadCooldown] = useState(0);

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
    scanEmptyFolders();
  };

  useEffect(() => {
    if (isOpen && scanStatus === 'idle') {
      scanEmptyFolders();
    }
  }, [isOpen, scanStatus, scanEmptyFolders]);

  useEffect(() => {
    // Select all by default when scan finishes
    if (scanStatus === 'completed') {
      setSelectedPaths(emptyFoldersList);
    }
  }, [scanStatus, emptyFoldersList]);

  const handleToggleAll = () => {
    if (selectedPaths.length === emptyFoldersList.length) {
      setSelectedPaths([]);
    } else {
      setSelectedPaths(emptyFoldersList);
    }
  };

  const handleTogglePath = (path) => {
    setSelectedPaths(prev => 
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const handleDelete = () => {
    if (selectedPaths.length > 0) {
      deleteEmptyFolders(selectedPaths);
    }
  };

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
          className="bg-brand-dark border border-brand-border rounded-xl shadow-2xl max-w-2xl w-full h-[80vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="bg-brand-card/80 border-b border-brand-border p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-brand-accent/20 p-2 rounded-full">
                <FolderX className="h-5 w-5 text-brand-accent" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-200">Empty Folder Scanner</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Scanning C:\ drive for zero-byte directories.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleRescan}
                disabled={scanStatus === 'scanning' || reloadCooldown > 0 || deleteStatus === 'deleting'}
                className={`p-1.5 rounded-lg border transition-all ${
                  scanStatus === 'scanning' || reloadCooldown > 0 || deleteStatus === 'deleting'
                    ? 'border-brand-border bg-brand-dark opacity-50 cursor-not-allowed' 
                    : 'border-brand-border bg-brand-card hover:bg-brand-accent/10 hover:border-brand-accent/30 hover:text-brand-accent'
                }`}
                title="Rescan Drive"
              >
                {reloadCooldown > 0 ? (
                  <span className="h-5 w-5 flex items-center justify-center text-[10px] font-bold text-brand-accent">
                    {reloadCooldown}s
                  </span>
                ) : (
                  <RefreshCw className={`h-5 w-5 text-gray-400 ${scanStatus === 'scanning' ? 'animate-spin text-brand-accent' : ''}`} />
                )}
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
                    className="absolute inset-0 rounded-full border-t-2 border-r-2 border-brand-accent border-opacity-70"
                  />
                  <FolderX className="h-8 w-8 text-brand-accent animate-pulse" />
                </div>
                <div className="text-center">
                  <h4 className="text-sm font-bold text-gray-200 mb-1">Deep Scanning C:\</h4>
                  <p className="text-xs text-gray-400">This may take a minute depending on your disk size...</p>
                </div>
              </div>
            ) : scanStatus === 'completed' && emptyFoldersList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center space-y-3 text-center">
                <div className="bg-brand-green/10 p-3 rounded-full mb-2">
                  <FolderX className="h-6 w-6 text-brand-green" />
                </div>
                <h4 className="text-sm font-bold text-gray-200">No Empty Folders Found</h4>
                <p className="text-xs text-gray-400">Your system is incredibly clean. No residual empty directories were detected.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-brand-card p-3 rounded-lg border border-brand-border">
                  <div className="flex items-center gap-2">
                    <button onClick={handleToggleAll} className="text-gray-400 hover:text-brand-accent transition-colors">
                      {selectedPaths.length === emptyFoldersList.length ? <CheckSquare className="h-4 w-4 text-brand-accent" /> : <Square className="h-4 w-4" />}
                    </button>
                    <span className="text-xs font-semibold text-gray-200">Select All {emptyFoldersList.length} Folders</span>
                  </div>
                  <span className="text-[10px] bg-brand-accent/10 text-brand-accent border border-brand-accent/30 px-2 py-0.5 rounded font-mono uppercase">
                    {selectedPaths.length} Selected
                  </span>
                </div>

                <div className="border border-brand-border rounded-lg overflow-hidden bg-brand-card/50">
                  <div className="max-h-[50vh] overflow-y-auto p-1">
                    {emptyFoldersList.map((path, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => handleTogglePath(path)}
                        className="flex items-start gap-3 p-2 hover:bg-brand-card/80 rounded cursor-pointer transition-colors"
                      >
                        <div className="mt-0.5 text-gray-400">
                          {selectedPaths.includes(path) ? <CheckSquare className="h-4 w-4 text-brand-accent" /> : <Square className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <span className="text-xs text-gray-300 font-mono truncate block" title={path}>{path}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="bg-brand-card border-t border-brand-border p-4 flex justify-between items-center">
             <div className="flex items-center gap-2 text-brand-rose text-[10px] font-semibold uppercase tracking-wide">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Permanent Unrecoverable Deletion</span>
             </div>
             
             <div className="flex gap-3">
               <button
                 onClick={onClose}
                 disabled={deleteStatus === 'deleting'}
                 className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-gray-200 hover:bg-brand-darkest transition-colors disabled:opacity-50"
               >
                 Cancel
               </button>
               <button
                 disabled={selectedPaths.length === 0 || deleteStatus === 'deleting' || scanStatus !== 'completed'}
                 onClick={handleDelete}
                 className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-brand-rose hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-lg shadow-brand-rose/20"
               >
                 {deleteStatus === 'deleting' ? (
                   <>
                     <Loader2 className="h-4 w-4 animate-spin" />
                     Shredding...
                   </>
                 ) : (
                   <>
                     <Trash2 className="h-4 w-4" />
                     Permanently Delete
                   </>
                 )}
               </button>
             </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

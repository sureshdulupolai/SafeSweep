import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileArchive, Loader2, Trash2, ShieldAlert, X, CheckSquare, Square, RefreshCw, Archive } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export default function ArchiveManager({ isOpen, onClose }) {
  const scanArchives = useAppStore(state => state.scanArchives);
  const archivesList = useAppStore(state => state.archivesList);
  const scanStatus = useAppStore(state => state.archivesScanStatus);
  const deleteArchives = useAppStore(state => state.deleteArchives);
  const deleteStatus = useAppStore(state => state.deleteStatus);

  const [selectedPaths, setSelectedPaths] = useState([]);
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
    scanArchives();
  };

  useEffect(() => {
    if (isOpen) {
      scanArchives();
    }
  }, [isOpen, scanArchives]);

  useEffect(() => {
    // Select all by default when scan finishes
    if (scanStatus === 'completed') {
      setSelectedPaths(archivesList.map(f => f.path));
    }
  }, [scanStatus, archivesList]);

  const handleToggleAll = () => {
    if (selectedPaths.length === archivesList.length) {
      setSelectedPaths([]);
    } else {
      setSelectedPaths(archivesList.map(f => f.path));
    }
  };

  const handleTogglePath = (path) => {
    setSelectedPaths(prev => 
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const handleDelete = () => {
    if (selectedPaths.length > 0) {
      deleteArchives(selectedPaths);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
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
          className="bg-brand-dark border border-brand-border rounded-xl shadow-2xl max-w-3xl w-full h-[85vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="bg-brand-card/80 border-b border-brand-border p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-brand-amber/20 p-2 rounded-full">
                <FileArchive className="h-5 w-5 text-brand-amber" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-200">Archive Manager</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Detecting ZIP, RAR, 7Z, and ISO files across your entire PC.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleRescan}
                disabled={scanStatus === 'scanning' || reloadCooldown > 0 || deleteStatus === 'deleting'}
                className={`p-1.5 rounded-lg border transition-all ${
                  scanStatus === 'scanning' || reloadCooldown > 0 || deleteStatus === 'deleting'
                    ? 'border-brand-border bg-brand-dark opacity-50 cursor-not-allowed' 
                    : 'border-brand-border bg-brand-card hover:bg-brand-amber/10 hover:border-brand-amber/30 hover:text-brand-amber'
                }`}
                title="Rescan PC"
              >
                {reloadCooldown > 0 ? (
                  <span className="h-5 w-5 flex items-center justify-center text-[10px] font-bold text-brand-amber">
                    {reloadCooldown}s
                  </span>
                ) : (
                  <RefreshCw className={`h-5 w-5 text-gray-400 ${scanStatus === 'scanning' ? 'animate-spin text-brand-amber' : ''}`} />
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
                    className="absolute inset-0 rounded-full border-t-2 border-r-2 border-brand-amber border-opacity-70"
                  />
                  <Archive className="h-8 w-8 text-brand-amber animate-pulse" />
                </div>
                <div className="text-center">
                  <h4 className="text-sm font-bold text-gray-200 mb-1">Scanning Entire PC</h4>
                  <p className="text-xs text-gray-400">Searching all logical drives for archives... This may take a while.</p>
                  {showLongScanMsg && (
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} className="mt-4 p-2 bg-brand-amber/10 border border-brand-amber/30 rounded text-[11px] text-brand-amber max-w-sm">
                      Your PC has a large number of files. Please wait while we safely scan them...
                    </motion.div>
                  )}
                </div>
              </div>
            ) : scanStatus === 'completed' && archivesList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center space-y-3 text-center">
                <div className="bg-brand-green/10 p-3 rounded-full mb-2">
                  <FileArchive className="h-6 w-6 text-brand-green" />
                </div>
                <h4 className="text-sm font-bold text-gray-200">No Archives Found</h4>
                <p className="text-xs text-gray-400">We couldn't find any large ZIP or ISO files hoarding your storage.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-brand-card p-3 rounded-lg border border-brand-border">
                  <div className="flex items-center gap-2">
                    <button onClick={handleToggleAll} className="text-gray-400 hover:text-brand-amber transition-colors">
                      {selectedPaths.length === archivesList.length ? <CheckSquare className="h-4 w-4 text-brand-amber" /> : <Square className="h-4 w-4" />}
                    </button>
                    <span className="text-xs font-semibold text-gray-200">Select All {archivesList.length} Archives</span>
                  </div>
                  <span className="text-[10px] bg-brand-amber/10 text-brand-amber border border-brand-amber/30 px-2 py-0.5 rounded font-mono uppercase">
                    {selectedPaths.length} Selected
                  </span>
                </div>

                <div className="border border-brand-border rounded-lg overflow-hidden bg-brand-card/50">
                  <div className="max-h-[55vh] overflow-y-auto p-1">
                    {archivesList.map((file, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => handleTogglePath(file.path)}
                        className="flex items-center justify-between gap-3 p-2 hover:bg-brand-card/80 rounded cursor-pointer transition-colors border-b border-brand-border/30 last:border-0"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="text-gray-400">
                            {selectedPaths.includes(file.path) ? <CheckSquare className="h-4 w-4 text-brand-amber" /> : <Square className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 overflow-hidden flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold bg-brand-dark px-1.5 py-0.5 rounded border border-brand-border text-brand-amber">
                                {file.type}
                              </span>
                              <span className="text-xs text-gray-200 font-medium truncate block" title={file.name}>{file.name}</span>
                            </div>
                            <span className="text-[10px] text-gray-500 truncate block mt-1">{file.path}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 text-right flex-shrink-0 mr-2">
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-mono font-bold text-gray-200">{formatBytes(file.size)}</span>
                          </div>
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
                     Delete Archives
                   </>
                 )}
               </button>
             </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

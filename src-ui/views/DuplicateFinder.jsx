import React, { useState, useEffect } from 'react';
import { Play, Square, Layers, ShieldCheck, Trash2, FolderSearch } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { motion } from 'framer-motion';
import DeleteModal from '../components/DeleteModal';

export default function DuplicateFinder() {
  const duplicatesStatus = useAppStore((state) => state.duplicatesStatus);
  const duplicatesList = useAppStore((state) => state.duplicatesList);
  const startDeletion = useAppStore((state) => state.startDeletion);
  const defaultDownloads = useAppStore((state) => state.defaultDownloads);
  const defaultDesktop = useAppStore((state) => state.defaultDesktop);

  const [scanFolder, setScanFolder] = useState('');
  const [activeScan, setActiveScan] = useState(false);
  const [progressInfo, setProgressInfo] = useState({ processed_count: 0, total_count: 0 });

  // DeleteModal States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedFileToDelete, setSelectedFileToDelete] = useState(null);
  const [activeSimulation, setActiveSimulation] = useState(null);

  // Sync scan folder target to dynamic defaultDownloads path on mount
  useEffect(() => {
    if (defaultDownloads && !scanFolder) {
      setScanFolder(defaultDownloads);
    }
  }, [defaultDownloads]);

  // Watch duplicatesStatus from store - when completed, turn off local activeScan
  useEffect(() => {
    if (duplicatesStatus === 'completed' || duplicatesStatus === 'cancelled') {
      setActiveScan(false);
    }
  }, [duplicatesStatus]);

  useEffect(() => {
    // Listen to incremental duplicate hashing progress reports from notifications
    if (!window.api) return;

    const unsubNotify = window.api.onNotification((packet) => {
      if (packet.method === 'duplicates.progress') {
        setProgressInfo(packet.params);
      }
      // Note: duplicates.completed is now handled in the store's notification handler
      // Store updates duplicatesList and duplicatesStatus automatically
    });

    return unsubNotify;
  }, []);

  const handleStartDuplicateScan = () => {
    if (!scanFolder.trim()) return;
    setActiveScan(true);
    setProgressInfo({ processed_count: 0, total_count: 0 });
    useAppStore.setState({ duplicatesStatus: 'scanning', duplicatesList: [] });
    if (window.api) {
      window.api.sendRequest('duplicates:start', { folders: [scanFolder.trim()] });
    }
  };

  const handleCancelDuplicateScan = () => {
    if (window.api) {
      window.api.sendRequest('scanner:cancel');
    }
    setActiveScan(false);
    useAppStore.setState({ duplicatesStatus: 'cancelled' });
  };

  const handleCleanDuplicate = (filePath, fileSize) => {
    setSelectedFileToDelete(filePath);
    setActiveSimulation({
      files_to_remove: [{ path: filePath, size: fileSize, risk: 'LOW' }],
      total_freed_bytes: fileSize
    });
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedFileToDelete) {
      startDeletion([selectedFileToDelete], false); // Safe Recycle Bin Delete
      // Remove locally from UI tree list immediately (optimistic update)
      const newList = duplicatesList
        .map(group => ({
          ...group,
          files: group.files.filter(f => f !== selectedFileToDelete)
        }))
        .filter(group => group.files.length >= 2);
      useAppStore.setState({ duplicatesList: newList });
      setSelectedFileToDelete(null);
      setActiveSimulation(null);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Drag and drop support
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setScanFolder(e.dataTransfer.files[0].path);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      className="flex-1 p-6 space-y-6 overflow-y-auto select-text text-sm h-full flex flex-col"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div>
        <h2 className="text-xl font-bold tracking-tight text-gray-200">Double-Pass Duplicate Finder</h2>
        <p className="text-xs text-gray-400 mt-0.5 font-sans">Locates identical files by matching sizes, first 8 KB block headers, and final sequential SHA-256 signatures.</p>
      </div>

      {/* Target input */}
      <div className="glass-card p-4 flex flex-col md:flex-row items-center gap-3">
        <div className="flex-1 w-full space-y-1">
          <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">Target Scan Directory</label>
          <div className="flex gap-2 items-center">
            <FolderSearch className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={scanFolder}
              onChange={(e) => setScanFolder(e.target.value)}
              disabled={activeScan}
              placeholder="Paste directory path or drop folder here"
              className="w-full bg-brand-darkest border border-brand-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-accent text-xs font-mono text-gray-200"
            />
          </div>
          {/* Quick Preset Chips */}
          <div className="flex flex-wrap gap-2 mt-2 select-none">
            <button
              onClick={() => setScanFolder(defaultDownloads)}
              disabled={activeScan || !defaultDownloads}
              className="px-2.5 py-1 rounded bg-brand-card hover:bg-brand-card/85 border border-brand-border text-[10px] font-semibold text-gray-300 transition-colors disabled:opacity-40"
            >
              📂 Downloads Folder
            </button>
            <button
              onClick={() => setScanFolder(defaultDesktop)}
              disabled={activeScan || !defaultDesktop}
              className="px-2.5 py-1 rounded bg-brand-card hover:bg-brand-card/85 border border-brand-border text-[10px] font-semibold text-gray-300 transition-colors disabled:opacity-40"
            >
              🖥️ Desktop Folder
            </button>
            <button
              onClick={() => setScanFolder('C:\\')}
              disabled={activeScan}
              className="px-2.5 py-1 rounded bg-brand-card hover:bg-brand-card/85 border border-brand-border text-[10px] font-semibold text-gray-300 transition-colors disabled:opacity-40"
            >
              💿 C:\ System Drive
            </button>
          </div>
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
              disabled={!scanFolder.trim()}
              className="flex-1 md:flex-none bg-brand-accent hover:bg-brand-accent/95 text-white py-1.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              {progressInfo.total_count > 0
                ? `${progressInfo.processed_count} / ${progressInfo.total_count} files`
                : `${progressInfo.processed_count} files scanned...`
              }
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-brand-darkest rounded-full h-2 overflow-hidden">
            {progressInfo.total_count > 0 ? (
              <div
                className="bg-brand-accent h-full transition-all duration-300"
                style={{ width: `${Math.min(100, (progressInfo.processed_count / progressInfo.total_count) * 100)}%` }}
              />
            ) : (
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="bg-brand-accent h-full"
              />
            )}
          </div>
        </div>
      )}

      {/* Duplicates List */}
      {duplicatesStatus === 'completed' && (
        <div className="flex-grow flex flex-col space-y-4">
          {duplicatesList.length === 0 ? (
            <div className="glass-card py-16 flex flex-col items-center justify-center text-gray-500 gap-3 border border-brand-border">
              <ShieldCheck className="h-10 w-10 text-brand-green" />
              <span className="font-sans">Excellent: No duplicate file structures found in directory.</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">
                  Found <strong className="text-brand-accent">{duplicatesList.length}</strong> duplicate group{duplicatesList.length !== 1 ? 's' : ''}
                  {' — '}
                  <strong className="text-brand-green">
                    {formatBytes(duplicatesList.reduce((acc, g) => acc + (g.size * (g.files.length - 1)), 0))} reclaimable
                  </strong>
                </span>
              </div>
              <div className="space-y-4 flex-grow overflow-y-auto max-h-[380px] pr-1">
                {duplicatesList.map((group, idx) => (
                  <div key={idx} className="glass-card p-4 border border-brand-border space-y-3">
                    <div className="flex items-center justify-between border-b border-brand-border pb-2">
                      <div className="flex items-center gap-2 text-xs">
                        <Layers className="h-4 w-4 text-brand-accent" />
                        <span className="font-semibold text-gray-300">
                          Hash Match Group ({group.sha256 ? group.sha256.substring(0, 12) : 'unknown'}...)
                        </span>
                        <span className="text-gray-500">× {group.files.length} copies</span>
                      </div>
                      <span className="text-xs text-brand-green font-mono font-semibold">
                        {formatBytes(group.size)} each
                      </span>
                    </div>

                    <div className="space-y-2 font-mono text-xs text-gray-400 pl-2">
                      {group.files.map((file, fIdx) => (
                        <div
                          key={fIdx}
                          className="flex justify-between items-center bg-brand-darkest/40 p-1.5 rounded border border-brand-border/40 hover:border-brand-border transition-colors"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {fIdx === 0 && (
                              <span className="text-[9px] bg-brand-green/10 border border-brand-green/20 text-brand-green px-1 py-0.5 rounded font-sans font-semibold flex-shrink-0">
                                KEEP
                              </span>
                            )}
                            <span className="truncate pr-2 select-text">{file}</span>
                          </div>
                          {fIdx > 0 && (
                            <button
                              onClick={() => handleCleanDuplicate(file, group.size)}
                              className="text-gray-500 hover:text-brand-rose transition-colors flex items-center gap-1 font-sans font-semibold text-[10px] flex-shrink-0"
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
            </>
          )}
        </div>
      )}

      {/* Cancelled state */}
      {duplicatesStatus === 'cancelled' && (
        <div className="glass-card py-12 flex flex-col items-center justify-center text-gray-500 gap-3 border border-brand-border">
          <span className="font-sans text-sm">Scan was cancelled. Start a new scan to find duplicates.</span>
        </div>
      )}

      {/* Verification modal for safe, typed duplicate removals */}
      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedFileToDelete(null);
          setActiveSimulation(null);
        }}
        simulation={activeSimulation}
        permanent={false}
        onConfirm={handleConfirmDelete}
      />
    </motion.div>
  );
}

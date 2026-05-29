import React, { useState, useEffect } from 'react';
import { Play, Square, Trash2, FolderSearch, ShieldCheck, ShieldAlert, Sparkles } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import FileTree from '../components/FileTree';
import SafeModeWatermark from '../components/SafeModeWatermark';
import DeleteModal from '../components/DeleteModal';
import TrustPanel from '../components/TrustPanel';
import { motion } from 'framer-motion';

export default function Cleaner() {
  const startScan = useAppStore((state) => state.startScan);
  const cancelScan = useAppStore((state) => state.cancelScan);
  const scanStatus = useAppStore((state) => state.scanStatus);
  const scannedCount = useAppStore((state) => state.scannedCount);
  const scannedBytes = useAppStore((state) => state.scannedBytes);
  const scannedFiles = useAppStore((state) => state.scannedFiles);
  const safeModeEnforced = useAppStore((state) => state.safeModeEnforced);
  const deleteStatus = useAppStore((state) => state.deleteStatus);
  const startDeletion = useAppStore((state) => state.startDeletion);
  const activeSimulation = useAppStore((state) => state.activeSimulation);
  const runDeleteSimulation = useAppStore((state) => state.runDeleteSimulation);
  const clearSimulation = useAppStore((state) => state.clearSimulation);

  const [scanPath, setScanPath] = useState('C:\\Users\\user\\Downloads');
  const [selectedPaths, setSelectedPaths] = useState([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [permanentDelete, setPermanentDelete] = useState(false);
  const [isTrustPanelOpen, setIsTrustPanelOpen] = useState(false);

  // Sync selected paths with newly scanned files
  useEffect(() => {
    if (scanStatus === 'scanning') {
      setSelectedPaths([]);
    } else if (scanStatus === 'completed') {
      // By default, select low and safe risk items, leaving critical/high unselected
      const defaultChecked = scannedFiles
        .filter(f => f.risk === 'SAFE' || f.risk === 'LOW')
        .map(f => f.path);
      setSelectedPaths(defaultChecked);
    }
  }, [scanStatus, scannedFiles]);

  const handleStartScan = () => {
    if (!scanPath) return;
    startScan(scanPath);
  };

  const handleToggleSelection = (pathsArray, check) => {
    setSelectedPaths((prev) => {
      if (check) {
        // Union selection
        const newPaths = [...prev];
        pathsArray.forEach(p => {
          if (!newPaths.includes(p)) newPaths.push(p);
        });
        return newPaths;
      } else {
        // Filter selection
        return prev.filter((p) => !pathsArray.includes(p));
      }
    });
  };

  const handleTriggerReview = (permanent) => {
    setPermanentDelete(permanent);
    runDeleteSimulation(selectedPaths);
    setIsDeleteModalOpen(true);
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Drag-and-Drop handling for paths
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    // In Electron, file drop lists expose absolute paths natively
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedPath = e.dataTransfer.files[0].path;
      setScanPath(droppedPath);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      className="flex-1 p-6 space-y-4 overflow-y-auto flex flex-col h-full select-text"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Search Target Deck */}
      <div className="glass-card p-4 flex flex-col md:flex-row items-center gap-3">
        <div className="flex-1 w-full space-y-1">
          <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">Target Scan Directory</label>
          <div className="flex gap-2 items-center">
            <FolderSearch className="h-5 w-5 text-gray-400" />
            <input 
              type="text" 
              value={scanPath}
              onChange={(e) => setScanPath(e.target.value)}
              placeholder="Paste directory path or drop folder here"
              disabled={scanStatus === 'scanning'}
              className="bg-brand-darkest border border-brand-border rounded-lg px-3 py-1.5 flex-1 focus:outline-none focus:border-brand-accent text-xs font-mono text-gray-200"
            />
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto md:self-end">
          {scanStatus === 'scanning' ? (
            <button 
              onClick={cancelScan}
              className="flex-1 md:flex-none bg-brand-rose/25 hover:bg-brand-rose/30 border border-brand-rose/40 text-brand-rose py-1.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Square className="h-4 w-4" />
              <span>Cancel Scan</span>
            </button>
          ) : (
            <button 
              onClick={handleStartScan}
              className="flex-1 md:flex-none bg-brand-accent hover:bg-brand-accent/95 text-white py-1.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Play className="h-4 w-4" />
              <span>Start Analysis</span>
            </button>
          )}
        </div>
      </div>

      {/* Warning/Watermark Section */}
      <SafeModeWatermark visible={safeModeEnforced} />

      {/* In-scanning Progress bar visualizer */}
      {scanStatus === 'scanning' && (
        <div className="glass-card p-4 space-y-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-gray-400">Traversing Folders...</span>
            <span className="text-brand-accent font-bold">{scannedCount.toLocaleString()} files indexed</span>
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

      {/* Main File tree selection layout */}
      {scanStatus === 'completed' && (
        <div className="flex-1 flex flex-col min-h-[350px] space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3 text-xs">
              <span className="text-gray-400">Total Scanned Size: <strong className="text-gray-200">{formatBytes(scannedBytes)}</strong></span>
              <span className="text-gray-500 border-l border-brand-border pl-3">Selection Size: <strong className="text-brand-green">{formatBytes(scannedFiles.filter(f => selectedPaths.includes(f.path)).reduce((acc, curr) => acc + curr.size, 0))}</strong></span>
            </div>
            
            <button 
              onClick={() => setIsTrustPanelOpen(true)}
              className="text-xs text-brand-accent hover:underline flex items-center gap-1"
            >
              <span>Why Was This Protected?</span>
            </button>
          </div>

          <FileTree 
            files={scannedFiles}
            selectedPaths={selectedPaths}
            onToggleSelection={handleToggleSelection}
          />

          {/* Action Cleanup Bar */}
          {!safeModeEnforced && selectedPaths.length > 0 && (
            <div className="glass-card p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-gray-200">Execution Strategy</span>
                <p className="text-[10px] text-gray-400">Choose between a safe Recycle Bin sweep or advanced cryptographic file unlinking.</p>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => handleTriggerReview(false)} // Safe Delete
                  className="bg-brand-card hover:bg-brand-card/85 border border-brand-border py-2 px-4 rounded-lg text-xs font-semibold text-gray-300 flex items-center gap-1.5 transition-colors"
                >
                  <ShieldCheck className="h-4 w-4 text-brand-accent" />
                  <span>Safe Delete</span>
                </button>
                <button 
                  onClick={() => handleTriggerReview(true)} // Permanent Shred
                  className="bg-brand-rose/10 hover:bg-brand-rose/15 border border-brand-rose/30 text-brand-rose py-2 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Permanent Delete</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trust Educational Sidebar Panel */}
      <TrustPanel isOpen={isTrustPanelOpen} onClose={() => setIsTrustPanelOpen(false)} />

      {/* Multi-step warning deletion modal */}
      <DeleteModal 
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          clearSimulation();
        }}
        simulation={activeSimulation}
        permanent={permanentDelete}
        onConfirm={(perm) => {
          startDeletion(selectedPaths, perm);
        }}
      />
    </motion.div>
  );
}

import React, { useEffect, useState } from 'react';
import { ShieldCheck, HardDrive, RefreshCw, Layers, ShieldAlert, Cpu, Trash2, Loader2, AlertTriangle, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { motion, AnimatePresence } from 'framer-motion';

// Pulsing skeleton placeholder block
function Skeleton({ className = '' }) {
  return (
    <div className={`bg-brand-card/60 rounded animate-pulse ${className}`} />
  );
}

export default function Dashboard() {
  const startScan = useAppStore((state) => state.startScan);
  const scanStatus = useAppStore((state) => state.scanStatus);
  const scanMode = useAppStore((state) => state.scanMode);
  const setScanMode = useAppStore((state) => state.setScanMode);
  const setActivePanel = useAppStore((state) => state.setActivePanel);
  const isSystemLoading = useAppStore((state) => state.isSystemLoading);

  // All data comes from the store - no local state needed
  const diskSpace = useAppStore((state) => state.diskSpace);
  const fetchDiskSpace = useAppStore((state) => state.fetchDiskSpace);
  const dashboardStats = useAppStore((state) => state.dashboardStats);
  const fetchDashboardStats = useAppStore((state) => state.fetchDashboardStats);
  const recycleBinInfo = useAppStore((state) => state.recycleBinInfo);
  const fetchRecycleBin = useAppStore((state) => state.fetchRecycleBin);

  // New loading state hooks
  const isDiskLoading = useAppStore((state) => state.isDiskLoading);
  const isRecycleLoading = useAppStore((state) => state.isRecycleLoading);
  const isStatsLoading = useAppStore((state) => state.isStatsLoading);

  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    if (!isDiskLoading && !isRecycleLoading && !isStatsLoading) {
      setIsInitialLoad(false);
    }
  }, [isDiskLoading, isRecycleLoading, isStatsLoading]);
  
  // Quick Clean Actions
  const quickClean = useAppStore((state) => state.quickClean);
  const quickCleanStatus = useAppStore((state) => state.quickCleanStatus);
  const quickCleanBytesFreed = useAppStore((state) => state.quickCleanBytesFreed);
  const quickCleanFilesDeleted = useAppStore((state) => state.quickCleanFilesDeleted);
  const quickCleanFilesSkipped = useAppStore((state) => state.quickCleanFilesSkipped);

  const [modalState, setModalState] = useState({ isOpen: false, step: 'confirm', targetId: null, label: '', value: '', bytesValue: 0 });
  const [confirmText, setConfirmText] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    if (quickCleanStatus === 'completed' && modalState.isOpen && modalState.step === 'confirm') {
      // Transition to success step inside the modal
      setModalState(prev => ({ ...prev, step: 'success' }));
    }
  }, [quickCleanStatus, modalState.isOpen, modalState.step]);

  useEffect(() => {
    // Fetch fresh data on mount (supports both Chrome browser and Electron)
    fetchDiskSpace();
    fetchDashboardStats();
    fetchRecycleBin();

    // Poll every 3 seconds to keep data live dynamically
    const interval = setInterval(() => {
      fetchDiskSpace();
      fetchDashboardStats();
      fetchRecycleBin();
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchDiskSpace, fetchDashboardStats, fetchRecycleBin]);

  const handleScanTrigger = () => {
    startScan('C:\\');
    setActivePanel('cleaner');
  };

  const handleCardClick = (id, label, value, rawBytes) => {
    if (id === 'exclusion') return; // Not cleanable
    setModalState({ isOpen: true, step: 'confirm', targetId: id, label, value, bytesValue: rawBytes });
    setConfirmText('');
  };

  const closeAndResetModal = () => {
    const wasSuccess = modalState.step === 'success';
    setModalState({ isOpen: false, step: 'confirm', targetId: null, label: '', value: '', bytesValue: 0 });
    setConfirmText('');
    if (wasSuccess) {
      // Hard reload to guarantee all data is fetched fresh
      window.location.reload();
    }
  };

  const handleQuickClean = () => {
    if (confirmText.toLowerCase().trim() === 'delete' && modalState.targetId) {
      quickClean(modalState.targetId);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Real C:\ disk statistics
  const diskTotal = diskSpace.total || 0;
  const diskFree = diskSpace.free || 0;
  const diskUsed = diskTotal - diskFree;
  const diskPercentage = diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      className="flex-1 p-6 space-y-6 overflow-y-auto select-text relative"
    >
      {/* Top Welcome Title block */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-200">Storage Analytics Dashboard</h2>
          <p className="text-xs text-gray-400 mt-0.5">Designed with multiple protection layers to minimize accidental system damage.</p>
        </div>
        <div className="flex items-center gap-1.5 bg-brand-green/10 border border-brand-green/20 px-3 py-1.5 rounded-lg text-xs font-semibold text-brand-green">
          <ShieldCheck className="h-4 w-4" />
          <span>System Status: Hardened &amp; Shielded</span>
        </div>
      </div>

      {toastMessage && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-brand-green/90 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-lg border border-brand-green/50 flex items-center gap-2"
        >
          <ShieldCheck className="h-4 w-4" />
          {toastMessage}
        </motion.div>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {modalState.isOpen && (
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
              className="bg-brand-dark border border-brand-border rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col"
            >
              {modalState.step === 'confirm' ? (
                <>
                  <div className="bg-red-500/10 border-b border-red-500/20 p-4 flex items-center gap-3">
                    <div className="bg-red-500/20 p-2 rounded-full">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-gray-200">Permanently Delete {modalState.label}?</h3>
                      <p className="text-[11px] text-gray-400 mt-0.5">This action cannot be undone.</p>
                    </div>
                    <button 
                      onClick={closeAndResetModal}
                      className="text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="p-5 space-y-4">
                    <div className="bg-brand-card p-3 rounded-lg border border-brand-border">
                      <p className="text-xs text-gray-300">
                        You are about to permanently delete all contents in <span className="font-semibold text-brand-accent">{modalState.label}</span>. 
                        This will immediately free up roughly <span className="font-semibold text-brand-green">{modalState.value}</span> of storage space.
                      </p>
                    </div>

                    <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg flex items-start gap-2.5">
                      <Loader2 className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <p className="text-[11px] text-yellow-500/90 leading-relaxed">
                        <strong className="text-yellow-500 block mb-0.5">Please be patient during cleanup</strong>
                        This process may take a few moments depending on the number of files. Please do not close or reload the application while deletion is in progress to ensure complete removal.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block">
                        To confirm, type "delete" below:
                      </label>
                      <input
                        type="text"
                        placeholder="Type delete to confirm"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        className="w-full bg-brand-darkest border border-brand-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-brand-card border-t border-brand-border flex justify-end gap-3">
                    <button
                      onClick={closeAndResetModal}
                      className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-gray-200 hover:bg-brand-darkest transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={confirmText.toLowerCase().trim() !== 'delete' || quickCleanStatus === 'cleaning'}
                      onClick={handleQuickClean}
                      className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {quickCleanStatus === 'cleaning' ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          Permanently Delete
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* SUCCESS SUMMARY STEP */}
                  <div className="bg-brand-green/10 border-b border-brand-green/20 p-4 flex items-center gap-3">
                    <div className="bg-brand-green/20 p-2 rounded-full">
                      <ShieldCheck className="h-5 w-5 text-brand-green" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-gray-200">Cleanup Successful!</h3>
                      <p className="text-[11px] text-gray-400 mt-0.5">{modalState.label} has been successfully cleared.</p>
                    </div>
                  </div>
                  
                  <div className="p-5 space-y-4">
                    <div className="bg-brand-card rounded-lg border border-brand-border p-4 space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">Previous Allocation:</span>
                        <span className="font-mono text-gray-300">{modalState.value}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">Files Removed:</span>
                        <span className="font-mono text-brand-accent">{quickCleanFilesDeleted} files</span>
                      </div>
                      {quickCleanFilesSkipped > 0 && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-400">Files Skipped:</span>
                          <span className="font-mono text-brand-amber">{quickCleanFilesSkipped} files</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-xs border-t border-brand-border/50 pt-2">
                        <span className="font-semibold text-gray-300">Total Freed Space:</span>
                        <span className="font-mono font-bold text-brand-green text-sm">+{formatBytes(quickCleanBytesFreed)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs bg-brand-darkest/50 -mx-4 -mb-4 p-3 mt-2 rounded-b-lg border-t border-brand-border">
                        <span className="text-gray-400">Remaining Usage:</span>
                        <span className="font-mono text-gray-200">
                           {formatBytes(Math.max(0, modalState.bytesValue - quickCleanBytesFreed))}
                        </span>
                      </div>
                    </div>

                    {quickCleanFilesSkipped > 0 && (
                      <div className="bg-yellow-500/5 border border-yellow-500/10 p-3.5 rounded-lg flex items-start gap-2.5">
                        <div className="bg-yellow-500/10 p-1.5 rounded text-yellow-500 flex-shrink-0 mt-0.5">
                          <ShieldCheck className="h-3.5 w-3.5 text-yellow-500" />
                        </div>
                        <div className="flex-1">
                          <strong className="text-gray-200 text-[11px] block mb-0.5">Active Files Safely Preserved</strong>
                          <p className="text-[10px] text-gray-400 leading-relaxed">
                            Some system and application cache files are currently locked or in use by active Windows system processes or background services. These files have been safely skipped to guarantee system stability.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-brand-card border-t border-brand-border flex justify-end">
                    <button
                      onClick={closeAndResetModal}
                      className="px-6 py-2.5 rounded-lg text-xs font-bold text-white bg-brand-accent hover:bg-brand-accent/90 transition-colors w-full"
                    >
                      Acknowledge & Close
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {isSystemLoading ? (
          /* ───── LOADING SKELETON ───── */
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            className="space-y-6"
          >
            {/* Disk card skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 glass-card p-5 flex flex-col md:flex-row items-center gap-6 justify-around">
                {/* Circle placeholder */}
                <div className="relative w-40 h-40 flex-shrink-0 flex items-center justify-center">
                  <div className="w-40 h-40 rounded-full border-[7px] border-brand-darkest animate-pulse" />
                  <div className="absolute flex flex-col items-center gap-1">
                    <Loader2 className="h-6 w-6 text-brand-accent animate-spin" />
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">Fetching...</span>
                  </div>
                </div>
                {/* Stats placeholder */}
                <div className="space-y-4 flex-1 w-full">
                  <div className="flex items-center gap-3">
                    <HardDrive className="h-5 w-5 text-brand-accent" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-2.5 w-48" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t border-brand-border pt-4">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className="space-y-1.5">
                        <Skeleton className="h-2 w-20" />
                        <Skeleton className="h-3.5 w-16" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Scan card skeleton */}
              <div className="glass-card p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <Skeleton className="h-3 w-28" />
                  <div className="space-y-2">
                    {[0, 1, 2].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                  </div>
                </div>
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            </div>

            {/* Stats cards skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="glass-card p-4 flex items-center justify-between border border-brand-border">
                  <div className="space-y-2">
                    <Skeleton className="h-2 w-20" />
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-2 w-24" />
                  </div>
                  <Skeleton className="h-5 w-5 rounded" />
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          /* ───── REAL DATA ───── */
          <motion.div
            key="data"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            {/* Main Grid: SVG Capacity Circle + Scan controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* SVG Disk visualizer */}
              {isDiskLoading && diskTotal === 0 ? (
                /* Premium Disk Loader Card */
                <div className="md:col-span-2 glass-card p-5 flex flex-col md:flex-row items-center gap-6 justify-around premium-glow-subtle relative overflow-hidden">
                  {/* Glowing background highlights */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-brand-accent/5 rounded-full blur-2xl animate-pulse" />
                  
                  {/* Left Side: Animated SVG Circular Scan Ring */}
                  <div className="relative w-40 h-40 flex items-center justify-center flex-shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50" cy="50" r="40"
                        className="stroke-brand-darkest fill-none"
                        strokeWidth="7"
                      />
                      <motion.circle
                        cx="50" cy="50" r="40"
                        className="stroke-brand-accent fill-none"
                        strokeWidth="7"
                        strokeDasharray="80 170"
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        strokeLinecap="round"
                        style={{ originX: "50px", originY: "50px" }}
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <Loader2 className="h-6 w-6 text-brand-accent animate-spin" />
                      <span className="text-[9px] text-brand-accent font-semibold tracking-widest uppercase mt-2 animate-pulse">ANALYZING</span>
                    </div>
                  </div>

                  {/* Right Side: Drive Info Skeletons */}
                  <div className="space-y-4 flex-1 w-full">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-brand-accent/10 border border-brand-accent/20 rounded-lg text-brand-accent animate-pulse">
                        <HardDrive className="h-5 w-5" />
                      </div>
                      <div className="space-y-1.5 flex-1">
                        <h3 className="font-semibold text-gray-200 text-sm flex items-center gap-2">
                          Querying System Drive (C:)
                        </h3>
                        <div className="h-2.5 w-3/4 bg-brand-card/60 rounded animate-pulse" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-brand-border pt-4">
                      {[
                        { label: "Total Capacity", val: "Calculating..." },
                        { label: "Remaining Free", val: "Measuring..." },
                        { label: "Used Space", val: "Estimating..." },
                        { label: "Usage", val: "Computing..." }
                      ].map((item, idx) => (
                        <div key={idx} className="space-y-1">
                          <span className="text-gray-500 block text-xs">{item.label}</span>
                          <span className="font-semibold text-gray-400 mt-1 text-xs block animate-pulse flex items-center gap-1.5 font-mono">
                            <span className="w-1.5 h-1.5 bg-brand-accent/60 rounded-full animate-ping" />
                            {item.val}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="md:col-span-2 glass-card p-5 flex flex-col md:flex-row items-center gap-6 justify-around premium-glow-subtle relative">
                  {/* Subtle sync/polling loader in the corner */}
                  {isDiskLoading && (
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 text-[9px] font-semibold text-brand-accent bg-brand-accent/10 border border-brand-accent/20 px-2 py-0.5 rounded-full shadow-inner animate-pulse">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      <span>Syncing...</span>
                    </div>
                  )}

                  <div className="relative w-40 h-40 flex items-center justify-center flex-shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50" cy="50" r="40"
                        className="stroke-brand-darkest fill-none"
                        strokeWidth="7"
                      />
                      <motion.circle
                        cx="50" cy="50" r="40"
                        className="stroke-brand-accent fill-none"
                        strokeWidth="7"
                        strokeDasharray="251.2"
                        initial={{ strokeDashoffset: 251.2 }}
                        animate={{ strokeDashoffset: 251.2 - (251.2 * diskPercentage) / 100 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-2xl font-bold text-gray-200">{Math.round(diskPercentage)}%</span>
                      <span className="text-[10px] text-gray-400 tracking-wider uppercase mt-0.5">Disk Used</span>
                    </div>
                  </div>

                  <div className="space-y-4 flex-1">
                    <div className="flex items-center gap-3">
                      <HardDrive className="h-5 w-5 text-brand-accent" />
                      <div>
                        <h3 className="font-semibold text-gray-200 text-sm">System Drive (C:)</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Physical NTFS partition with long path index overrides.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-brand-border pt-4 text-xs font-mono">
                      <div>
                        <span className="text-gray-500 block">Total Capacity</span>
                        <span className="font-semibold text-gray-300 mt-1 block">{formatBytes(diskTotal)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Remaining Free</span>
                        <span className="font-semibold text-brand-green mt-1 block">{formatBytes(diskFree)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Used Space</span>
                        <span className="font-semibold text-brand-amber mt-1 block">{formatBytes(diskUsed)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Usage</span>
                        <span className="font-semibold text-gray-300 mt-1 block">{Math.round(diskPercentage)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Scan Actions */}
              <div className="glass-card p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-200 text-sm">Select Scan Level</h3>
                  <div className="space-y-2">
                    {[
                      { id: 'quick', name: 'Quick Scan', desc: 'Sweep temp, caches, and recycle bins with low CPU footprints.' },
                      { id: 'balanced', name: 'Balanced Scan', desc: 'Scan custom system drives (C:\\) with safety protections active.' },
                      { id: 'deep', name: 'Deep Scan', desc: 'Run complete analysis and double-pass duplicate hashes.' }
                    ].map((mode) => (
                      <div
                        key={mode.id}
                        onClick={() => setScanMode(mode.id)}
                        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          scanMode === mode.id
                            ? 'bg-brand-accent/10 border-brand-accent text-brand-accent'
                            : 'bg-brand-card hover:bg-brand-card/80 border-brand-border text-gray-400'
                        }`}
                      >
                        <span className="font-semibold block text-gray-200 mb-0.5">{mode.name}</span>
                        {mode.desc}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleScanTrigger}
                  disabled={scanStatus === 'scanning'}
                  className="w-full bg-brand-accent hover:bg-brand-accent/95 text-white py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Cpu className="h-4 w-4" />
                  <span>{scanStatus === 'scanning' ? 'Scanning Active...' : 'Initialize Secure Scan'}</span>
                </button>
              </div>
            </div>

            {/* Analytics Statistics row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  id: 'recycle_bin',
                  label: 'Recycle Bin Size',
                  value: formatBytes(recycleBinInfo.size_bytes),
                  rawBytes: recycleBinInfo.size_bytes,
                  desc: `${recycleBinInfo.items_count} file${recycleBinInfo.items_count !== 1 ? 's' : ''} queued`,
                  icon: Trash2,
                  color: 'text-brand-accent',
                  glowColor: 'hover:border-brand-accent/50',
                  badgeColor: 'text-brand-accent border-brand-accent/30',
                  clickable: true
                },
                {
                  id: 'temp_files',
                  label: 'Temporary Files',
                  value: formatBytes(dashboardStats.temp_size_bytes),
                  rawBytes: dashboardStats.temp_size_bytes,
                  desc: `${dashboardStats.temp_items_count} file${dashboardStats.temp_items_count !== 1 ? 's' : ''} cached`,
                  icon: RefreshCw,
                  color: 'text-brand-amber',
                  glowColor: 'hover:border-brand-amber/50',
                  badgeColor: 'text-brand-amber border-brand-amber/30',
                  clickable: true
                },
                {
                  id: 'browser_caches',
                  label: 'Browser Caches',
                  value: formatBytes(dashboardStats.browser_size_bytes),
                  rawBytes: dashboardStats.browser_size_bytes,
                  desc: `${dashboardStats.browser_items_count} cache file${dashboardStats.browser_items_count !== 1 ? 's' : ''}`,
                  icon: Layers,
                  color: 'text-brand-green',
                  glowColor: 'hover:border-brand-green/50',
                  badgeColor: 'text-brand-green border-brand-green/30',
                  clickable: true
                },
                {
                  id: 'exclusion',
                  label: 'Exclusion Filters',
                  value: '9 categories',
                  rawBytes: 0,
                  desc: '.git, node_modules, VMs active',
                  icon: ShieldAlert,
                  color: 'text-gray-400',
                  glowColor: 'hover:border-gray-500/30',
                  badgeColor: 'text-gray-400 border-brand-border',
                  clickable: false
                }
              ].map((stat, idx) => {
                const isCleaningThis = modalState.targetId === stat.id && quickCleanStatus === 'cleaning';
                
                const isFetchingThis = 
                  stat.id === 'recycle_bin' ? isRecycleLoading :
                  (stat.id === 'temp_files' || stat.id === 'browser_caches') ? isStatsLoading :
                  false;

                const showFullLoader = isInitialLoad && isFetchingThis;

                return (
                  <div 
                    key={idx} 
                    onClick={() => stat.clickable && !showFullLoader && !isCleaningThis && handleCardClick(stat.id, stat.label, stat.value, stat.rawBytes)}
                    className={`glass-card p-4 flex items-center justify-between border border-brand-border transition-all relative overflow-hidden ${
                      stat.clickable && !showFullLoader && !isCleaningThis
                        ? `cursor-pointer hover:bg-brand-card/80 hover:shadow-lg hover:-translate-y-0.5 group ${stat.glowColor}` 
                        : 'opacity-90'
                    }`}
                  >
                    {/* Pulsing card-specific loading background highlight */}
                    {showFullLoader && (
                      <div className="absolute inset-0 bg-brand-card/30 animate-pulse pointer-events-none" />
                    )}

                    <div className="space-y-1 z-10 flex-1">
                      <span className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider flex items-center gap-1.5">
                        {stat.label}
                        {stat.clickable && (
                          showFullLoader ? (
                            <span className="text-[8px] bg-brand-darkest border border-brand-accent/30 px-1.5 py-0.5 rounded text-brand-accent font-mono animate-pulse">
                              SCANNING
                            </span>
                          ) : (
                            <span className={`text-[8px] bg-brand-darkest border px-1.5 py-0.5 rounded font-mono transition-colors flex items-center gap-1 ${stat.badgeColor} ${stat.clickable ? 'group-hover:text-brand-accent group-hover:border-brand-accent/30' : ''}`}>
                              {isFetchingThis && <Loader2 className="h-2 w-2 animate-spin text-brand-accent" />}
                              CLEAN
                            </span>
                          )
                        )}
                      </span>

                      <span className="font-bold text-gray-200 block text-lg h-7 flex items-center font-mono">
                        {isCleaningThis ? (
                          <span className="flex items-center gap-2 text-sm text-brand-accent">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Clearing...
                          </span>
                        ) : showFullLoader ? (
                          <span className="flex items-center gap-2 text-sm text-brand-accent">
                            <Loader2 className="h-4 w-4 animate-spin text-brand-accent" />
                            Calculating...
                          </span>
                        ) : (
                          stat.value
                        )}
                      </span>

                      <span className="text-[10px] text-gray-400 block h-4">
                        {isCleaningThis ? (
                          'Wiping files from system...'
                        ) : showFullLoader ? (
                          <span className="animate-pulse">Reading directories...</span>
                        ) : (
                          stat.desc
                        )}
                      </span>
                    </div>

                    <stat.icon className={`h-5 w-5 ${stat.color} flex-shrink-0 z-10 ${
                      isCleaningThis || showFullLoader ? 'animate-pulse opacity-50' : stat.clickable ? 'group-hover:scale-110 transition-transform' : ''
                    }`} />
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

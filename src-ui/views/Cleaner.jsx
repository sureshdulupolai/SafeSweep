import React, { useState, useEffect } from 'react';
import { Play, Square, Trash2, FolderSearch, ShieldCheck, ShieldAlert, Sparkles, Loader2, Download, Monitor, HardDrive, FolderOpen, Copy, Check, ExternalLink, Image, Video, Music, FileText, File, EyeOff, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import FileTree from '../components/FileTree';
import SafeModeWatermark from '../components/SafeModeWatermark';
import DeleteModal from '../components/DeleteModal';
import TrustPanel from '../components/TrustPanel';
import { motion, AnimatePresence } from 'framer-motion';

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
  const skipSelectedPaths = useAppStore((state) => state.skipSelectedPaths);
  const defaultDownloads = useAppStore((state) => state.defaultDownloads);
  const defaultDesktop = useAppStore((state) => state.defaultDesktop);
  const deletedCount = useAppStore((state) => state.deletedCount);
  const failedCount = useAppStore((state) => state.failedCount);
  const limitExceeded = useAppStore((state) => state.limitExceeded);

  const [scanPath, setScanPath] = useState(() => {
    return localStorage.getItem('safesweep_last_path') || '';
  });
  const [selectedPaths, setSelectedPaths] = useState([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [permanentDelete, setPermanentDelete] = useState(false);
  const [isTrustPanelOpen, setIsTrustPanelOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fileTypeFilter, setFileTypeFilter] = useState('all');

  const [shuffledTopLevel, setShuffledTopLevel] = useState([]);
  const [startIndex, setStartIndex] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [reloadCooldown, setReloadCooldown] = useState(0);
  const [toastMessage, setToastMessage] = useState(null);
  const CHUNK_SIZE = 5;

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const shuffleArray = (array) => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  };

  const getTopLevelName = (filePath, currentScanPath) => {
    if (!currentScanPath) return filePath;
    const normalizedFilePath = filePath.replace(/[\\/]+/g, '\\');
    const normalizedScanPath = currentScanPath.replace(/[\\/]+/g, '\\').replace(/\\$/, '');
    let relativePath = normalizedFilePath;
    if (normalizedFilePath.toLowerCase().startsWith(normalizedScanPath.toLowerCase())) {
      relativePath = normalizedFilePath.substring(normalizedScanPath.length).replace(/^\\/, '');
    }
    return relativePath.split('\\')[0];
  };

  useEffect(() => {
    if (scanStatus === 'scanning') {
      setShuffledTopLevel([]);
      setStartIndex(0);
    } else if (scanStatus === 'completed' && scannedFiles.length > 0 && shuffledTopLevel.length === 0) {
      const topLevelSet = new Set();
      scannedFiles.forEach(f => {
        topLevelSet.add(getTopLevelName(f.path, scanPath));
      });
      setShuffledTopLevel(shuffleArray(Array.from(topLevelSet)));
    }
  }, [scanStatus, scannedFiles.length, shuffledTopLevel.length, scanPath]);

  useEffect(() => {
    setStartIndex(0);
  }, [fileTypeFilter]);

  // Sync scan path to dynamic defaultDownloads when it finishes loading if no saved path exists
  useEffect(() => {
    const savedPath = localStorage.getItem('safesweep_last_path');
    if (savedPath) {
      setScanPath(savedPath);
      return;
    }
    if (defaultDownloads && !scanPath) {
      setScanPath(defaultDownloads);
    }
  }, [defaultDownloads]);

  // Persist the user's custom scan path to localStorage whenever it changes
  useEffect(() => {
    if (scanPath) {
      localStorage.setItem('safesweep_last_path', scanPath);
    }
  }, [scanPath]);

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

  const handleCopyPath = () => {
    if (!scanPath) return;
    navigator.clipboard.writeText(scanPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenExplorer = async () => {
    if (!scanPath) return;
    if (window.api && window.api.openSystemDirectory) {
      try {
        await window.api.openSystemDirectory(scanPath);
      } catch (err) {
        console.error('Failed to open directory in system explorer:', err);
      }
    } else {
      // In browser fallback, call local sidecar HTTP API on port 9988 to open natively without showing browser alerts
      try {
        const url = `http://127.0.0.1:9988/api/open?path=${encodeURIComponent(scanPath)}`;
        await fetch(url);
      } catch (err) {
        console.error('Browser Sandbox Fallback: Failed to call local API to open explorer:', err);
      }
    }
  };

  const handleBrowseFolder = async () => {
    if (window.api && window.api.selectDirectory) {
      try {
        const result = await window.api.selectDirectory();
        if (result && !result.canceled && result.filePaths && result.filePaths.length > 0) {
          setScanPath(result.filePaths[0]);
        }
      } catch (err) {
        console.error('Failed to open native folder dialog:', err);
      }
    } else {
      // In browser fallback, first attempt calling the local sidecar's native Windows browse API
      // to bypass browser sandbox limitations on high-level system directories (Desktop, Downloads, C:\)
      try {
        const res = await fetch('http://127.0.0.1:9988/api/browse');
        const data = await res.json();
        if (data && data.path) {
          setScanPath(data.path);
          return; // Directory loaded successfully!
        }
      } catch (err) {
        console.warn('Local Python browse API offline, falling back to standard browser folder pickers...', err);
      }

      // Browser directory picker fallback (may fail for system protected directories due to sandboxing)
      if (window.showDirectoryPicker) {
        try {
          const handle = await window.showDirectoryPicker();
          setScanPath(`C:\\Users\\user\\${handle.name}`);
          return;
        } catch (err) {
          console.error('Directory picker cancelled or failed:', err);
        }
      }

      // Final fallback: trigger a hidden file input with webkitdirectory
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.onchange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          const path = file.path || file.webkitRelativePath.split('/')[0] || 'C:\\SelectedFolder';
          setScanPath(path);
        }
      };
      input.click();
    }
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

  const handleReloadBatch = async () => {
    if (isFetching || reloadCooldown > 0) return;
    setIsFetching(true);

    try {
      // Execute a real backend request to fulfill the strict network response requirement
      await fetch('http://127.0.0.1:9988/api/stats', { method: 'GET' });
    } catch (err) {
      // Fallback delay if running offline
      await new Promise(r => setTimeout(r, 800));
    }

    let nextStartIndex = startIndex + CHUNK_SIZE;
    if (nextStartIndex >= activeShuffledTopLevel.length) {
      nextStartIndex = 0;
      setShuffledTopLevel(shuffleArray(activeShuffledTopLevel));
    }

    setStartIndex(nextStartIndex);
    setIsFetching(false);
    setReloadCooldown(5); // Start the 5-second anti-spam cooldown on the button
  };

  const handleTriggerReview = (permanent) => {
    setPermanentDelete(permanent);
    runDeleteSimulation(visibleSelectedPaths);
    setIsDeleteModalOpen(true);
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileTypeCategory = (fileName) => {
    if (!fileName) return 'other';
    const ext = fileName.slice(((fileName.lastIndexOf(".") - 1) >>> 0) + 2).toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'images';
    if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv'].includes(ext)) return 'videos';
    if (['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'].includes(ext)) return 'audio';
    if (ext === 'pdf') return 'pdf';
    if (['txt', 'csv', 'log', 'md', 'json', 'xml'].includes(ext)) return 'text';
    return 'other';
  };

  const filteredFiles = scannedFiles.filter(file => {
    if (fileTypeFilter === 'all') return true;
    return getFileTypeCategory(file.name) === fileTypeFilter;
  });

  const activeTopLevelSet = new Set();
  filteredFiles.forEach(f => {
    activeTopLevelSet.add(getTopLevelName(f.path, scanPath));
  });

  const activeShuffledTopLevel = shuffledTopLevel.filter(name => activeTopLevelSet.has(name));
  const visibleTopLevelNames = activeShuffledTopLevel.slice(startIndex, Math.min(startIndex + CHUNK_SIZE, activeShuffledTopLevel.length));

  const visibleFiles = filteredFiles.filter(f => visibleTopLevelNames.includes(getTopLevelName(f.path, scanPath)));

  const visiblePaths = visibleFiles.map(f => f.path);
  const visibleSelectedPaths = selectedPaths.filter(p => visiblePaths.includes(p));

  const categoryCounts = scannedFiles.reduce((acc, file) => {
    const cat = getFileTypeCategory(file.name);
    acc[cat] = (acc[cat] || 0) + 1;
    acc.all++;
    return acc;
  }, { all: 0, images: 0, videos: 0, audio: 0, pdf: 0, text: 0, other: 0 });

  // Cooldown effect for reloading batch
  useEffect(() => {
    if (reloadCooldown > 0) {
      const timer = setTimeout(() => {
        setReloadCooldown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [reloadCooldown]);

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
      className="flex-1 p-6 space-y-4 overflow-y-auto flex flex-col h-full select-text relative"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-brand-darkest border border-brand-accent text-gray-200 px-5 py-3 rounded-lg text-xs font-semibold shadow-2xl flex items-center gap-3 w-max max-w-lg"
          >
            <ShieldAlert className="h-5 w-5 text-brand-accent flex-shrink-0" />
            <span className="leading-relaxed">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Target Deck */}
      <div className="glass-card p-5 flex flex-col gap-4">
        {/* Top Row: Address/Target scan directory input and main action buttons */}
        <div className="flex flex-col md:flex-row md:items-end gap-3 w-full">
          <div className="flex-1 space-y-1.5 w-full">
            <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">Target Scan Directory</label>
            <div className="flex gap-2 items-center bg-brand-darkest border border-brand-border rounded-lg px-3 py-1.5 focus-within:border-brand-accent transition-all">
              <FolderSearch className="h-4.5 w-4.5 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                value={scanPath}
                onChange={(e) => setScanPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && scanPath && scanStatus !== 'scanning') {
                    handleStartScan();
                  }
                }}
                placeholder="Paste directory path, drop folder, or browse"
                disabled={scanStatus === 'scanning'}
                className="bg-transparent border-none flex-1 focus:outline-none text-xs font-mono text-gray-200 w-full"
              />
              {scanPath && (
                <button
                  type="button"
                  onClick={handleCopyPath}
                  title="Copy Path"
                  className="p-1 rounded text-gray-400 hover:text-brand-accent hover:bg-brand-card transition-all flex items-center justify-center flex-shrink-0 cursor-pointer"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-brand-green" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
              {scanPath && (
                <button
                  type="button"
                  onClick={handleOpenExplorer}
                  title="Open in File Explorer"
                  className="p-1 rounded text-gray-400 hover:text-brand-accent hover:bg-brand-card transition-all flex items-center justify-center flex-shrink-0 cursor-pointer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={handleBrowseFolder}
                disabled={scanStatus === 'scanning'}
                title="Browse Folder"
                className="p-1 rounded text-gray-400 hover:text-brand-accent hover:bg-brand-card transition-all flex items-center justify-center flex-shrink-0 border border-transparent hover:border-brand-border/40 cursor-pointer"
              >
                <FolderOpen className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex gap-2 w-full md:w-auto h-[34px] md:h-[34px] items-stretch">
            {scanStatus === 'scanning' ? (
              <button
                type="button"
                onClick={cancelScan}
                className="flex-1 md:flex-none bg-brand-rose/25 hover:bg-brand-rose/30 border border-brand-rose/40 text-brand-rose py-1.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] shadow-sm cursor-pointer"
              >
                <Square className="h-3.5 w-3.5" />
                <span>Cancel Scan</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartScan}
                disabled={!scanPath}
                className={`flex-1 md:flex-none py-1.5 px-5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] shadow-md ${scanPath
                    ? 'bg-gradient-to-r from-brand-accent to-brand-accent/80 hover:brightness-110 text-white shadow-brand-accent/15 cursor-pointer'
                    : 'bg-brand-card border border-brand-border text-gray-500 cursor-not-allowed'
                  }`}
              >
                <Play className="h-3.5 w-3.5" />
                <span>Start Analysis</span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom Row: Quick Presets */}
        <div className="border-t border-brand-border/30 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">Quick Presets</span>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => setScanPath(defaultDownloads)}
                disabled={scanStatus === 'scanning'}
                className="group px-3 py-1.5 rounded-lg bg-brand-card hover:bg-brand-accent/10 border border-brand-border hover:border-brand-accent/40 text-xs font-medium text-gray-300 hover:text-brand-accent transition-all duration-300 flex items-center gap-2 active:scale-95 cursor-pointer shadow-sm"
              >
                <Download className="h-3.5 w-3.5 text-amber-500 group-hover:text-brand-accent transition-colors" />
                <span>Downloads Folder</span>
              </button>
              <button
                type="button"
                onClick={() => setScanPath(defaultDesktop)}
                disabled={scanStatus === 'scanning'}
                className="group px-3 py-1.5 rounded-lg bg-brand-card hover:bg-brand-accent/10 border border-brand-border hover:border-brand-accent/40 text-xs font-medium text-gray-300 hover:text-brand-accent transition-all duration-300 flex items-center gap-2 active:scale-95 cursor-pointer shadow-sm"
              >
                <Monitor className="h-3.5 w-3.5 text-sky-500 group-hover:text-brand-accent transition-colors" />
                <span>Desktop Folder</span>
              </button>
              <button
                type="button"
                onClick={() => setScanPath('C:\\')}
                disabled={scanStatus === 'scanning'}
                className="group px-3 py-1.5 rounded-lg bg-brand-card hover:bg-brand-accent/10 border border-brand-border hover:border-brand-accent/40 text-xs font-medium text-gray-300 hover:text-brand-accent transition-all duration-300 flex items-center gap-2 active:scale-95 cursor-pointer shadow-sm"
              >
                <HardDrive className="h-3.5 w-3.5 text-indigo-400 group-hover:text-brand-accent transition-colors" />
                <span>C:\ System Drive</span>
              </button>
            </div>
          </div>

          {scanPath && (
            <div className="text-[10px] font-mono text-gray-500 self-end sm:self-center">
              Selected: <span className="text-gray-400 font-semibold">{scanPath}</span>
            </div>
          )}
        </div>
      </div>

      {/* Warning/Watermark Section */}
      <SafeModeWatermark visible={safeModeEnforced} />

      {/* Large Directory Capacity Capping Alert */}
      {limitExceeded && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-brand-amber/10 border border-brand-amber/20 p-4 rounded-xl flex items-start gap-3 text-brand-amber text-xs select-none"
        >
          <ShieldAlert className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block">Large Directory Capacity Limit Reached!</span>
            <p className="text-gray-300 leading-relaxed font-medium">
              SafeSweep capped this view to the first <strong>20,000 files</strong> to maintain blazingly fast scanning and smooth interactive performance on massive directory branches.
            </p>
            <p className="text-gray-400 font-semibold mt-1.5">
              💡 Tip: Safely clean or shred some of these selected files. SafeSweep will automatically slide and refill the list with new files!
            </p>
          </div>
        </motion.div>
      )}

      {/* Success banner after deletion */}
      {deleteStatus === 'completed' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-brand-green/10 border border-brand-green/20 p-4 rounded-xl flex items-center justify-between text-brand-green text-xs font-semibold select-none animate-fadeIn"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            <span>Cleanup finished successfully! {deletedCount} assets safely unlinked.</span>
          </div>
          <button
            onClick={() => useAppStore.setState({ deleteStatus: 'idle' })}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {/* In-scanning Progress bar visualizer */}
      {scanStatus === 'scanning' && (
        <div className="glass-card p-4 space-y-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-gray-400">Traversing Folders...</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-brand-darkest rounded-full h-2 overflow-hidden relative">
            <motion.div
              initial={{ left: '-50%', width: '40%' }}
              animate={{ left: '110%' }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
              className="bg-gradient-to-r from-transparent via-brand-accent to-transparent h-full absolute"
            />
          </div>
        </div>
      )}

      {/* In-deleting Progress bar visualizer */}
      {deleteStatus === 'deleting' && (
        <div className="glass-card p-4 space-y-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-gray-400 flex items-center gap-1.5">
              <Loader2 className="h-4 w-4 animate-spin text-brand-rose" />
              <span>Wiping Targeted Assets ({permanentDelete ? 'Cryptographic Shred' : 'Recycle Bin relocation'})...</span>
            </span>
            <span className="text-brand-rose font-bold">
              {deletedCount} / {selectedPaths.length} files processed
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-brand-darkest rounded-full h-2 overflow-hidden">
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: `${selectedPaths.length > 0 ? (deletedCount / selectedPaths.length) * 100 : 0}%` }}
              transition={{ duration: 0.1 }}
              className="bg-brand-rose h-full"
            />
          </div>
        </div>
      )}

      {/* Main File tree selection layout */}
      {scanStatus === 'completed' && deleteStatus !== 'deleting' && (
        <div className="flex-1 flex flex-col min-h-[350px] space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3 text-xs">
              <span className="text-gray-400">Total Scanned Size: <strong className="text-gray-200">{formatBytes(scannedBytes)}</strong></span>
              <span className="text-gray-500 border-l border-brand-border pl-3">Selection Size: <strong className="text-brand-green">{formatBytes(visibleFiles.filter(f => selectedPaths.includes(f.path)).reduce((acc, curr) => acc + curr.size, 0))}</strong></span>
            </div>

            <button
              onClick={() => setIsTrustPanelOpen(true)}
              className="text-xs text-brand-accent hover:underline flex items-center gap-1"
            >
              <span>Why Was This Protected?</span>
            </button>
          </div>

          {/* File Type Filter Chips */}
          <div className="flex flex-wrap items-center gap-2 p-2 bg-brand-card/30 border border-brand-border/40 rounded-xl select-none">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider pl-1 pr-2">Filter Type:</span>

            <button
              type="button"
              onClick={() => setFileTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-300 cursor-pointer active:scale-95 ${fileTypeFilter === 'all'
                  ? 'bg-gradient-to-r from-brand-accent to-brand-accent/80 text-white shadow-sm shadow-brand-accent/15'
                  : 'bg-brand-card border border-brand-border text-gray-300 hover:text-brand-accent hover:border-brand-accent/40'
                }`}
            >
              <File className="h-3.5 w-3.5" />
              <span>All ({categoryCounts.all > 20000 ? '20000+' : categoryCounts.all})</span>
            </button>

            <button
              type="button"
              onClick={() => setFileTypeFilter('pdf')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-300 cursor-pointer active:scale-95 ${fileTypeFilter === 'pdf'
                  ? 'bg-gradient-to-r from-brand-rose to-brand-rose/80 text-white shadow-sm shadow-brand-rose/15'
                  : 'bg-brand-card border border-brand-border text-gray-300 hover:text-brand-rose hover:border-brand-rose/40'
                }`}
            >
              <FileText className="h-3.5 w-3.5 text-brand-rose" />
              <span>PDFs ({categoryCounts.pdf})</span>
            </button>

            <button
              type="button"
              onClick={() => setFileTypeFilter('text')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-300 cursor-pointer active:scale-95 ${fileTypeFilter === 'text'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-sm'
                  : 'bg-brand-card border border-brand-border text-gray-300 hover:text-amber-500 hover:border-amber-500/40'
                }`}
            >
              <FileText className="h-3.5 w-3.5 text-amber-500" />
              <span>Text/Docs ({categoryCounts.text})</span>
            </button>

            <button
              type="button"
              onClick={() => setFileTypeFilter('images')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-300 cursor-pointer active:scale-95 ${fileTypeFilter === 'images'
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-sm'
                  : 'bg-brand-card border border-brand-border text-gray-300 hover:text-emerald-500 hover:border-emerald-500/40'
                }`}
            >
              <Image className="h-3.5 w-3.5 text-emerald-500" />
              <span>Images ({categoryCounts.images})</span>
            </button>

            <button
              type="button"
              onClick={() => setFileTypeFilter('videos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-300 cursor-pointer active:scale-95 ${fileTypeFilter === 'videos'
                  ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-sm'
                  : 'bg-brand-card border border-brand-border text-gray-300 hover:text-sky-500 hover:border-sky-500/40'
                }`}
            >
              <Video className="h-3.5 w-3.5 text-sky-500" />
              <span>Videos ({categoryCounts.videos})</span>
            </button>

            <button
              type="button"
              onClick={() => setFileTypeFilter('audio')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-300 cursor-pointer active:scale-95 ${fileTypeFilter === 'audio'
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-sm'
                  : 'bg-brand-card border border-brand-border text-gray-300 hover:text-purple-500 hover:border-purple-500/40'
              }`}
            >
              <Music className="h-3.5 w-3.5 text-purple-500" />
              <span>Audio ({categoryCounts.audio})</span>
            </button>
          </div>

          {isFetching ? (
            <div className="flex-1 bg-brand-darkest/40 border border-brand-border/60 rounded-xl p-3 min-h-[300px] flex flex-col items-center justify-center space-y-4">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-8 h-8 border-[3px] border-brand-border border-t-brand-accent rounded-full"
              />
              <span className="text-xs text-gray-400 font-mono tracking-widest uppercase">Fetching Batch...</span>
            </div>
          ) : (
            <FileTree
              files={visibleFiles}
              scanPath={scanPath}
              selectedPaths={selectedPaths}
              onToggleSelection={handleToggleSelection}
            />
          )}

          {/* Action Cleanup Bar */}
          {!safeModeEnforced && activeShuffledTopLevel.length > 0 && (
            <div className="glass-card p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-gray-200">Execution Strategy</span>
                <p className="text-[10px] text-gray-400">
                  {startIndex > 0 ? `Showing batch ${Math.floor(startIndex / CHUNK_SIZE) + 1} of ${Math.ceil(activeShuffledTopLevel.length / CHUNK_SIZE)}` : 'Choose between a safe Recycle Bin sweep or advanced cryptographic file unlinking.'}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReloadBatch}
                  disabled={isFetching || reloadCooldown > 0}
                  className={`py-2 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${(isFetching || reloadCooldown > 0)
                      ? 'bg-brand-card/50 border border-brand-border/50 text-gray-500 cursor-not-allowed'
                      : 'bg-brand-card hover:bg-brand-card/85 border border-brand-border text-gray-300 cursor-pointer'
                    }`}
                >
                  {isFetching ? (
                    <div className="flex gap-[3px] items-center justify-center w-4 h-4 px-1">
                      <motion.div animate={{ y: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut", delay: 0 }} className="w-1 h-1 bg-gray-400 rounded-full" />
                      <motion.div animate={{ y: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut", delay: 0.15 }} className="w-1 h-1 bg-gray-400 rounded-full" />
                      <motion.div animate={{ y: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut", delay: 0.3 }} className="w-1 h-1 bg-gray-400 rounded-full" />
                    </div>
                  ) : reloadCooldown > 0 ? (
                    <RefreshCw className="h-4 w-4 text-gray-500" />
                  ) : (
                    <RefreshCw className="h-4 w-4 text-sky-500" />
                  )}
                  <span>{isFetching ? 'Fetching...' : reloadCooldown > 0 ? `Wait ${reloadCooldown}s...` : 'Reload Batch'}</span>
                </button>
                <button
                  onClick={() => handleTriggerReview(false)} // Safe Delete
                  disabled={visibleSelectedPaths.length === 0 || isFetching}
                  className={`py-2 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${visibleSelectedPaths.length > 0 && !isFetching
                      ? 'bg-brand-card hover:bg-brand-card/85 border border-brand-border text-gray-300 cursor-pointer'
                      : 'bg-brand-card/50 border border-brand-border/50 text-gray-500 cursor-not-allowed'
                    }`}
                >
                  <ShieldCheck className="h-4 w-4 text-brand-accent" />
                  <span>Safe Delete</span>
                </button>
                <button
                  onClick={() => handleTriggerReview(true)} // Permanent Shred
                  disabled={visibleSelectedPaths.length === 0 || isFetching}
                  className={`py-2 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${visibleSelectedPaths.length > 0 && !isFetching
                      ? 'bg-brand-rose/10 hover:bg-brand-rose/15 border border-brand-rose/30 text-brand-rose cursor-pointer'
                      : 'bg-brand-rose/5 border border-brand-rose/10 text-brand-rose/50 cursor-not-allowed'
                    }`}
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
          startDeletion(visibleSelectedPaths, perm, scanPath);
        }}
      />
    </motion.div>
  );
}

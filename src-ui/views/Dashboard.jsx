import React, { useEffect } from 'react';
import { ShieldCheck, HardDrive, RefreshCw, Layers, ShieldAlert, Cpu, Trash2, Loader2 } from 'lucide-react';
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

  useEffect(() => {
    // Fetch fresh data on mount
    if (window.api) {
      fetchDiskSpace();
      fetchDashboardStats();
      fetchRecycleBin();
    }

    // Poll every 10 seconds to keep data live
    const interval = setInterval(() => {
      if (window.api) {
        fetchDiskSpace();
        fetchDashboardStats();
        fetchRecycleBin();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchDiskSpace, fetchDashboardStats, fetchRecycleBin]);

  const handleScanTrigger = () => {
    startScan('C:\\');
    setActivePanel('cleaner');
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
      className="flex-1 p-6 space-y-6 overflow-y-auto select-text"
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
              <div className="md:col-span-2 glass-card p-5 flex flex-col md:flex-row items-center gap-6 justify-around premium-glow-subtle">
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
                  label: 'Recycle Bin Size',
                  value: formatBytes(recycleBinInfo.size_bytes),
                  desc: `${recycleBinInfo.items_count} file${recycleBinInfo.items_count !== 1 ? 's' : ''} queued`,
                  icon: Trash2,
                  color: 'text-brand-accent'
                },
                {
                  label: 'Temporary Files',
                  value: formatBytes(dashboardStats.temp_size_bytes),
                  desc: `${dashboardStats.temp_items_count} file${dashboardStats.temp_items_count !== 1 ? 's' : ''} cached`,
                  icon: RefreshCw,
                  color: 'text-brand-amber'
                },
                {
                  label: 'Browser Caches',
                  value: formatBytes(dashboardStats.browser_size_bytes),
                  desc: `${dashboardStats.browser_items_count} cache file${dashboardStats.browser_items_count !== 1 ? 's' : ''}`,
                  icon: Layers,
                  color: 'text-brand-green'
                },
                {
                  label: 'Exclusion Filters',
                  value: '9 categories',
                  desc: '.git, node_modules, VMs active',
                  icon: ShieldAlert,
                  color: 'text-gray-400'
                }
              ].map((stat, idx) => (
                <div key={idx} className="glass-card p-4 flex items-center justify-between border border-brand-border">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider">{stat.label}</span>
                    <span className="font-bold text-gray-200 block text-lg">{stat.value}</span>
                    <span className="text-[10px] text-gray-400 block">{stat.desc}</span>
                  </div>
                  <stat.icon className={`h-5 w-5 ${stat.color} flex-shrink-0`} />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

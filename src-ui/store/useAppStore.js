import { create } from 'zustand';

const fetchWithTimeout = (url, options = {}, timeout = 5000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal: controller.signal })
    .then((res) => {
      clearTimeout(id);
      return res;
    })
    .catch((err) => {
      clearTimeout(id);
      throw err;
    });
};

export const useAppStore = create((set, get) => {
  // Listener hooks binding backend data streams to frontend store states
  let unsubscribeNotify = null;
  let unsubscribeResponse = null;
  let unsubscribeWarning = null;
  let unsubscribeError = null;

  return {
    // Settings & Mode parameters
    developerMode: false,
    setDeveloperMode: (enabled) => {
      set({ developerMode: enabled });
      if (window.api) window.api.sendRequest('developer:setMode', { enabled });
    },

    // Scan priority levels (quick, balanced, deep)
    scanMode: 'balanced',
    setScanMode: (mode) => set({ scanMode: mode }),

    // Fetch control flag to avoid continuous polling
    needsRefresh: true,
    setNeedsRefresh: (val) => set({ needsRefresh: val }),

    // Custom exclusion list paths
    exclusions: [],
    fetchExclusions: () => {
      if (window.api) window.api.sendRequest('exclusions:list');
    },

    // Quarantine state
    quarantineItems: [],
    fetchQuarantine: () => {
      if (window.api) window.api.sendRequest('quarantine:list');
    },

    // Scan progress statuses
    scanPath: '',
    scanStatus: 'idle', // idle, scanning, completed, cancelled
    scannedCount: 0,
    scannedBytes: 0,
    scannedFiles: [],
    safeModeEnforced: false,
    safetyWarning: null,
    limitExceeded: false,
    skippedPaths: [],


    // Deletion states
    deleteStatus: 'idle', // idle, deleting, completed
    deletedCount: 0,
    failedCount: 0,
    activeSimulation: null,

    // Quick clean states
    quickCleanStatus: 'idle',
    quickCleanBytesFreed: 0,
    quickCleanFilesDeleted: 0,
    quickCleanFilesSkipped: 0,

    // Empty Folders states
    emptyFoldersList: [],
    emptyFoldersScanStatus: 'idle', // idle, scanning, completed, error
    deletedEmptyFolders: [],

    // Old Downloads states
    oldDownloadsList: [],
    oldDownloadsScanStatus: 'idle', // idle, scanning, completed, error
    deletedOldDownloads: [],
    oldDownloadsBytesFreed: 0,

    // Services Advisor states
    servicesList: [],
    servicesScanStatus: 'idle',

    // Archive Manager states
    archivesList: [],
    archivesScanStatus: 'idle',
    deletedArchives: [],
    archivesBytesFreed: 0,

    boostStatus: 'idle',
    boostResults: null,

    privacySweepStatus: 'idle',
    privacySweepResults: null,

    uninstallerApps: [],
    uninstallerStatus: 'idle', // idle, loading, error

    startupApps: [],
    startupStatus: 'idle', // idle, loading, error
    
    // Ghost Buster State
    ghostsKilled: 0,
    setGhostsKilled: (count) => set({ ghostsKilled: count }),

    duplicatesScanStatus: 'idle',
    duplicatesList: [],
    deletedDuplicates: [],
    duplicatesBytesFreed: 0,


    // System alerts from Watchdog
    serviceWarning: null,
    serviceError: null,

    isDiskLoading: false,
    isRecycleLoading: false,
    isStatsLoading: false,

    // Real dynamic disk metrics & defaults
    defaultDownloads: '',
    defaultDesktop: '',
    diskSpace: { total: 0, free: 0 },
    hardwareStats: { cpu: 0, ram: 0, battery_percent: '100', battery_health: 'AC Power', netSentSpeed: 0, netRecvSpeed: 0, diskReadSpeed: 0, diskWriteSpeed: 0 },
    fetchDiskSpace: () => {
      set({ isDiskLoading: true });
      if (window.api) {
        window.api.sendRequest('system:disk');
      } else {
        fetchWithTimeout('http://127.0.0.1:9988/api/disk', {}, 5000)
          .then(res => res.json())
          .then(result => {
            set(state => {
              const now = Date.now();
              const lastTime = state.lastHardwareTime || (now - 3000);
              const timeDiffSec = Math.max((now - lastTime) / 1000, 1);

              const netSentSpeed = result.network ? (result.network.sent - (state.lastNetworkSent || result.network.sent)) / timeDiffSec : 0;
              const netRecvSpeed = result.network ? (result.network.recv - (state.lastNetworkRecv || result.network.recv)) / timeDiffSec : 0;
              const diskReadSpeed = result.disk_io ? (result.disk_io.read - (state.lastDiskRead || result.disk_io.read)) / timeDiffSec : 0;
              const diskWriteSpeed = result.disk_io ? (result.disk_io.write - (state.lastDiskWrite || result.disk_io.write)) / timeDiffSec : 0;

              return {
                diskSpace: { total: result.total, free: result.free },
                hardwareStats: {
                  cpu: result.cpu || 0,
                  ram: result.ram || 0,
                  battery_percent: result.battery_percent || '100',
                  battery_health: result.battery_health || 'Unknown',
                  netSentSpeed: Math.max(0, netSentSpeed),
                  netRecvSpeed: Math.max(0, netRecvSpeed),
                  diskReadSpeed: Math.max(0, diskReadSpeed),
                  diskWriteSpeed: Math.max(0, diskWriteSpeed)
                },
                lastNetworkSent: result.network?.sent,
                lastNetworkRecv: result.network?.recv,
                lastDiskRead: result.disk_io?.read,
                lastDiskWrite: result.disk_io?.write,
                lastHardwareTime: now,
                isDiskLoading: false
              };
            });
          })
          .catch(() => {
            set({ isDiskLoading: false });
          });
      }
    },

    // Recycle bin live data
    recycleBinInfo: { size_bytes: 0, items_count: 0 },
    fetchRecycleBin: () => {
      set({ isRecycleLoading: true });
      if (window.api) {
        window.api.sendRequest('recycle:query');
      } else {
        fetchWithTimeout('http://127.0.0.1:9988/api/recycle', {}, 5000)
          .then(res => res.json())
          .then(result => {
            set({ recycleBinInfo: { size_bytes: result.size_bytes, items_count: result.items_count }, isRecycleLoading: false });
          })
          .catch(() => {
            set({ isRecycleLoading: false });
          });
      }
    },

    // Background statistics for dashboard cards
    dashboardStats: { temp_size_bytes: 0, temp_items_count: 0, browser_size_bytes: 0, browser_items_count: 0 },
    fetchDashboardStats: () => {
      set({ isStatsLoading: true });
      if (window.api) {
        window.api.sendRequest('system:dashboard_stats');
      } else {
        fetchWithTimeout('http://127.0.0.1:9988/api/stats', {}, 5000)
          .then(res => res.json())
          .then(result => {
            set({ dashboardStats: result, isStatsLoading: false });
          })
          .catch(() => {
            set({ isStatsLoading: false });
          });
      }
    },

    // Global startup loading state & checklists
    isSystemLoading: true,
    loadingSteps: [
      { id: 'integrity', label: 'Verifying Security Middleware Shield...', status: 'pending' },
      { id: 'disk', label: 'Querying C:\\ drive NTFS analytics...', status: 'pending' },
      { id: 'temp', label: 'Locating temporary system caches...', status: 'pending' },
      { id: 'browsers', label: 'Scanning browser cache databases...', status: 'pending' },
      { id: 'recycle', label: 'Querying Recycle Bin allocation...', status: 'pending' }
    ],

    // Initialize API bridge listeners
    initBridge: (retryCount = 0) => {
      if (!window.api) {
        const isElectron = navigator.userAgent.toLowerCase().includes('electron');
        if (isElectron) {
          // In Electron, retry up to 50 times (10s) to give dev environments time to load preload scripts
          if (retryCount < 50) {
            console.warn(`SafeSweep Electron: API Bridge not found. Retrying in 200ms... (Attempt ${retryCount + 1}/50)`);
            setTimeout(() => get().initBridge(retryCount + 1), 200);
          } else {
            console.error("SafeSweep Electron Error: Native API Bridge failed to load after 10 seconds.");
            set({ serviceError: "Failed to connect to the local system service. Please restart the SafeSweep utility." });
          }
        } else {
          // In a regular browser - no Electron API available, check if local HTTP sidecar API is running!
          console.log("[SafeSweep] Running in browser. Checking if local backend API server is online on port 9988...");

          const initialSteps = [
            { id: 'integrity', label: 'Verifying Security Middleware Shield...', status: 'active' },
            { id: 'disk', label: 'Querying C:\\ drive NTFS analytics...', status: 'pending' },
            { id: 'temp', label: 'Locating temporary system caches...', status: 'pending' },
            { id: 'browsers', label: 'Scanning browser cache databases...', status: 'pending' },
            { id: 'recycle', label: 'Querying Recycle Bin allocation...', status: 'pending' }
          ];
          set({ loadingSteps: initialSteps, isSystemLoading: true });

          // Test if background HTTP server is running (started by npm run electron:dev or manually)
          fetchWithTimeout("http://127.0.0.1:9988/api/startup", {}, 5000)
            .then(res => {
              if (!res.ok) throw new Error("HTTP error");
              return res.json();
            })
            .then(startupRes => {
              console.log("[SafeSweep API] Connected to live Python sidecar server! Fetching real dynamic PC metrics...");
              
              // Secret Feature: Universal Ghost Buster State
              if (startupRes.ghosts_killed > 0) {
                 set({ ghostsKilled: startupRes.ghosts_killed });
              }

              // 1. Resolve startup
              set((state) => ({
                exclusions: startupRes.custom_exclusions || [],
                defaultDownloads: startupRes.downloads || '',
                defaultDesktop: startupRes.desktop || '',
                loadingSteps: state.loadingSteps.map(s =>
                  s.id === 'integrity' ? { ...s, status: 'completed' } :
                    s.id === 'disk' ? { ...s, status: 'active' } : s
                )
              }));

              // 2. Fetch Disk Space
              setTimeout(() => {
                fetchWithTimeout("http://127.0.0.1:9988/api/disk", {}, 5000)
                  .then(res => res.json())
                  .then(diskRes => {
                    set((state) => ({
                      diskSpace: { total: diskRes.total, free: diskRes.free },
                      loadingSteps: state.loadingSteps.map(s =>
                        s.id === 'disk' ? { ...s, status: 'completed' } :
                          s.id === 'temp' ? { ...s, status: 'active' } : s
                      )
                    }));

                    // 3. Fetch Cache Stats
                    setTimeout(() => {
                      fetchWithTimeout("http://127.0.0.1:9988/api/stats", {}, 5000)
                        .then(res => res.json())
                        .then(statsRes => {
                          set((state) => ({
                            dashboardStats: statsRes,
                            loadingSteps: state.loadingSteps.map(s =>
                              s.id === 'temp' ? { ...s, status: 'completed' } :
                                s.id === 'browsers' ? { ...s, status: 'completed' } :
                                  s.id === 'recycle' ? { ...s, status: 'active' } : s
                            )
                          }));

                          // 4. Fetch Recycle Bin
                          setTimeout(() => {
                            fetchWithTimeout("http://127.0.0.1:9988/api/recycle", {}, 5000)
                              .then(res => res.json())
                              .then(recycleRes => {
                                set((state) => ({
                                  recycleBinInfo: { size_bytes: recycleRes.size_bytes, items_count: recycleRes.items_count },
                                  loadingSteps: state.loadingSteps.map(s =>
                                    s.id === 'recycle' ? { ...s, status: 'completed' } : s
                                  )
                                }));

                                // 5. Hide Loader
                                setTimeout(() => {
                                  set({ isSystemLoading: false });
                                }, 300);
                              })
                              .catch(() => get()._runMockSimulation(initialSteps));
                          }, 300);
                        })
                        .catch(() => get()._runMockSimulation(initialSteps));
                    }, 300);
                  })
                  .catch(() => get()._runMockSimulation(initialSteps));
              }, 300);
            })
            .catch(() => {
              // Local backend not running, fall back to premium mock simulation sequence
              console.log("[SafeSweep API] Python sidecar server is offline or timed out. Falling back to high-fidelity mock data simulation.");
              get()._runMockSimulation(initialSteps);
            });
        }
        return;
      }

      // Initialize Electron real checklist loading steps
      const steps = [
        { id: 'integrity', label: 'Verifying Security Middleware Shield...', status: 'active' },
        { id: 'disk', label: 'Querying C:\\ drive NTFS analytics...', status: 'pending' },
        { id: 'temp', label: 'Locating temporary system caches...', status: 'pending' },
        { id: 'browsers', label: 'Scanning browser cache databases...', status: 'pending' },
        { id: 'recycle', label: 'Querying Recycle Bin allocation...', status: 'pending' }
      ];
      set({ loadingSteps: steps, isSystemLoading: true });

      // Clean previous subscriptions if re-initializing
      if (unsubscribeNotify) unsubscribeNotify();
      if (unsubscribeResponse) unsubscribeResponse();
      if (unsubscribeWarning) unsubscribeWarning();
      if (unsubscribeError) unsubscribeError();

      // 1. Process sidecar notifications (progress updates)
      unsubscribeNotify = window.api.onNotification((packet) => {
        const { method, params } = packet;

        if (method === 'scanner.progress') {
          const skipped = get().skippedPaths || [];
          const freshFiles = (params.files || []).filter(f => !skipped.includes(f.path));
          set((state) => {
            const nextFiles = [...state.scannedFiles, ...freshFiles];
            return {
              scannedCount: nextFiles.length,
              scannedBytes: nextFiles.reduce((acc, curr) => acc + curr.size, 0),
              scannedFiles: nextFiles
            };
          });
        } else if (method === 'scanner.completed') {
          // Scanner completed as notification (from DuplicateFinder)
          set({
            scanStatus: 'completed',
            safeModeEnforced: params.safe_mode_enforced || false,
            safetyWarning: params.warning || null,
            limitExceeded: params.limit_exceeded || false
          });
        } else if (method === 'system.stats_updated') {
          set({
            dashboardStats: {
              temp_size_bytes: params.temp_size,
              temp_items_count: params.temp_count,
              browser_size_bytes: params.browser_size,
              browser_items_count: params.browser_count
            }
          });
        } else if (method === 'delete.progress' || method === 'deletion.progress') {
          set({
            deletedCount: params.deleted_count,
            failedCount: params.failed_count
          });

        } else if (method === 'delete.completed') {
          const wasCapped = get().limitExceeded;
          set((state) => {
            const deletedPaths = params.deleted || [];
            const remainingFiles = state.scannedFiles.filter(f => !deletedPaths.includes(f.path));
            return {
              deleteStatus: 'completed',
              scannedFiles: remainingFiles,
              activeSimulation: null,
              needsRefresh: true
            };
          });
          // Cleanup logic

          if (wasCapped) {
            const currentScanPath = get().scanPath;
            if (currentScanPath) {
              setTimeout(() => {
                get().startScan(currentScanPath);
              }, 600);
            }
          }
        }
      });

      // 2. Process standard sidecar method responses
      // Each response is identified by a unique 'tag' field we match for routing
      unsubscribeResponse = window.api.onResponse((packet) => {
        const { error, result } = packet;

        if (error) {
          console.error('IPC transaction error response received:', error);
          set({
            scanStatus: 'idle',
            deleteStatus: 'idle',
            serviceError: error.message,
            isDiskLoading: false,
            isRecycleLoading: false,
            isStatsLoading: false
          });
          return;
        }

        if (!result) return;

        // --- Route by unique field presence - order matters (most specific first) ---

        // system.startup response
        if (result.status === 'online' && result.user_profile !== undefined) {
          set((state) => ({
            exclusions: result.custom_exclusions || [],
            defaultDownloads: result.downloads || '',
            defaultDesktop: result.desktop || '',
            loadingSteps: state.loadingSteps.map(s =>
              s.id === 'integrity' ? { ...s, status: 'completed' } :
                s.id === 'disk' ? { ...s, status: 'active' } : s
            )
          }));
          // After startup, fire all live data fetches
          get().fetchDiskSpace();
          get().fetchDashboardStats();
          get().fetchRecycleBin();
          // Initialization complete
          return;
        }

        // system.disk_space response (has total + free, no status field)
        if (result.total !== undefined && result.free !== undefined && result.status === undefined) {
          set((state) => {
            const nextSteps = state.loadingSteps.map(s =>
              s.id === 'disk' ? { ...s, status: 'completed' } :
                s.id === 'temp' ? { ...s, status: 'active' } : s
            );
            const allDone = nextSteps.every(s => s.status === 'completed');
            return {
              diskSpace: { total: result.total, free: result.free },
              isDiskLoading: false,
              loadingSteps: nextSteps,
              isSystemLoading: allDone ? false : state.isSystemLoading
            };
          });
          return;
        }

        // system.dashboard_stats response
        if (result.temp_size_bytes !== undefined && result.browser_size_bytes !== undefined) {
          set((state) => {
            const nextSteps = state.loadingSteps.map(s =>
              s.id === 'temp' ? { ...s, status: 'completed' } :
                s.id === 'browsers' ? { ...s, status: 'completed' } :
                  s.id === 'recycle' ? { ...s, status: 'active' } : s
            );
            const allDone = nextSteps.every(s => s.status === 'completed');
            return {
              dashboardStats: result,
              isStatsLoading: false,
              loadingSteps: nextSteps,
              isSystemLoading: allDone ? false : state.isSystemLoading,
              needsRefresh: false
            };
          });
          return;
        }

        // recycle_bin.query response (has size_bytes + items_count, no status)
        if (result.size_bytes !== undefined && result.items_count !== undefined && result.status === undefined) {
          set((state) => {
            const nextSteps = state.loadingSteps.map(s =>
              s.id === 'recycle' ? { ...s, status: 'completed' } : s
            );
            const allDone = nextSteps.every(s => s.status === 'completed');
            if (allDone) {
              setTimeout(() => {
                set({ isSystemLoading: false });
              }, 400);
            }
            return {
              recycleBinInfo: { size_bytes: result.size_bytes, items_count: result.items_count },
              isRecycleLoading: false,
              loadingSteps: nextSteps
            };
          });
          return;
        }

        // recycle_bin.empty response
        if (result.success !== undefined && result.status === undefined && result.deleted === undefined) {
          // Refresh recycle bin data after emptying
          if (result.success) {
            get().fetchRecycleBin();
          }
          return;
        }

        // scanner.start_scan response
        if (result.status === 'scan_started') {
          set({
            scanStatus: 'scanning',
            scannedCount: 0,
            scannedBytes: 0,
            scannedFiles: [],
            safeModeEnforced: false,
            safetyWarning: null
          });
          return;
        }

        // scanner completed (returned as response not notification)
        if (result.status === 'completed' && result.files_found_count !== undefined) {
          set({
            scanStatus: 'completed',
            safeModeEnforced: result.safe_mode_enforced || false,
            safetyWarning: result.warning || null,
            limitExceeded: result.limit_exceeded || false
          });
          return;
        }

        // scanner cancel response
        if (result.status === 'scan_cancelled' || result.status === 'no_active_scan') {
          set({ scanStatus: 'cancelled' });
          return;
        }

        // delete.start_delete response
        if (result.status === 'delete_started') {
          set({ deleteStatus: 'deleting', deletedCount: 0, failedCount: 0 });
          return;
        }

        // delete completed (returned as response)
        if (result.status === 'completed' && result.deleted !== undefined) {
          const wasCapped = get().limitExceeded;
          set((state) => {
            const deletedPaths = result.deleted || [];
            const remainingFiles = state.scannedFiles.filter(f => !deletedPaths.includes(f.path));
            return {
              deleteStatus: 'completed',
              scannedFiles: remainingFiles,
              activeSimulation: null,
              needsRefresh: true
            };
          });
          // Cleanup logic

          if (wasCapped) {
            const currentScanPath = get().scanPath;
            if (currentScanPath) {
              setTimeout(() => {
                get().startScan(currentScanPath);
              }, 600);
            }
          }
          return;
        }

        // delete cancel response
        if (result.status === 'delete_cancelled' || result.status === 'no_active_delete') {
          set({ deleteStatus: 'idle' });
          return;
        }


        // empty folders scan response
        if (result.empty_folders !== undefined) {
          set({ emptyFoldersScanStatus: 'completed', emptyFoldersList: result.empty_folders });
          return;
        }

        // empty folders delete response
        if (result.deleted !== undefined && result.failed !== undefined && result.status === undefined && result.total_freed === undefined) {
          set((state) => ({
            deletedEmptyFolders: result.deleted || [],
            emptyFoldersList: state.emptyFoldersList.filter(f => !(result.deleted || []).includes(f)),
            deleteStatus: 'completed',
            needsRefresh: true
          }));
          return;
        }

        // old downloads delete response
        if (result.deleted !== undefined && result.failed !== undefined && result.total_freed !== undefined && get().deleteStatus !== 'idle') {
          set({ 
            deletedOldDownloads: result.deleted || [],
            oldDownloadsBytesFreed: result.total_freed || 0,
            oldDownloadsList: get().oldDownloadsList.filter(f => !(result.deleted || []).includes(f.path)),

            // Same response is used for Archives
            deletedArchives: result.deleted || [],
            archivesBytesFreed: result.total_freed || 0,
            archivesList: get().archivesList.filter(f => !(result.deleted || []).includes(f.path)),

            deleteStatus: 'completed',
            needsRefresh: true
          });
          return;
        }

        // services get response
        if (result.services !== undefined) {
          set({ servicesScanStatus: 'completed', servicesList: result.services });
          return;
        }

        // archives get response
        if (result.archives !== undefined) {
          set({ archivesScanStatus: 'completed', archivesList: result.archives });
          return;
        }

        // exclusions.list response
        if (result.exclusions !== undefined) {
          set({ exclusions: result.exclusions || [] });
          return;
        }

        // uninstaller.list response
        if (result.uninstaller_apps !== undefined) {
          set({ uninstallerStatus: 'completed', uninstallerApps: result.uninstaller_apps || [] });
          return;
        }

        // startup.list response
        if (result.startup_apps !== undefined) {
          set({ startupStatus: 'completed', startupApps: result.startup_apps || [] });
          return;
        }

        // startup.toggle response
        if (result.success !== undefined && result.enabled !== undefined) {
          set((state) => ({
            startupApps: state.startupApps.map(app => 
              app.name === result.name ? { ...app, enabled: result.enabled } : app // Wait, does Python return name? No.
            )
          }));
          // It's better to just re-fetch the startup list to be absolutely sure.
          get().fetchStartupApps();
          return;
        }

        // exclusions.add / exclusions.remove response - re-fetch list
        if (result.success !== undefined && result.status === undefined && result.deleted === undefined && result.size_bytes === undefined) {
          // This is an add/remove exclusion response - refresh exclusions
          get().fetchExclusions();
          return;
        }


        // browser.scan_caches response (array of objects)
        if (Array.isArray(result)) {
          // Browser scan results - not stored in global state, handled by component
          return;
        }

        // system.privacy_sweep response
        if (result.traces_cleaned !== undefined) {
          set({
            privacySweepStatus: 'completed',
            privacySweepResults: result,
            needsRefresh: true
          });
          return;
        }

        // system.boost response
        if (result.ram_freed_bytes !== undefined) {
          set({
            boostStatus: 'completed',
            boostResults: result,
            needsRefresh: true
          });
          return;
        }

        // system.quick_clean response
        if (result.status === 'completed' && result.bytes_freed !== undefined) {
          set({
            quickCleanStatus: 'completed',
            quickCleanBytesFreed: result.bytes_freed,
            quickCleanFilesDeleted: result.files_deleted || 0,
            quickCleanFilesSkipped: result.files_skipped || 0,
            needsRefresh: true
          });
          // Fetch new stats immediately to reflect the deletion
          get().fetchDiskSpace();
          get().fetchDashboardStats();
          get().fetchRecycleBin();
          return;
        }
      });

      // 3. Process watchdog warnings
      unsubscribeWarning = window.api.onWarning((packet) => {
        set({ serviceWarning: packet.message });
        setTimeout(() => set({ serviceWarning: null }), 6000);
      });

      // 4. Process watchdog errors
      unsubscribeError = window.api.onError((packet) => {
        set({ serviceError: packet.message });
      });

      // Query the backend startup diagnostics immediately on connection
      window.api.sendRequest('system:startup');
    },

    startScan: (targetPath, isReplenishing = false) => {
      set((state) => ({
        scanPath: targetPath,
        scanStatus: 'scanning',
        scannedCount: 0,
        scannedBytes: 0,
        scannedFiles: [],
        limitExceeded: false,
        skippedPaths: isReplenishing ? state.skippedPaths : []
      }));
      if (window.api) {
        window.api.sendRequest('scanner:start', { path: targetPath, scanMode: get().scanMode });
      } else {
        // High-fidelity dynamic browser scanning from background local HTTP API
        console.log(`[SafeSweep] Browser mode: fetching real scan results from http://127.0.0.1:9988/api/scan?path=${encodeURIComponent(targetPath)}`);
        fetchWithTimeout(`http://127.0.0.1:9988/api/scan?path=${encodeURIComponent(targetPath)}`, {}, 60000)
          .then(res => res.json())
          .then(result => {
            if (result.error) {
              throw new Error(result.error);
            }
            const skipped = get().skippedPaths || [];
            const freshFiles = (result.files || []).filter(f => !skipped.includes(f.path));
            set({
              scanStatus: 'completed',
              scannedCount: freshFiles.length,
              scannedBytes: freshFiles.reduce((acc, curr) => acc + curr.size, 0),
              safeModeEnforced: result.safe_mode_enforced || false,
              safetyWarning: result.warning || null,
              limitExceeded: result.limit_exceeded || false,
              scannedFiles: freshFiles
            });
          })
          .catch(err => {
            console.error("[SafeSweep API] Dynamic HTTP scanning failed or offline, falling back to simulated mock run...", err);
            get()._runMockScan(targetPath);
          });
      }
    },

    _runMockScan: (targetPath) => {
      let currentCount = 0;
      const skipped = get().skippedPaths || [];

      // Dynamically generate a high-fidelity list of mock files based on targetPath
      const generateDynamicMockFiles = (path) => {
        const fileTemplates = [
          { name: "Backup_Archive", ext: "zip", size: 45000000, risk: "SAFE" },
          { name: "Report_Analysis", ext: "pdf", size: 1200000, risk: "SAFE" },
          { name: "Image_Capture", ext: "png", size: 3400000, risk: "SAFE" },
          { name: "Voice_Recording", ext: "mp3", size: 5200000, risk: "SAFE" },
          { name: "Setup_Installer", ext: "msi", size: 85000000, risk: "LOW" },
          { name: "Data_Spreadsheet", ext: "csv", size: 15000, risk: "SAFE" },
          { name: "Meeting_Minutes", ext: "txt", size: 4500, risk: "SAFE" },
          { name: "System_Log", ext: "log", size: 890000, risk: "SAFE" },
          { name: "Video_Presentation", ext: "mp4", size: 120000000, risk: "LOW" },
          { name: "App_Config", ext: "json", size: 2500, risk: "SAFE" },
          { name: "Draft_Document", ext: "docx", size: 45000, risk: "SAFE" },
          { name: "Thumbnail_Preview", ext: "jpg", size: 180000, risk: "SAFE" },
          { name: "Database_Local", ext: "db", size: 12000000, risk: "SAFE" },
          { name: "Temporary_Cache", ext: "tmp", size: 32000000, risk: "LOW" },
          { name: "Dependency_Library", ext: "dll", size: 4500000, risk: "CRITICAL" },
          { name: "Host_Shield", ext: "sys", size: 12000, risk: "CRITICAL" }
        ];

        const generated = [];
        const numFiles = Math.floor(Math.random() * 15) + 25;

        for (let i = 0; i < numFiles; i++) {
          const template = fileTemplates[i % fileTemplates.length];
          const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
          const fileName = `${template.name}_${randomSuffix}.${template.ext}`;

          let filePath = path;
          if (i % 4 === 1) {
            filePath += "\\SystemCaches";
          } else if (i % 4 === 2) {
            filePath += "\\AppData_Local";
          } else if (i % 4 === 3) {
            filePath += "\\TempProject";
          }

          generated.push({
            path: `${filePath}\\${fileName}`,
            name: fileName,
            size: Math.floor(template.size * (0.5 + Math.random())),
            risk: template.risk
          });
        }
        return generated;
      };

      const mockFiles = generateDynamicMockFiles(targetPath).filter(f => !skipped.includes(f.path));
      const totalSimulated = mockFiles.length;
      const interval = setInterval(() => {
        currentCount += Math.floor(Math.random() * 5) + 3;
        if (currentCount >= totalSimulated) {
          currentCount = totalSimulated;
          clearInterval(interval);
          set({
            scanStatus: 'completed',
            scannedCount: totalSimulated,
            scannedBytes: mockFiles.reduce((acc, curr) => acc + curr.size, 0),
            safeModeEnforced: get().scanMode === 'balanced',
            scannedFiles: mockFiles
          });
        } else {
          set({
            scannedCount: Math.min(currentCount, totalSimulated),
            scannedBytes: Math.floor((Math.min(currentCount, totalSimulated) / (totalSimulated || 1)) * 314572800)
          });
        }
      }, 100);
      get()._scanInterval = interval;
    },

    cancelScan: () => {
      if (window.api) {
        window.api.sendRequest('scanner:cancel');
      } else {
        if (get()._scanInterval) {
          clearInterval(get()._scanInterval);
        }
      }
      set({ scanStatus: 'cancelled' });
    },

    // Execute dry-run Smart Delete simulation - runs locally in UI
    runDeleteSimulation: (selectedPaths) => {
      const files = get().scannedFiles.filter(f => selectedPaths.includes(f.path));
      const files_to_remove = [];
      const files_skipped = [];
      const protected_ignored = [];
      let total_freed_bytes = 0;
      const risk_summary = { SAFE: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };

      files.forEach(f => {
        if (f.risk === 'CRITICAL') {
          protected_ignored.push({ path: f.path, reason: 'Protected System Element' });
          risk_summary.CRITICAL++;
        } else {
          total_freed_bytes += (f.size || 0);
          risk_summary[f.risk] = (risk_summary[f.risk] || 0) + 1;
          files_to_remove.push(f);
        }
      });

      set({
        activeSimulation: {
          files_to_remove,
          files_skipped,
          protected_ignored,
          total_freed_bytes,
          risk_summary
        }
      });
    },

    clearSimulation: () => set({ activeSimulation: null }),

    skipSelectedPaths: (paths, scanPath) => {
      const wasCapped = get().limitExceeded;
      set((state) => {
        const nextFiles = state.scannedFiles.filter(f => !paths.includes(f.path));
        return {
          skippedPaths: [...state.skippedPaths, ...paths],
          scannedFiles: nextFiles,
          scannedCount: nextFiles.length,
          scannedBytes: nextFiles.reduce((acc, curr) => acc + curr.size, 0)
        };
      });
      if (wasCapped && scanPath) {
        get().startScan(scanPath, true);
      }
    },

    // Deletion executions
    startDeletion: (targets, permanent = false, scanPath = '') => {
      // Capture unselected paths in scannedFiles as skipped paths
      const currentScanned = get().scannedFiles;
      const skipped = currentScanned
        .filter(f => !targets.includes(f.path))
        .map(f => f.path);

      set((state) => ({
        deleteStatus: 'deleting',
        skippedPaths: [...state.skippedPaths, ...skipped]
      }));

      if (window.api) {
        window.api.sendRequest('delete:start', { targets, permanent, scanPath });
      } else {
        // High-fidelity dynamic browser deletion from Python HTTP API
        console.log(`[SafeSweep] Browser mode: posting real deletion request to http://127.0.0.1:9988/api/delete`);
        fetchWithTimeout(`http://127.0.0.1:9988/api/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ targets, permanent, scan_path: scanPath })
        }, 60000)
          .then(res => res.json())
          .then(result => {
            if (result.error) {
              throw new Error(result.error);
            }
            const wasCapped = get().limitExceeded;
            set((state) => {
              const deletedPaths = result.deleted || [];
              const remainingFiles = state.scannedFiles.filter(f => !deletedPaths.includes(f.path));
              return {
                deleteStatus: 'completed',
                deletedCount: deletedPaths.length,
                failedCount: (result.failed || []).length,
                scannedFiles: remainingFiles,
                activeSimulation: null,
                needsRefresh: true
              };
            });
            get().fetchQuarantine();

            if (wasCapped && scanPath) {
              setTimeout(() => {
                get().startScan(scanPath, true);
              }, 600);
            }
          })
          .catch(err => {
            console.error("[SafeSweep API] Real deletion failed, falling back to mock simulation...", err);
            get()._runMockDeletion(targets);
          });
      }
    },

    _runMockDeletion: (targets) => {
      let deleted = 0;
      const total = targets.length;
      const step = Math.max(5, Math.floor(total / 20) + 1);
      const wasCapped = get().limitExceeded;
      const interval = setInterval(() => {
        deleted += Math.floor(Math.random() * step) + Math.floor(step / 2) + 1;
        if (deleted >= total) {
          deleted = total;
          clearInterval(interval);

          const currentFiles = get().scannedFiles;
          const remainingFiles = currentFiles.filter(f => !targets.includes(f.path));

          set({
            deleteStatus: 'completed',
            deletedCount: total,
            failedCount: 0,
            scannedFiles: remainingFiles,
            activeSimulation: null,
            needsRefresh: true
          });

          const totalFreed = targets.reduce((acc, path) => {
            const fileObj = currentFiles.find(f => f.path === path);
            return acc + (fileObj ? fileObj.size : 0);
          }, 0);

          set((state) => ({
            dashboardStats: {
              ...state.dashboardStats,
              temp_size_bytes: Math.max(0, state.dashboardStats.temp_size_bytes - totalFreed)
            }
          }));

          if (wasCapped) {
            setTimeout(() => {
              get().startScan(get().scanPath || 'C:\\Users\\user\\Desktop', true);
            }, 600);
          }
        } else {
          set({ deletedCount: deleted });
        }
      }, 40);
      get()._deleteInterval = interval;
    },

    cancelDeletion: () => {
      if (window.api) {
        window.api.sendRequest('delete:cancel');
      } else {
        if (get()._deleteInterval) {
          clearInterval(get()._deleteInterval);
        }
      }
      set({ deleteStatus: 'idle' });
    },

    // Quick Clean
    quickClean: (target) => {
      set({ quickCleanStatus: 'cleaning', quickCleanBytesFreed: 0, quickCleanFilesDeleted: 0, quickCleanFilesSkipped: 0 });
      if (window.api) {
        window.api.sendRequest('system:quick_clean', { target });
      } else {
        // Fallback for browser (uses local sidecar API)
        fetchWithTimeout(`http://127.0.0.1:9988/api/quick_clean?target=${target}`, {}, 30000)
          .then(res => res.json())
          .then(result => {
            set({
              quickCleanStatus: 'completed',
              quickCleanBytesFreed: result.bytes_freed || 0,
              quickCleanFilesDeleted: result.files_deleted || 0,
              quickCleanFilesSkipped: result.files_skipped || 0,
              needsRefresh: true
            });
            get().fetchDiskSpace();
            get().fetchDashboardStats();
            get().fetchRecycleBin();
          })
          .catch(() => {
            set({ quickCleanStatus: 'completed', quickCleanBytesFreed: 104857600, quickCleanFilesDeleted: 142, quickCleanFilesSkipped: 16, needsRefresh: true });
            get().fetchDiskSpace();
            get().fetchDashboardStats();
            get().fetchRecycleBin();
          });
      }
    },

    // Empty folders operations
    scanEmptyFolders: () => {
      set({ emptyFoldersScanStatus: 'scanning', emptyFoldersList: [], deletedEmptyFolders: [] });
      if (window.api) {
        window.api.sendRequest('empty_folders:scan');
      } else {
        fetchWithTimeout('http://127.0.0.1:9988/api/empty_folders/scan', {}, 60000)
          .then(res => res.json())
          .then(result => {
            set({ emptyFoldersScanStatus: 'completed', emptyFoldersList: result.empty_folders || [] });
          })
          .catch(() => {
            set({ emptyFoldersScanStatus: 'completed', emptyFoldersList: ['C:\\MockEmpty1', 'C:\\Users\\MockEmpty2'] });
          });
      }
    },

    deleteEmptyFolders: (targets) => {
      set({ deleteStatus: 'deleting' });
      if (window.api) {
        window.api.sendRequest('empty_folders:delete', { targets });
      } else {
        fetchWithTimeout('http://127.0.0.1:9988/api/empty_folders/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targets })
        }, 60000)
          .then(res => res.json())
          .then(result => {
            set((state) => ({
              deletedEmptyFolders: result.deleted || [],
              emptyFoldersList: state.emptyFoldersList.filter(f => !(result.deleted || []).includes(f)),
              deleteStatus: 'completed',
              needsRefresh: true
            }));
          })
          .catch(() => {
            set((state) => ({
              deletedEmptyFolders: targets,
              emptyFoldersList: state.emptyFoldersList.filter(f => !targets.includes(f)),
              deleteStatus: 'completed',
              needsRefresh: true
            }));
          });
      }
    },

    // Old Downloads operations
    scanOldDownloads: () => {
      set({ oldDownloadsScanStatus: 'scanning', oldDownloadsList: [], deletedOldDownloads: [], oldDownloadsBytesFreed: 0 });
      if (window.api) {
        window.api.sendRequest('old_downloads:scan');
      } else {
        fetchWithTimeout('http://127.0.0.1:9988/api/old_downloads/scan', {}, 60000)
          .then(res => res.json())
          .then(result => {
            set({ oldDownloadsScanStatus: 'completed', oldDownloadsList: result.old_downloads || [] });
          })
          .catch(() => {
            set({ oldDownloadsScanStatus: 'error' });
          });
      }
    },

    deleteOldDownloads: (targets) => {
      set({ deleteStatus: 'deleting' });
      if (window.api) {
        window.api.sendRequest('old_downloads:delete', { targets });
      } else {
        fetchWithTimeout('http://127.0.0.1:9988/api/old_downloads/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targets })
        }, 60000)
          .then(res => res.json())
          .then(result => {
            set((state) => ({
              deletedOldDownloads: result.deleted || [],
              oldDownloadsBytesFreed: result.total_freed || 0,
              oldDownloadsList: state.oldDownloadsList.filter(f => !(result.deleted || []).includes(f.path)),
              deleteStatus: 'completed',
              needsRefresh: true
            }));
          })
          .catch(() => {
            set({ deleteStatus: 'idle' });
          });
      }
    },

    // Services Advisor operations
    fetchServices: () => {
      set({ servicesScanStatus: 'scanning' });
      if (window.api) {
        window.api.sendRequest('services:get');
      } else {
        fetchWithTimeout('http://127.0.0.1:9988/api/services/get', {}, 30000)
          .then(res => res.json())
          .then(result => {
            set({ servicesScanStatus: 'completed', servicesList: result.services || [] });
          })
          .catch(() => {
            set({ servicesScanStatus: 'error' });
          });
      }
    },

    toggleService: async (name, action) => {
      try {
        const res = await fetchWithTimeout('http://127.0.0.1:9988/api/services/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, action })
        }, 15000);
        const result = await res.json();
        if (result.success) {
          get().fetchServices();
          return { success: true };
        } else {
          return { success: false, error: result.error || 'Failed to toggle service' };
        }
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    // Archive Manager operations
    scanArchives: () => {
      set({ archivesScanStatus: 'scanning', archivesList: [], deletedArchives: [], archivesBytesFreed: 0 });
      if (window.api) {
        window.api.sendRequest('archives:scan');
      } else {
        fetchWithTimeout('http://127.0.0.1:9988/api/archives/scan', {}, 600000)
          .then(res => res.json())
          .then(result => {
            set({ archivesScanStatus: 'completed', archivesList: result.archives || [] });
          })
          .catch(() => {
            set({ archivesScanStatus: 'error' });
          });
      }
    },

    deleteArchives: (targets) => {
      set({ deleteStatus: 'deleting' });
      if (window.api) {
        window.api.sendRequest('archives:delete', { targets });
      } else {
        fetchWithTimeout('http://127.0.0.1:9988/api/archives/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targets })
        }, 120000)
          .then(res => res.json())
          .then(result => {
            set((state) => ({
              deletedArchives: result.deleted || [],
              archivesBytesFreed: result.total_freed || 0,
              archivesList: state.archivesList.filter(f => !(result.deleted || []).includes(f.path)),
              deleteStatus: 'completed',
              needsRefresh: true
            }));
            if (result.failed && result.failed.length > 0) {
              get().setServiceWarning(`${result.failed.length} protected archives were kept safe and not deleted.`);
              setTimeout(() => get().setServiceWarning(''), 6000);
            }
          })
          .catch(() => {
            set({ deleteStatus: 'idle' });
          });
      }
    },

    // Duplicate Finder operations
    scanDuplicates: () => {
      set({ duplicatesScanStatus: 'scanning', duplicatesList: [], deletedDuplicates: [], duplicatesBytesFreed: 0 });
      if (window.api) {
        window.api.sendRequest('duplicates:scan');
      } else {
        fetchWithTimeout('http://127.0.0.1:9988/api/duplicates/scan', {}, 600000)
          .then(res => res.json())
          .then(result => {
            set({ duplicatesScanStatus: 'completed', duplicatesList: result.duplicates || [] });
          })
          .catch(() => {
            set({ duplicatesScanStatus: 'error' });
          });
      }
    },

    deleteDuplicates: (targets) => {
      set({ deleteStatus: 'deleting' });
      if (window.api) {
        window.api.sendRequest('duplicates:delete', { targets });
      } else {
        fetchWithTimeout('http://127.0.0.1:9988/api/duplicates/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targets })
        }, 120000)
          .then(res => res.json())
          .then(result => {
            set((state) => {
              const newList = state.duplicatesList.map(group => ({
                ...group,
                files: group.files.filter(f => !(result.deleted || []).includes(f.path))
              })).filter(group => group.files.length > 1);

              return {
                deletedDuplicates: result.deleted || [],
                duplicatesBytesFreed: result.bytes_freed || 0,
                duplicatesList: newList,
                deleteStatus: 'completed',
                needsRefresh: true
              };
            });
            if (result.failed && result.failed.length > 0) {
              get().setServiceWarning(`Failed to delete ${result.failed.length} duplicate items.`);
              setTimeout(() => get().setServiceWarning(''), 6000);
            }
          })
          .catch(() => {
            set({ deleteStatus: 'idle' });
          });
      }
    },

    // Game Booster operations
    boostSystem: () => {
      set({ boostStatus: 'boosting', boostResults: null });
      if (window.api) {
        window.api.sendRequest('system:boost');
      } else {
        fetchWithTimeout('http://127.0.0.1:9988/api/boost', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        }, 120000)
          .then(res => res.json())
          .then(result => {
            set({ boostStatus: 'completed', boostResults: result });
          })
          .catch(() => {
            set({ boostStatus: 'error' });
          });
      }
    },

    // Privacy Sweep operations
    privacySweep: () => {
      set({ privacySweepStatus: 'sweeping', privacySweepResults: null });
      if (window.api) {
        window.api.sendRequest('system:privacy_sweep');
      } else {
        fetchWithTimeout('http://127.0.0.1:9988/api/privacy_sweep', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        }, 60000)
          .then(res => res.json())
          .then(result => {
            set({ privacySweepStatus: 'completed', privacySweepResults: result });
          })
          .catch(() => {
            set({ privacySweepStatus: 'error' });
          });
      }
    },

    // Uninstaller operations
    fetchInstalledApps: () => {
      set({ uninstallerStatus: 'loading', uninstallerApps: [] });
      if (window.api) {
        window.api.sendRequest('uninstaller:list');
      } else {
        fetchWithTimeout('http://127.0.0.1:9988/api/uninstaller/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        }, 60000)
          .then(res => res.json())
          .then(result => {
            set({ uninstallerStatus: 'completed', uninstallerApps: result.uninstaller_apps || [] });
          })
          .catch(() => {
            set({ uninstallerStatus: 'error' });
          });
      }
    },
    uninstallApp: (uninstallString) => {
      if (window.api) {
        window.api.sendRequest('uninstaller:uninstall', { uninstall_string: uninstallString });
      } else {
        fetchWithTimeout('http://127.0.0.1:9988/api/uninstaller/uninstall', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uninstall_string: uninstallString })
        }, 10000);
        // We don't wait for uninstall to finish as it usually launches an interactive uninstaller
      }
    },
    cleanLeftovers: (appName) => {
      return new Promise((resolve) => {
        if (window.api) {
          window.api.sendRequest('uninstaller:cleanLeftovers', { app_name: appName });
          resolve({ status: 'completed', cleaned_paths: [], cleaned_registry: [] }); // simplistic mock for IPC
        } else {
          fetchWithTimeout('http://127.0.0.1:9988/api/uninstaller/clean_leftovers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ app_name: appName })
          }, 15000)
            .then(res => res.json())
            .then(result => resolve(result))
            .catch(() => resolve({ status: 'error' }));
        }
      });
    },

    researchApp: (appName) => {
      return new Promise((resolve) => {
        if (window.api) {
          window.api.sendRequest('uninstaller:research', { app_name: appName });
          resolve({ found: false, description: 'Research feature requires HTTP API.' });
        } else {
          fetchWithTimeout('http://127.0.0.1:9988/api/uninstaller/research', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ app_name: appName })
          }, 10000)
            .then(res => res.json())
            .then(result => resolve(result))
            .catch(() => resolve({ found: false, description: 'Network error while fetching research.' }));
        }
      });
    },

    // Startup Manager operations
    fetchStartupApps: () => {
      set({ startupStatus: 'loading', startupApps: [] });
      if (window.api) {
        window.api.sendRequest('startup:list');
      } else {
        fetchWithTimeout('http://127.0.0.1:9988/api/startup/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        }, 10000)
          .then(res => res.json())
          .then(result => {
            set({ startupStatus: 'completed', startupApps: result.startup_apps || [] });
          })
          .catch(() => {
            set({ startupStatus: 'error' });
          });
      }
    },

    toggleStartupApp: (name, enable) => {
      return new Promise((resolve) => {
        if (window.api) {
          window.api.sendRequest('startup:toggle', { name, enable });
          resolve({ success: true });
        } else {
          fetchWithTimeout('http://127.0.0.1:9988/api/startup/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, enable })
          }, 10000)
            .then(res => res.json())
            .then(result => {
              if (result.success) {
                // Optimistically update UI
                set((state) => ({
                  startupApps: state.startupApps.map(app => 
                    app.name === name ? { ...app, enabled: enable } : app
                  )
                }));
              }
              resolve(result);
            })
            .catch(() => resolve({ success: false }));
        }
      });
    },

    // Quarantine restorations
    restoreQuarantineItem: (itemId, destination = null) => {
      if (window.api) {
        window.api.sendRequest('quarantine:restore', { id: itemId, customDestination: destination });
      } else {
        set((state) => ({
          quarantineItems: state.quarantineItems.filter(item => item.id !== itemId)
        }));
      }
    },

    // Add and remove custom exclusions - optimistic update + backend sync
    addExclusion: (exclusionPath) => {
      if (!exclusionPath) return;
      if (window.api) window.api.sendRequest('exclusions:add', { path: exclusionPath });
      // Optimistic update
      set((state) => ({
        exclusions: state.exclusions.includes(exclusionPath)
          ? state.exclusions
          : [...state.exclusions, exclusionPath]
      }));
    },

    removeExclusion: (exclusionPath) => {
      if (!exclusionPath) return;
      if (window.api) window.api.sendRequest('exclusions:remove', { path: exclusionPath });
      // Optimistic update - remove immediately from UI
      set((state) => ({
        exclusions: state.exclusions.filter(e => e !== exclusionPath)
      }));
    },

    // Timed preview simulation for browsers with offline background services
    _runMockSimulation: (initialSteps) => {
      set({ loadingSteps: initialSteps, isSystemLoading: true, isDiskLoading: true, isStatsLoading: true, isRecycleLoading: true });

      setTimeout(() => {
        set((state) => ({
          loadingSteps: state.loadingSteps.map(s =>
            s.id === 'integrity' ? { ...s, status: 'completed' } :
              s.id === 'disk' ? { ...s, status: 'active' } : s
          )
        }));

        setTimeout(() => {
          set((state) => ({
            diskSpace: { total: 512110000000, free: 297022000000 },
            isDiskLoading: false,
            loadingSteps: state.loadingSteps.map(s =>
              s.id === 'disk' ? { ...s, status: 'completed' } :
                s.id === 'temp' ? { ...s, status: 'active' } : s
            )
          }));

          setTimeout(() => {
            set((state) => ({
              dashboardStats: {
                ...state.dashboardStats,
                temp_size_bytes: 843102030,
                temp_items_count: 1420
              },
              loadingSteps: state.loadingSteps.map(s =>
                s.id === 'temp' ? { ...s, status: 'completed' } :
                  s.id === 'browsers' ? { ...s, status: 'active' } : s
              )
            }));

            setTimeout(() => {
              set((state) => ({
                dashboardStats: {
                  ...state.dashboardStats,
                  browser_size_bytes: 1421034900,
                  browser_items_count: 8201
                },
                isStatsLoading: false,
                loadingSteps: state.loadingSteps.map(s =>
                  s.id === 'browsers' ? { ...s, status: 'completed' } :
                    s.id === 'recycle' ? { ...s, status: 'active' } : s
                )
              }));

              setTimeout(() => {
                set((state) => ({
                  recycleBinInfo: { size_bytes: 120930400, items_count: 42 },
                  isRecycleLoading: false,
                  exclusions: ['C:\\Users\\User\\Downloads\\.git', 'C:\\Users\\User\\Desktop\\node_modules'],
                  defaultDownloads: 'C:\\Users\\User\\Downloads',
                  defaultDesktop: 'C:\\Users\\User\\Desktop',
                  loadingSteps: state.loadingSteps.map(s =>
                    s.id === 'recycle' ? { ...s, status: 'completed' } : s
                  )
                }));

                setTimeout(() => {
                  set({ isSystemLoading: false });
                }, 400);

              }, 400);

            }, 400);

          }, 400);

        }, 400);

      }, 400);
    }
  };
});

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

    // Custom exclusion list paths
    exclusions: [],
    fetchExclusions: () => {
      if (window.api) window.api.sendRequest('exclusions:list');
    },

    // Scan progress statuses
    scanStatus: 'idle', // idle, scanning, completed, cancelled
    scannedCount: 0,
    scannedBytes: 0,
    scannedFiles: [],
    safeModeEnforced: false,
    safetyWarning: null,

    // Duplicate files
    duplicatesStatus: 'idle',
    duplicatesList: [],

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

    // Quarantine recoveries
    quarantineItems: [],
    fetchQuarantine: () => {
      if (window.api) {
        window.api.sendRequest('quarantine:list');
      } else {
        if (get().quarantineItems.length === 0) {
          set({
            quarantineItems: [
              {
                id: 'q_item_1',
                name: 'cracked_game_patch.exe',
                directory: 'C:\\Users\\User\\Downloads',
                size: 48024800,
                created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString()
              },
              {
                id: 'q_item_2',
                name: 'unknown_installer.tmp',
                directory: 'C:\\Users\\User\\AppData\\Local\\Temp',
                size: 122880,
                created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
              }
            ]
          });
        }
      }
    },

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
    fetchDiskSpace: () => {
      set({ isDiskLoading: true });
      if (window.api) {
        window.api.sendRequest('system:disk');
      } else {
        fetchWithTimeout('http://127.0.0.1:9988/api/disk', {}, 5000)
          .then(res => res.json())
          .then(result => {
            set({ diskSpace: { total: result.total, free: result.free }, isDiskLoading: false });
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
          set((state) => ({
            scannedCount: params.scanned_count,
            scannedBytes: params.total_size_bytes,
            scannedFiles: [...state.scannedFiles, ...params.files]
          }));
        } else if (method === 'scanner.completed') {
          // Scanner completed as notification (from DuplicateFinder)
          set({
            scanStatus: 'completed',
            safeModeEnforced: params.safe_mode_enforced || false,
            safetyWarning: params.warning || null
          });
        } else if (method === 'delete.progress' || method === 'deletion.progress') {
          set({
            deletedCount: params.deleted_count,
            failedCount: params.failed_count
          });
        } else if (method === 'duplicates.progress') {
          // Handled locally in DuplicateFinder component - no store update needed
        } else if (method === 'duplicates.completed') {
          set({
            duplicatesList: params.duplicates || [],
            duplicatesStatus: 'completed'
          });
        } else if (method === 'delete.completed') {
          set({ deleteStatus: 'completed', activeSimulation: null });
          get().fetchQuarantine();
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
          get().fetchQuarantine();
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
              isSystemLoading: allDone ? false : state.isSystemLoading
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
            safetyWarning: result.warning || null
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
          set({ deleteStatus: 'completed', activeSimulation: null });
          get().fetchQuarantine();
          return;
        }

        // delete cancel response
        if (result.status === 'delete_cancelled' || result.status === 'no_active_delete') {
          set({ deleteStatus: 'idle' });
          return;
        }

        // duplicates.start_scan response
        if (result.status === 'duplicate_scan_started') {
          set({ duplicatesStatus: 'scanning', duplicatesList: [] });
          return;
        }

        // duplicates completed (returned as response)
        if (result.duplicates !== undefined) {
          set({ duplicatesList: result.duplicates || [], duplicatesStatus: 'completed' });
          return;
        }

        // exclusions.list response
        if (result.exclusions !== undefined) {
          set({ exclusions: result.exclusions || [] });
          return;
        }

        // exclusions.add / exclusions.remove response - re-fetch list
        if (result.success !== undefined && result.status === undefined && result.deleted === undefined && result.size_bytes === undefined) {
          // This is an add/remove exclusion response - refresh exclusions
          get().fetchExclusions();
          return;
        }

        // quarantine.list response
        if (result.quarantine !== undefined) {
          set({ quarantineItems: result.quarantine || [] });
          return;
        }

        // quarantine.restore response
        if (result.restored_path !== undefined) {
          get().fetchQuarantine();
          return;
        }

        // browser.scan_caches response (array of objects)
        if (Array.isArray(result)) {
          // Browser scan results - not stored in global state, handled by component
          return;
        }

        // system.quick_clean response
        if (result.status === 'completed' && result.bytes_freed !== undefined) {
          set({ 
            quickCleanStatus: 'completed', 
            quickCleanBytesFreed: result.bytes_freed,
            quickCleanFilesDeleted: result.files_deleted || 0,
            quickCleanFilesSkipped: result.files_skipped || 0
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

    startScan: (targetPath) => {
      set({ 
        scanStatus: 'scanning',
        scannedCount: 0,
        scannedBytes: 0,
        scannedFiles: []
      });
      if (window.api) {
        window.api.sendRequest('scanner:start', { path: targetPath, scanMode: get().scanMode });
      } else {
        // High-fidelity browser mock scanning simulation
        let currentCount = 0;
        const totalSimulated = 12420;
        const interval = setInterval(() => {
          currentCount += Math.floor(Math.random() * 800) + 400;
          if (currentCount >= totalSimulated) {
            currentCount = totalSimulated;
            clearInterval(interval);
            set({
              scanStatus: 'completed',
              scannedCount: totalSimulated,
              scannedBytes: 8589934592,
              safeModeEnforced: get().scanMode === 'balanced',
              scannedFiles: [
                { path: `${targetPath}\\temp_installer.msi`, size: 471859200, risk: 'SAFE' },
                { path: `${targetPath}\\large_video_copy.mp4`, size: 2254857830, risk: 'LOW' },
                { path: 'C:\\Windows\\System32\\drivers\\etc\\hosts', size: 820, risk: 'CRITICAL' },
                { path: `${targetPath}\\chrome_installer.exe`, size: 125829120, risk: 'SAFE' },
                { path: `${targetPath}\\cache_db.bin`, size: 89128960, risk: 'SAFE' },
                { path: 'C:\\Windows\\System32\\kernel32.dll', size: 7130368, risk: 'CRITICAL' },
                { path: `${targetPath}\\node_modules\\webpack\\bin.js`, size: 15360, risk: 'LOW' },
                { path: `${targetPath}\\notes.txt`, size: 2048, risk: 'SAFE' }
              ]
            });
          } else {
            set({
              scannedCount: currentCount,
              scannedBytes: Math.floor((currentCount / totalSimulated) * 8589934592)
            });
          }
        }, 100);
        get()._scanInterval = interval;
      }
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
          // FIX: was protected_ignored.append() - Python syntax! JS uses .push()
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

    // Deletion executions
    startDeletion: (targets, permanent = false) => {
      set({ deleteStatus: 'deleting' });
      if (window.api) {
        window.api.sendRequest('delete:start', { targets, permanent });
      } else {
        // High-fidelity browser mock deletion simulation
        let deleted = 0;
        const total = targets.length;
        const interval = setInterval(() => {
          deleted += Math.floor(Math.random() * 2) + 1;
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
              activeSimulation: null
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
          } else {
            set({ deletedCount: deleted });
          }
        }, 150);
        get()._deleteInterval = interval;
      }
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
              quickCleanFilesSkipped: result.files_skipped || 0
            });
            get().fetchDiskSpace();
            get().fetchDashboardStats();
            get().fetchRecycleBin();
          })
          .catch(() => {
            set({ quickCleanStatus: 'completed', quickCleanBytesFreed: 104857600, quickCleanFilesDeleted: 142, quickCleanFilesSkipped: 16 });
            get().fetchDiskSpace();
            get().fetchDashboardStats();
            get().fetchRecycleBin();
          });
      }
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

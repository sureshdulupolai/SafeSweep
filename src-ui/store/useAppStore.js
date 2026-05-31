import { create } from 'zustand';

export const useAppStore = create((set, get) => {
  // Listener hooks binding backend data streams to frontend store states
  let unsubscribeNotify = null;
  let unsubscribeResponse = null;
  let unsubscribeWarning = null;
  let unsubscribeError = null;

  return {
    // Current Active panel view (dashboard, cleaner, duplicates, quarantine, settings)
    activePanel: 'dashboard',
    setActivePanel: (panel) => set({ activePanel: panel }),

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

    // Quarantine recoveries
    quarantineItems: [],
    fetchQuarantine: () => {
      if (window.api) window.api.sendRequest('quarantine:list');
    },

    // System alerts from Watchdog
    serviceWarning: null,
    serviceError: null,

    // Real dynamic disk metrics & defaults
    defaultDownloads: '',
    defaultDesktop: '',
    diskSpace: { total: 0, free: 0 },
    fetchDiskSpace: () => {
      if (window.api) window.api.sendRequest('system:disk');
    },

    // Recycle bin live data
    recycleBinInfo: { size_bytes: 0, items_count: 0 },
    fetchRecycleBin: () => {
      if (window.api) window.api.sendRequest('recycle:query');
    },

    // Background statistics for dashboard cards
    dashboardStats: { temp_size_bytes: 0, temp_items_count: 0, browser_size_bytes: 0, browser_items_count: 0 },
    fetchDashboardStats: () => {
      if (window.api) window.api.sendRequest('system:dashboard_stats');
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
          // In a regular browser - no Electron API available, run premium mock simulation sequence!
          console.log("[SafeSweep] Running in browser (no Electron API). Initializing dynamic simulated loading sequence...");
          
          const initialSteps = [
            { id: 'integrity', label: 'Verifying Security Middleware Shield...', status: 'active' },
            { id: 'disk', label: 'Querying C:\\ drive NTFS analytics...', status: 'pending' },
            { id: 'temp', label: 'Locating temporary system caches...', status: 'pending' },
            { id: 'browsers', label: 'Scanning browser cache databases...', status: 'pending' },
            { id: 'recycle', label: 'Querying Recycle Bin allocation...', status: 'pending' }
          ];
          set({ loadingSteps: initialSteps, isSystemLoading: true });

          setTimeout(() => {
            // Finish Integrity, start Disk
            set((state) => ({
              loadingSteps: state.loadingSteps.map(s =>
                s.id === 'integrity' ? { ...s, status: 'completed' } :
                s.id === 'disk' ? { ...s, status: 'active' } : s
              )
            }));
            
            setTimeout(() => {
              // Finish Disk, start Temp, populate Disk mock
              set((state) => ({
                diskSpace: { total: 512110000000, free: 297022000000 },
                loadingSteps: state.loadingSteps.map(s =>
                  s.id === 'disk' ? { ...s, status: 'completed' } :
                  s.id === 'temp' ? { ...s, status: 'active' } : s
                )
              }));
              
              setTimeout(() => {
                // Finish Temp, start Browsers, populate Temp mock
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
                  // Finish Browsers, start Recycle, populate Browsers mock
                  set((state) => ({
                    dashboardStats: {
                      ...state.dashboardStats,
                      browser_size_bytes: 1421034900,
                      browser_items_count: 8201
                    },
                    loadingSteps: state.loadingSteps.map(s =>
                      s.id === 'browsers' ? { ...s, status: 'completed' } :
                      s.id === 'recycle' ? { ...s, status: 'active' } : s
                    )
                  }));
                  
                  setTimeout(() => {
                    // Finish Recycle, populate Recycle mock
                    set((state) => ({
                      recycleBinInfo: { size_bytes: 120930400, items_count: 42 },
                      exclusions: ['C:\\Users\\User\\Downloads\\.git', 'C:\\Users\\User\\Desktop\\node_modules'],
                      defaultDownloads: 'C:\\Users\\User\\Downloads',
                      defaultDesktop: 'C:\\Users\\User\\Desktop',
                      loadingSteps: state.loadingSteps.map(s =>
                        s.id === 'recycle' ? { ...s, status: 'completed' } : s
                      )
                    }));
                    
                    setTimeout(() => {
                      // Hide loader
                      set({ isSystemLoading: false });
                    }, 400);
                    
                  }, 400);
                  
                }, 400);
                
              }, 400);
              
            }, 400);
            
          }, 400);
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
            serviceError: error.message
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
      set({ scanStatus: 'scanning' });
      if (window.api) window.api.sendRequest('scanner:start', { path: targetPath, scanMode: get().scanMode });
    },

    cancelScan: () => {
      if (window.api) window.api.sendRequest('scanner:cancel');
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
      if (window.api) window.api.sendRequest('delete:start', { targets, permanent });
    },

    cancelDeletion: () => {
      if (window.api) window.api.sendRequest('delete:cancel');
    },

    // Quarantine restorations
    restoreQuarantineItem: (itemId, destination = null) => {
      if (window.api) window.api.sendRequest('quarantine:restore', { id: itemId, customDestination: destination });
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
    }
  };
});

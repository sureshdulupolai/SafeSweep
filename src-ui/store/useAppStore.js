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
      window.api.sendRequest('developer:setMode', { enabled });
    },

    // Scan priority levels (quick, balanced, deep)
    scanMode: 'balanced',
    setScanMode: (mode) => set({ scanMode: mode }),

    // Custom exclusion list paths
    exclusions: [],
    fetchExclusions: () => window.api.sendRequest('exclusions:list'),

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
    activeSimulation: null, // Holds Smart Delete dry-run simulation data

    // Quarantine recoveries
    quarantineItems: [],
    fetchQuarantine: () => window.api.sendRequest('quarantine:list'),

    // System alerts from Watchdog
    serviceWarning: null,
    serviceError: null,

    // Initialize API bridge listeners
    initBridge: () => {
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
        } else if (method === 'delete.progress') {
          set({
            deletedCount: params.deleted_count,
            failedCount: params.failed_count
          });
        }
      });

      // 2. Process standard sidecar method responses
      unsubscribeResponse = window.api.onResponse((packet) => {
        const { error, result, id } = packet;

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

        // Route actions based on result status fields or types
        if (result.status === 'online') {
          set({ exclusions: result.custom_exclusions });
        } else if (result.status === 'scan_started') {
          set({ 
            scanStatus: 'scanning', 
            scannedCount: 0, 
            scannedBytes: 0, 
            scannedFiles: [], 
            safeModeEnforced: false,
            safetyWarning: null
          });
        } else if (result.status === 'completed' && result.files_found_count !== undefined) {
          // Scanner complete
          set({ 
            scanStatus: 'completed',
            safeModeEnforced: result.safe_mode_enforced,
            safetyWarning: result.warning
          });
        } else if (result.status === 'delete_started') {
          set({ deleteStatus: 'deleting', deletedCount: 0, failedCount: 0 });
        } else if (result.status === 'completed' && result.deleted !== undefined) {
          // Deletion complete
          set({ deleteStatus: 'completed', activeSimulation: null });
          get().fetchQuarantine();
        } else if (result.duplicates !== undefined) {
          set({ duplicatesList: result.duplicates, duplicatesStatus: 'completed' });
        } else if (Array.isArray(result)) {
          // It's either an exclusions list or quarantine items array
          // check if they are exclusions or quarantine
          if (result.length === 0) return;
          if (result[0].id !== undefined) {
            set({ quarantineItems: result });
          } else {
            set({ exclusions: result });
          }
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
    },

    // Trigger scanning calls
    startScan: (targetPath) => {
      set({ scanStatus: 'scanning' });
      window.api.sendRequest('scanner:start', { path: targetPath, scanMode: get().scanMode });
    },

    cancelScan: () => {
      window.api.sendRequest('scanner:cancel');
      set({ scanStatus: 'cancelled' });
    },

    // Execute dry-run Smart Delete simulation
    runDeleteSimulation: (selectedPaths) => {
      // The dry-run simulation occurs locally on the sidecar before actual delete commits.
      // We pass the selection list to compile warnings.
      // For this implementation, we simulate it directly in the UI store by checking 
      // paths, risk classifications, and metadata lock values.
      const files = get().scannedFiles.filter(f => selectedPaths.includes(f.path));
      const files_to_remove = [];
      const files_skipped = [];
      const protected_ignored = [];
      let total_freed_bytes = 0;
      const risk_summary = { SAFE: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };

      files.forEach(f => {
        if (f.risk === 'CRITICAL') {
          protected_ignored.append({ path: f.path, reason: 'Protected System Element' });
          risk_summary.CRITICAL++;
        } else {
          total_freed_bytes += f.size;
          risk_summary[f.risk]++;
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
      window.api.sendRequest('delete:start', { targets, permanent });
    },

    cancelDeletion: () => {
      window.api.sendRequest('delete:cancel');
    },

    // Quarantine restorations
    restoreQuarantineItem: (itemId, destination = null) => {
      window.api.sendRequest('quarantine:restore', { id: itemId, customDestination: destination });
    },

    // Add and remove custom exclusions
    addExclusion: (exclusionPath) => {
      window.api.sendRequest('exclusions:add', { path: exclusionPath });
      setTimeout(() => get().fetchExclusions(), 500);
    },

    removeExclusion: (exclusionPath) => {
      window.api.sendRequest('exclusions:remove', { path: exclusionPath });
      setTimeout(() => get().fetchExclusions(), 500);
    }
  };
});

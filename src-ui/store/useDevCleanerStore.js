import { create } from 'zustand';

// Helper to use window.api safely or fallback to fetch
const fetchWithApi = async (method, params = {}) => {
  if (window.api && window.api.sendRequest && window.api.onResponse) {
    return new Promise((resolve, reject) => {
      const id = Date.now(); // or a counter
      const unsubscribe = window.api.onResponse((packet) => {
        // Safe check for packet validity
        if (!packet || typeof packet !== 'object') return;
        
        // Use method name or ID to match response
        if (packet.id === id || (packet.id === null && packet.error)) {
          unsubscribe();
          if (packet.error) {
            reject(new Error(packet.error.message || 'RPC Error'));
          } else {
            resolve(packet.result);
          }
        }
      });
      // Send standard JSON-RPC 2.0 object to Electron Main IPC
      window.api.sendRequest(method, params, id);
    });
  } else {
    // Fallback for browser dev mode (assuming HTTP endpoint available)
    const response = await fetch('http://127.0.0.1:9988/api/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: Date.now() })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message || (typeof data.error === 'string' ? data.error : 'RPC Error'));
    return data.result;
  }
};

let unsubscribeNotify = null;

export const useDevCleanerStore = create((set, get) => ({
  // State
  step: 'scan', // 'scan' | 'analyze' | 'install' | 'delete' | 'success'
  isScanning: false,
  isAnalyzing: false,
  isDeleting: false,
  
  currentScanPath: '',
  devCaches: [],
  masterList: [],
  targetPath: '',
  installLogs: [],
  failedInstalls: [],
  deleteResults: [],
  
  // Actions
  scanCaches: async (paths = ['C:\\'], language = 'python', customTargets = []) => {
    set({ isScanning: true, step: 'scan', devCaches: [], currentScanPath: '', selectedLanguage: language });
    
    // Subscribe to streaming notifications
    if (window.api && window.api.onNotification) {
      if (unsubscribeNotify) unsubscribeNotify();
      unsubscribeNotify = window.api.onNotification((packet) => {
        if (packet.method === 'dev_scanner.progress') {
          const caches = packet.params.caches || [];
          set(state => ({ devCaches: [...state.devCaches, ...caches] }));
        } else if (packet.method === 'dev_scanner.current_path') {
          set({ currentScanPath: packet.params.path });
        } else if (packet.method === 'dev_scanner.completed') {
          set({ isScanning: false });
        } else if (packet.method === 'dev_scanner.error') {
          set({ isScanning: false });
          console.error(packet.params.message);
        }
      });
    }

    try {
      const isBrowserFallback = !window.api || !window.api.onNotification;
      const res = await fetchWithApi('dev.scan', { paths, language, custom_targets: customTargets, sync: isBrowserFallback });
      
      // If running in browser mode without IPC, we won't get streaming,
      // but the backend will run synchronously and return the full results.
      if (isBrowserFallback) {
        set({ devCaches: res.caches || [], isScanning: false });
      }
    } catch (e) {
      console.error(e);
      set({ isScanning: false });
    }
  },
  
  cancelScan: async () => {
    try {
      await fetchWithApi('dev.cancel_scan', {});
      set({ isScanning: false, currentScanPath: '' });
    } catch (e) {
      console.error('Failed to cancel scan:', e);
    }
  },
  
  analyzeEnvs: async (envPaths, language) => {
    set({ isAnalyzing: true, step: 'analyze' });
    try {
      const res = await fetchWithApi('dev.analyze_envs', { env_paths: envPaths, language: language });
      set({ masterList: res.master_list || [], isAnalyzing: false });
    } catch (e) {
      console.error(e);
      set({ isAnalyzing: false });
    }
  },
  
  updateMasterListVersion: (pkgName, newVersion) => {
    set((state) => ({
      masterList: state.masterList.map(pkg => 
        pkg.name === pkgName ? { ...pkg, selected_version: newVersion } : pkg
      )
    }));
  },
  
  addNewPackageToMasterList: (pkgName, version) => {
    set((state) => ({
      masterList: [...state.masterList, { name: pkgName, versions: [], selected_version: version }]
    }));
  },
  
  generateDownloads: () => {
    const state = get();
    const masterList = state.masterList;
    const lang = state.selectedLanguage || 'python';
    
    let fileName = "requirements.txt";
    let fileContent = "";
    
    if (lang === 'node') {
      fileName = "package.json";
      const deps = {};
      masterList.forEach(pkg => {
        deps[pkg.name] = pkg.selected_version ? `^${pkg.selected_version}` : "*";
      });
      fileContent = JSON.stringify({
        name: "safesweep-consolidated-project",
        version: "1.0.0",
        dependencies: deps
      }, null, 2);
    } else if (lang === 'rust') {
      fileName = "Cargo.toml";
      fileContent = "[package]\nname = \"safesweep_consolidated\"\nversion = \"0.1.0\"\nedition = \"2021\"\n\n[dependencies]\n";
      masterList.forEach(pkg => {
        fileContent += `${pkg.name} = "${pkg.selected_version || '*'}"\n`;
      });
    } else if (lang === 'java') {
      fileName = "dependencies.txt";
      fileContent = "# Maven / Gradle Dependencies\n";
      masterList.forEach(pkg => {
        fileContent += `${pkg.name}:${pkg.selected_version || 'latest'}\n`;
      });
    } else {
      // Python
      fileContent = "# Auto-generated by SafeSweep DevCleaner\n";
      masterList.forEach(pkg => {
        if (pkg.selected_version && pkg.selected_version.trim() !== '') {
          fileContent += `${pkg.name}==${pkg.selected_version}\n`;
        } else {
          fileContent += `${pkg.name}\n`;
        }
      });
    }
    
    // 2. Generate environments_report.txt
    let reportText = "SafeSweep Environment Analysis Report\n";
    reportText += "=====================================\n\n";
    masterList.forEach(pkg => {
      reportText += `Package: ${pkg.name}\n`;
      reportText += `Selected Version: ${pkg.selected_version || 'None specified'}\n`;
      reportText += `Found in:\n`;
      if (pkg.occurrences && pkg.occurrences.length > 0) {
        pkg.occurrences.forEach(occ => {
          reportText += `  - v${occ.version} at ${occ.path}\n`;
        });
      } else {
        reportText += `  - Manually added or no path data.\n`;
      }
      reportText += `\n`;
    });
    
    // Download utility
    const downloadBlob = (text, filename) => {
      const blobReq = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const urlReq = URL.createObjectURL(blobReq);
      const linkReq = document.createElement('a');
      linkReq.href = urlReq;
      linkReq.download = filename;
      document.body.appendChild(linkReq);
      linkReq.click();
      document.body.removeChild(linkReq);
      URL.revokeObjectURL(urlReq);
    };
    
    downloadBlob(fileContent, fileName);
    downloadBlob(reportText, 'environments_report.txt');
    
    set({ step: 'delete' });
  },
  
  deleteOldEnvs: async (envPaths) => {
    set({ isDeleting: true });
    try {
      const res = await fetchWithApi('dev.delete_envs', { env_paths: envPaths });
      set({ 
        deleteResults: res.results || [], 
        isDeleting: false,
        step: 'success'
      });
    } catch (e) {
      console.error(e);
      set({ isDeleting: false });
    }
  },
  
  resetStore: () => {
    const state = get();
    if (state.isDeleting) {
      // Tell backend to abort the deletion loop
      fetchWithApi('dev.cancel_delete_envs', {}).catch(console.error);
    }
    
    set({
      step: 'scan',
      isScanning: false,
      isAnalyzing: false,
      isDeleting: false,
      currentScanPath: '',
      devCaches: [],
      masterList: [],
      deleteResults: []
    });
  }
}));

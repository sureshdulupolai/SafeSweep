import React, { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Trash2, Search, PackageMinus, ShieldAlert, Cpu, AlertTriangle, Loader2, Eraser, CheckCircle2 } from 'lucide-react';

export default function Uninstaller() {
  const fetchInstalledApps = useAppStore(state => state.fetchInstalledApps);
  const uninstallerApps = useAppStore(state => state.uninstallerApps);
  const uninstallerStatus = useAppStore(state => state.uninstallerStatus);
  const uninstallApp = useAppStore(state => state.uninstallApp);
  const cleanLeftovers = useAppStore(state => state.cleanLeftovers);
  const researchApp = useAppStore(state => state.researchApp);

  const [searchQuery, setSearchQuery] = useState('');
  const [sizeFilter, setSizeFilter] = useState('all'); // 'all', 'large', 'small'
  const [activeApp, setActiveApp] = useState(null); // the app being uninstalled/cleaned
  const [modalStep, setModalStep] = useState(null); // 'confirm_delete', 'uninstalling', 'cleaning', 'completed', 'researching', 'research_result'
  const [leftoverResults, setLeftoverResults] = useState(null);
  const [researchData, setResearchData] = useState(null);
  const [confirmDeleteText, setConfirmDeleteText] = useState('');

  useEffect(() => {
    fetchInstalledApps();
  }, [fetchInstalledApps]);

  const filteredApps = useMemo(() => {
    // 1. Double-layer security filter (Frontend blocking)
    const forbiddenPublishers = ["microsoft", "google", "windows", "mozilla", "brave", "opera", "yandex", "apple"];
    const forbiddenKeywords = ["chrome", "edge", "firefox", "brave", "opera", "safari", "browser"];
    
    let result = uninstallerApps.filter(app => {
      const pub = app.publisher.toLowerCase();
      const name = app.name.toLowerCase();
      
      // Block if publisher contains any forbidden string
      if (forbiddenPublishers.some(fp => pub.includes(fp))) return false;
      
      // Block if app name contains any forbidden browser/core string
      if (forbiddenKeywords.some(fk => name.includes(fk))) return false;
      
      return true;
    });

    // 2. Apply search query
    if (searchQuery.trim()) {
      result = result.filter(app => 
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        app.publisher.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // 3. Apply size filter
    if (sizeFilter === 'large') {
      result = result.filter(app => app.estimated_size_kb >= 1048576);
    } else if (sizeFilter === 'small') {
      result = result.filter(app => app.estimated_size_kb < 1048576);
    }

    return result;
  }, [uninstallerApps, searchQuery, sizeFilter]);

  const handleUninstallClick = (app) => {
    setActiveApp(app);
    setConfirmDeleteText('');
    setModalStep('confirm_delete');
  };

  const handleUninstallConfirm = () => {
    if (confirmDeleteText !== 'DELETE') return;
    setModalStep('uninstalling');
    uninstallApp(activeApp.uninstall_string);
  };

  const handleCleanLeftovers = async () => {
    setModalStep('cleaning');
    const results = await cleanLeftovers(activeApp.name);
    setLeftoverResults(results);
    setModalStep('completed');
  };

  const handleResearchClick = async (app) => {
    setActiveApp(app);
    setModalStep('researching');
    const data = await researchApp(app.name);
    setResearchData(data);
    setModalStep('research_result');
  };

  const handleManualSearch = () => {
    const query = `What is ${activeApp?.name} software should I remove it`;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
  };

  const closeModal = () => {
    setModalStep(null);
    setActiveApp(null);
    setLeftoverResults(null);
    setResearchData(null);
    fetchInstalledApps(); // refresh list
  };

  const formatSize = (kb) => {
    if (!kb) return 'Unknown Size';
    const mb = kb / 1024;
    if (mb > 1024) return (mb / 1024).toFixed(2) + ' GB';
    return mb.toFixed(1) + ' MB';
  };

  const getAppColor = (name) => {
    const colors = [
      'bg-blue-500', 'bg-red-500', 'bg-green-500', 'bg-yellow-500',
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-cyan-500', 'bg-teal-500'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      className="flex-1 p-6 flex flex-col overflow-hidden h-full relative"
    >
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-200">App Uninstaller</h2>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-xs text-gray-400">Completely remove applications and their leftover traces</p>
            {uninstallerStatus === 'completed' && (
              <span className="bg-brand-accent/10 text-brand-accent px-2 py-0.5 rounded text-[10px] font-bold tracking-wider">
                {filteredApps.length} APPS
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sizeFilter}
            onChange={(e) => setSizeFilter(e.target.value)}
            className="px-4 py-2 bg-brand-darkest border border-brand-border rounded-lg text-sm text-gray-200 focus:outline-none focus:border-brand-accent transition-colors"
          >
            <option value="all">All Sizes</option>
            <option value="large">&ge; 1 GB</option>
            <option value="small">&lt; 1 GB</option>
          </select>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search installed apps..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-brand-darkest border border-brand-border rounded-lg text-sm text-gray-200 focus:outline-none focus:border-brand-accent transition-colors w-64"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 bg-brand-card border border-brand-border rounded-xl overflow-hidden flex flex-col relative">
        {uninstallerStatus === 'loading' && (
          <div className="absolute inset-0 z-10 bg-brand-dark/50 backdrop-blur-sm flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 text-brand-accent animate-spin mb-4" />
            <p className="text-sm font-semibold text-gray-300 animate-pulse tracking-widest uppercase">Parsing Registry</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredApps.map(app => (
              <div key={app.id} className="bg-brand-dark border border-brand-border rounded-lg p-4 hover:border-brand-accent/50 transition-colors group flex flex-col justify-between">
                <div className="flex items-start gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center shadow-lg text-white font-bold text-lg ${getAppColor(app.name)}`}>
                    {app.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="text-sm font-bold text-gray-200 truncate" title={app.name}>{app.name}</h3>
                    <p className="text-[10px] text-gray-500 truncate mt-0.5" title={app.publisher}>{app.publisher}</p>
                    <p className="text-[10px] font-mono text-gray-400 mt-1">{formatSize(app.estimated_size_kb)}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleResearchClick(app)}
                    className="flex-1 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg text-xs font-bold tracking-wider uppercase transition-colors flex items-center justify-center gap-2"
                  >
                    <Search className="h-3 w-3" />
                    Research
                  </button>
                  <button
                    onClick={() => handleUninstallClick(app)}
                    className="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold tracking-wider uppercase transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="h-3 w-3" />
                    Uninstall
                  </button>
                </div>
              </div>
            ))}

            {uninstallerStatus === 'completed' && filteredApps.length === 0 && (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-500">
                <PackageMinus className="h-12 w-12 mb-4 opacity-50" />
                <p>No applications found matching your search.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Uninstaller Wizard Modal */}
      {createPortal(
        <AnimatePresence>
          {modalStep && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="bg-brand-darkest border border-brand-border rounded-2xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] max-w-lg w-full overflow-hidden flex flex-col relative"
              >
                {modalStep === 'confirm_delete' && (
                  <div className="p-8 text-center">
                    <div className="w-20 h-20 mx-auto bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                      <AlertTriangle className="h-10 w-10 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Confirm Uninstallation</h2>
                    <p className="text-sm text-gray-400 mb-6">
                      You are about to completely remove <span className="font-bold text-red-400">{activeApp?.name}</span> and all its residual files from your system.
                    </p>

                    <div className="bg-brand-dark/50 border border-brand-border rounded-lg p-6 mb-6 text-left">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                        Type <span className="text-red-400 font-mono bg-red-500/10 px-1 rounded">DELETE</span> to confirm
                      </label>
                      <input
                        type="text"
                        value={confirmDeleteText}
                        onChange={(e) => setConfirmDeleteText(e.target.value)}
                        placeholder="DELETE"
                        className="w-full bg-brand-darkest border border-brand-border rounded-lg px-4 py-3 text-white font-mono uppercase focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all text-center tracking-widest"
                        autoFocus
                      />
                    </div>

                    <div className="flex gap-4 justify-center mt-2">
                      <button
                        onClick={closeModal}
                        className="px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-wider text-gray-400 hover:bg-brand-card transition-colors flex-1"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleUninstallConfirm}
                        disabled={confirmDeleteText !== 'DELETE'}
                        className="px-6 py-3 bg-red-500 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-1 shadow-[0_0_20px_rgba(239,68,68,0.3)] disabled:shadow-none"
                      >
                        Force Uninstall
                      </button>
                    </div>
                  </div>
                )}

                {modalStep === 'researching' && (
                  <div className="p-12 flex flex-col items-center justify-center">
                    <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-6" />
                    <h2 className="text-lg font-bold text-white mb-2">Researching Application</h2>
                    <p className="text-xs text-gray-400 font-mono text-center">Fetching details for <span className="text-blue-400">{activeApp?.name}</span>...</p>
                  </div>
                )}

                {modalStep === 'research_result' && (
                  <div className="p-8 text-center">
                    <div className="w-20 h-20 mx-auto bg-blue-500/10 rounded-full flex items-center justify-center mb-6 border border-blue-500/30">
                      <Search className="h-10 w-10 text-blue-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Research: {activeApp?.name}</h2>
                    
                    <div className="bg-brand-dark/50 border border-brand-border rounded-lg p-5 mb-6 text-left relative">
                      {researchData?.source && (
                        <div className="absolute -top-3 left-4 bg-brand-dark px-2 text-[10px] text-blue-400 font-mono font-bold border border-brand-border rounded">
                          Source: {researchData.source}
                        </div>
                      )}
                      <p className="text-sm text-gray-300 leading-relaxed max-h-40 overflow-y-auto custom-scrollbar">
                        {researchData?.description}
                      </p>
                    </div>

                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6 text-left flex gap-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                      <p className="text-xs text-yellow-500/90 leading-relaxed">
                        If you're still unsure about what this app does or whether to keep it, you can perform a direct Google search to read forums and user advice.
                      </p>
                    </div>

                    <div className="flex gap-4 justify-center">
                      <button
                        onClick={closeModal}
                        className="px-6 py-2.5 rounded-lg text-xs font-semibold text-gray-400 hover:bg-brand-card transition-colors"
                      >
                        Close
                      </button>
                      <button
                        onClick={handleManualSearch}
                        className="px-6 py-2.5 bg-blue-500 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-blue-600 transition-colors flex items-center gap-2"
                      >
                        <Search className="h-4 w-4" />
                        Search Online
                      </button>
                    </div>
                  </div>
                )}

                {modalStep === 'uninstalling' && (
                  <>
                    <div className="p-8 text-center">
                      <div className="w-20 h-20 mx-auto bg-brand-accent/10 rounded-full flex items-center justify-center mb-6 animate-pulse border border-brand-accent/30">
                        <PackageMinus className="h-10 w-10 text-brand-accent" />
                      </div>
                      <h2 className="text-xl font-bold text-white mb-2">Uninstaller Launched</h2>
                      <p className="text-sm text-gray-400 mb-6">
                        The native Windows uninstaller for <span className="font-bold text-gray-200">{activeApp?.name}</span> has been started. Please complete the uninstaller wizard.
                      </p>

                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-8 text-left flex gap-3">
                        <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                        <p className="text-xs text-yellow-500/90 leading-relaxed">
                          Do not click the button below until the uninstaller has completely finished. Clicking it prematurely may cause issues.
                        </p>
                      </div>

                      <div className="flex gap-4 justify-center">
                        <button
                          onClick={closeModal}
                          className="px-6 py-2.5 rounded-lg text-xs font-semibold text-gray-400 hover:bg-brand-card transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleCleanLeftovers}
                          className="px-6 py-2.5 bg-brand-accent text-brand-darkest rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-cyan-400 transition-colors flex items-center gap-2"
                        >
                          <Eraser className="h-4 w-4" />
                          Proceed to Clean Leftovers
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {modalStep === 'cleaning' && (
                  <div className="p-12 flex flex-col items-center justify-center">
                    <Loader2 className="h-12 w-12 text-brand-accent animate-spin mb-6" />
                    <h2 className="text-lg font-bold text-white mb-2">Scanning for Leftovers</h2>
                    <p className="text-xs text-gray-400 font-mono">Searching AppData & Registry for traces...</p>
                  </div>
                )}

                {modalStep === 'completed' && (
                  <div className="p-8 text-center">
                    <div className="w-20 h-20 mx-auto bg-brand-green/10 rounded-full flex items-center justify-center mb-6 border border-brand-green/30">
                      <CheckCircle2 className="h-10 w-10 text-brand-green" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2 text-transparent bg-clip-text bg-gradient-to-r from-brand-green to-cyan-400">
                      Cleanup Complete
                    </h2>
                    <p className="text-sm text-gray-400 mb-6">Leftover files and registry keys have been purged.</p>

                    <div className="bg-brand-card border border-brand-border rounded-lg p-4 mb-8 text-left text-xs font-mono text-gray-400 space-y-2 h-32 overflow-y-auto custom-scrollbar">
                      {leftoverResults?.cleaned_paths?.length === 0 && leftoverResults?.cleaned_registry?.length === 0 && (
                        <div className="text-center italic mt-8 text-gray-500">No leftover traces found.</div>
                      )}
                      {leftoverResults?.cleaned_paths?.map((p, i) => (
                        <div key={'p' + i} className="text-red-400 truncate flex gap-2"><Trash2 className="h-3 w-3 flex-shrink-0 mt-0.5" /> {p}</div>
                      ))}
                      {leftoverResults?.cleaned_registry?.map((r, i) => (
                        <div key={'r' + i} className="text-purple-400 truncate flex gap-2"><Trash2 className="h-3 w-3 flex-shrink-0 mt-0.5" /> {r}</div>
                      ))}
                    </div>

                    <button
                      onClick={closeModal}
                      className="px-8 py-2.5 bg-brand-dark border border-brand-border text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-brand-card transition-colors"
                    >
                      Close
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  );
}

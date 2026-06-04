import React, { useEffect, useState } from 'react';
import { useDevCleanerStore } from '../../store/useDevCleanerStore';
import { Code, Search, ArrowRight, Save, Trash2, Folder, CheckCircle, Loader2, Download, Terminal, Plus, X } from 'lucide-react';
import MasterList from './MasterList';
import AwsDeleteConfirm from './AwsDeleteConfirm';

const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const SCAN_STEPS = [
  "Querying C:\\ drive NTFS analytics...",
  "Locating python virtual environments...",
  "Scanning node_modules and npm caches...",
  "Aggregating __pycache__ and dist folders...",
  "Building master developer cache list...",
  "Finalizing deep system analysis..."
];

function ProgressiveLoader({ currentPath }) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep(s => (s < SCAN_STEPS.length - 1 ? s + 1 : s));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-md mx-auto mt-6 bg-black/40 border border-brand-border/40 p-4 rounded-lg font-mono text-xs">
      {SCAN_STEPS.map((step, idx) => (
        <div key={idx} className="flex items-center gap-3 mb-2 last:mb-0">
          {idx < currentStep ? (
            <CheckCircle className="w-4 h-4 text-brand-green" />
          ) : idx === currentStep ? (
            <Loader2 className="w-4 h-4 text-brand-accent animate-spin" />
          ) : (
            <div className="w-4 h-4 rounded-full border border-gray-700" />
          )}
          <span className={idx < currentStep ? "text-gray-400" : idx === currentStep ? "text-brand-accent font-semibold" : "text-gray-600"}>
            {step}
          </span>
        </div>
      ))}
      {currentPath && (
        <div className="mt-4 pt-3 border-t border-brand-border/40 text-[10px] text-gray-500 truncate flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span className="truncate">Scanning: {currentPath}</span>
        </div>
      )}
    </div>
  );
}

export default function DevCleaner() {
  const { 
    step, isScanning, isAnalyzing, devCaches, currentScanPath,
    scanCaches, analyzeEnvs, generateDownloads, resetStore, deleteResults
  } = useDevCleanerStore();
  
  useEffect(() => {
    resetStore();
  }, [resetStore]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => resetStore();
  }, [resetStore]);

  const [selectedLanguage, setSelectedLanguage] = useState('python');
  const [customTargets, setCustomTargets] = useState([]);
  const [customInput, setCustomInput] = useState('');

  const handleAddCustomTarget = () => {
    if (customInput.trim() && !customTargets.includes(customInput.trim())) {
      setCustomTargets([...customTargets, customInput.trim()]);
      setCustomInput('');
    }
  };

  const handleRemoveCustomTarget = (target) => {
    setCustomTargets(customTargets.filter(t => t !== target));
  };

  const handleScan = () => {
    scanCaches('C:\\', selectedLanguage, customTargets);
  };

  const handleAnalyze = () => {
    const pythonEnvs = devCaches.filter(c => c.is_python_env).map(c => c.path);
    if (pythonEnvs.length > 0) {
      analyzeEnvs(pythonEnvs);
    }
  };

  const pythonEnvs = devCaches.filter(c => c.is_python_env);
  const totalSpace = pythonEnvs.reduce((acc, c) => acc + c.size, 0);

  return (
    <div className="flex flex-col h-full overflow-hidden text-gray-200">
      <div className="flex items-center justify-between p-6 border-b border-brand-border/40 bg-brand-darkest shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Code className="h-6 w-6 text-brand-accent" />
            Developer Environment Consolidator
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Scan for heavy developer caches and consolidate them to free up massive disk space.
          </p>
        </div>
        {step !== 'scan' && (
          <button 
            onClick={resetStore}
            className="text-xs bg-brand-card hover:bg-brand-card/80 border border-brand-border px-3 py-1.5 rounded transition-colors"
          >
            Start Over
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-brand-dark">
        {/* STEP 1: SCANNING */}
        {step === 'scan' && (
          <div className="glass-card p-6 border border-brand-border flex flex-col items-center justify-center text-center space-y-4">
            <div className="h-16 w-16 bg-brand-accent/10 rounded-full flex items-center justify-center mb-2">
              <Search className="h-8 w-8 text-brand-accent" />
            </div>
            <h2 className="text-xl font-semibold">Find Scattered Environments</h2>
            <p className="text-gray-400 text-sm max-w-md">
              Select a language and a starting directory. We will scan it to find heavy development folders and caches.
            </p>
            
            <div className="flex flex-col gap-3 w-full max-w-md mt-4 text-left">
              <div>
                <label className="text-xs text-gray-500 font-semibold mb-1 block">Programming Language</label>
                <select 
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full bg-brand-dark border border-brand-border text-sm rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-brand-accent transition-colors appearance-none"
                >
                  <option value="python">Python (venv, __pycache__, conda)</option>
                  <option value="node">Node.js / React (node_modules, npm-cache)</option>
                  <option value="java">Java / Android (.gradle, .m2, target)</option>
                  <option value="rust">Rust (cargo, target)</option>
                  <option value="all">All Languages (Full Scan)</option>
                </select>
              </div>
            </div>

            <div className="w-full max-w-sm mx-auto mt-4 text-left">
              <label className="text-xs font-semibold text-gray-400 mb-2 block">
                Custom Environment Names (Optional)
              </label>
              
              {customTargets.map((target, idx) => (
                <div key={idx} className="flex items-center justify-between bg-brand-dark border border-brand-border rounded px-3 py-2 mb-2">
                  <span className="text-sm font-mono text-gray-300">{target}</span>
                  <button 
                    onClick={() => handleRemoveCustomTarget(target)}
                    className="text-gray-500 hover:text-brand-rose transition-colors"
                    disabled={isScanning}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTarget()}
                  placeholder="e.g. my_custom_env"
                  disabled={isScanning}
                  className="flex-1 bg-brand-darkest border border-brand-border rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-accent transition-colors"
                />
                <button
                  onClick={handleAddCustomTarget}
                  disabled={!customInput.trim() || isScanning}
                  className="bg-brand-card hover:bg-brand-card/80 border border-brand-border disabled:opacity-50 text-gray-300 px-3 py-2 rounded transition-colors flex items-center justify-center"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <button 
              onClick={handleScan}
              disabled={isScanning}
              className="w-full max-w-sm mt-8 mx-auto bg-brand-accent hover:bg-brand-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isScanning ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Scanning deeply, please wait...</span>
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Start Full Scan
                </>
              )}
            </button>
            
            {isScanning && <ProgressiveLoader currentPath={currentScanPath} />}
            
            {devCaches.length > 0 && !isScanning && (
              <div className="w-full mt-8 text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2 mb-4">
                  {pythonEnvs.map((env, i) => (
                    <div key={i} className="bg-brand-darkest border border-brand-border p-3 rounded flex flex-col">
                      <span className="text-xs font-mono text-gray-300 truncate" title={env.path}>{env.path}</span>
                      <div className="flex justify-between mt-2 text-[10px] text-gray-500 uppercase tracking-wider">
                        <span>{env.name}</span>
                        <span className="text-brand-accent font-semibold">{formatBytes(env.size)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-4 p-4 border-t border-brand-border/40 bg-brand-dark/50 items-center justify-between">
                  <span className="text-sm text-gray-400">
                    {devCaches.length} environments found ({formatBytes(totalSpace)} total)
                  </span>
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || devCaches.length === 0}
                    className="bg-brand-accent hover:bg-brand-accent/90 disabled:opacity-50 px-6 py-2 rounded-lg text-white font-medium flex items-center gap-2 transition-colors"
                  >
                    {isAnalyzing ? "Analyzing..." : "Review Packages for Consolidation"}
                    {!isAnalyzing && <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: ANALYZE & MASTER LIST */}
        {step === 'analyze' && (
          <div className="space-y-6">
            <MasterList />
            
            <div className="p-6 bg-brand-card rounded-xl border border-brand-border shadow-lg space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white mb-2">Export & Manual Consolidation Guide</h2>
                <p className="text-sm text-gray-400">
                  Instead of running background commands, you are in full control. Download your files and run these commands in your own terminal to create your new environment.
                </p>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={generateDownloads}
                  className="flex-1 bg-brand-darkest hover:bg-brand-dark border border-brand-accent text-white px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Download className="w-5 h-5 text-brand-accent" />
                  Download requirements.txt & Report
                </button>
              </div>

              <div className="bg-black/50 p-4 rounded-lg border border-brand-border/40 font-mono text-sm text-gray-300">
                <div className="flex items-center gap-2 mb-3 text-brand-accent border-b border-brand-border/40 pb-2">
                  <Terminal className="w-4 h-4" />
                  <span>Manual Commands</span>
                </div>
                <div className="space-y-2">
                  <p className="text-gray-500"># 1. Open your terminal and create a new master environment</p>
                  <p>python -m venv C:\path\to\your\MasterEnv</p>
                  
                  <p className="text-gray-500 mt-4"># 2. Activate the new environment</p>
                  <p>C:\path\to\your\MasterEnv\Scripts\activate</p>
                  
                  <p className="text-gray-500 mt-4"># 3. Install the consolidated packages from the file you downloaded</p>
                  <p>pip install -r requirements.txt</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: AWS DELETE */}
        {step === 'delete' && (
          <div className="space-y-6">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <AwsDeleteConfirm />
            </div>
          </div>
        )}
        
        {/* STEP 5: SUCCESS */}
        {step === 'success' && (
          <div className="glass-card p-10 border border-brand-green/30 flex flex-col items-center justify-center text-center space-y-4">
            <div className="h-20 w-20 bg-brand-green/10 rounded-full flex items-center justify-center mb-2">
              <CheckCircle className="h-10 w-10 text-brand-green" />
            </div>
            <h2 className="text-2xl font-bold text-gray-200">Consolidation Complete!</h2>
            <p className="text-gray-400 text-sm max-w-md">
              Your new master environment has been created successfully, and {deleteResults.filter(r => r.deleted).length} old scattered environments have been permanently wiped from your disk.
            </p>
            <button 
              onClick={resetStore}
              className="mt-6 bg-brand-card hover:bg-brand-card/80 border border-brand-border px-6 py-2 rounded-lg font-semibold transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

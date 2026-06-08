import React, { useEffect, useState } from 'react';
import { useDevCleanerStore } from '../../store/useDevCleanerStore';
import { Code, ShieldAlert, FolderSearch } from 'lucide-react';
import MasterList from './MasterList';
import AwsDeleteConfirm from './AwsDeleteConfirm';
import { useProgressiveText } from './DevCleanerUtils';

import DevCleanerScanSetup from './DevCleanerScanSetup';
import DevCleanerFoundEnvs from './DevCleanerFoundEnvs';
import DevCleanerAnalyzeGuide from './DevCleanerAnalyzeGuide';
import DevCleanerSuccess from './DevCleanerSuccess';

export default function DevCleaner() {
  const { 
    step, isScanning, isAnalyzing, devCaches, currentScanPath, masterList,
    scanCaches, analyzeEnvs, generateDownloads, resetStore, deleteResults, cancelScan
  } = useDevCleanerStore();
  
  useEffect(() => {
    resetStore();
  }, [resetStore]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => resetStore();
  }, [resetStore]);

  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [customInput, setCustomInput] = useState('');
  const [customTargets, setCustomTargets] = useState([]);
  const [debounceWarning, setDebounceWarning] = useState('');
  
  const [scanMode, setScanMode] = useState('full');
  const [customScanPaths, setCustomScanPaths] = useState([]);
  const [pathInput, setPathInput] = useState('');
  
  const [checkedEnvs, setCheckedEnvs] = useState([]);
  const [lastScanCount, setLastScanCount] = useState(0);
  const [errorToast, setErrorToast] = useState('');

  const showToast = (msg) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(''), 3000);
  };
  
  const scanText = useProgressiveText(isScanning, devCaches.length, selectedLanguage);

  // Debounce check for existing defaults
  useEffect(() => {
    const timer = setTimeout(() => {
      const lower = customInput.trim().toLowerCase();
      if (!lower) {
        setDebounceWarning('');
        return;
      }
      
      const defaults = {
        python: ['venv', '.env', 'virtualenv', 'anaconda3', 'miniconda3', '__pycache__', '.pytest_cache', '.mypy_cache', 'ruff_cache'],
        node: ['node_modules', 'npm-cache', 'yarn-cache', 'pnpm-store'],
        java: ['.gradle', '.m2', 'target'],
        rust: ['cargo', 'target']
      };
      
      let isDefault = false;
      if (selectedLanguage === 'all') {
        isDefault = Object.values(defaults).flat().includes(lower);
      } else {
        isDefault = defaults[selectedLanguage]?.includes(lower);
      }
      
      if (isDefault) {
        setDebounceWarning(`"${lower}" is already included by default.`);
      } else {
        setDebounceWarning('');
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [customInput, selectedLanguage]);

  useEffect(() => {
    if (devCaches.length > 0 && devCaches.length !== lastScanCount && !isScanning) {
      setCheckedEnvs(devCaches.map(c => c.path));
      setLastScanCount(devCaches.length);
    } else if (devCaches.length === 0 && lastScanCount !== 0) {
      setCheckedEnvs([]);
      setLastScanCount(0);
    }
  }, [devCaches, isScanning, lastScanCount]);

  const handleToggleCheck = (path) => {
    if (checkedEnvs.includes(path)) {
      setCheckedEnvs(checkedEnvs.filter(p => p !== path));
    } else {
      setCheckedEnvs([...checkedEnvs, path]);
    }
  };

  const handleAddCustomTarget = () => {
    const val = customInput.trim();
    if (val) {
      if (customTargets.includes(val)) {
        showToast(`Target name already added: ${val}`);
      } else {
        setCustomTargets([...customTargets, val]);
        setCustomInput('');
      }
    }
  };

  const handleRemoveCustomTarget = (target) => {
    setCustomTargets(customTargets.filter(t => t !== target));
  };

  const handleAddFolder = async () => {
    if (window.api && window.api.selectDirectory) {
      try {
        const result = await window.api.selectDirectory();
        if (result && !result.canceled && result.filePaths && result.filePaths.length > 0) {
          const dirPath = result.filePaths[0];
          if (customScanPaths.includes(dirPath)) {
            showToast(`Folder already added: ${dirPath}`);
          } else {
            setCustomScanPaths([...customScanPaths, dirPath]);
          }
        }
      } catch (err) {
        console.error('Failed to open native folder dialog:', err);
      }
    } else {
      // In browser fallback, first attempt calling the local sidecar's native Windows browse API
      try {
        const res = await fetch('http://127.0.0.1:9988/api/browse');
        const data = await res.json();
        if (data && data.path) {
          if (customScanPaths.includes(data.path)) {
            showToast(`Folder already added: ${data.path}`);
          } else {
            setCustomScanPaths([...customScanPaths, data.path]);
            return;
          }
        }
      } catch (err) {
        console.warn('Local Python browse API offline, falling back to standard browser folder pickers...', err);
      }

      // Browser directory picker fallback
      if (window.showDirectoryPicker) {
        try {
          const handle = await window.showDirectoryPicker();
          const p = `C:\\Users\\user\\${handle.name}`;
          if (customScanPaths.includes(p)) {
            showToast(`Folder already added: ${p}`);
          } else {
            setCustomScanPaths([...customScanPaths, p]);
            return;
          }
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
          if (!customScanPaths.includes(path)) setCustomScanPaths([...customScanPaths, path]);
        }
      };
      input.click();
    }
  };

  const handleManualPathAdd = () => {
    const p = pathInput.trim();
    if (p) {
      if (customScanPaths.includes(p)) {
        showToast(`Folder already added: ${p}`);
      } else {
        setCustomScanPaths([...customScanPaths, p]);
        setPathInput('');
      }
    }
  };

  const handleRemoveFolder = (path) => {
    setCustomScanPaths(customScanPaths.filter(p => p !== path));
  };

  const handleScan = () => {
    let pathsToScan = ['C:\\'];
    if (scanMode === 'custom' && customScanPaths.length > 0) {
      pathsToScan = customScanPaths;
    }
    scanCaches(pathsToScan, selectedLanguage, customTargets);
  };

  const handleProceedToAnalyze = () => {
    // Only analyze the checked envs
    if (checkedEnvs.length > 0) {
      analyzeEnvs(checkedEnvs, selectedLanguage);
    }
  };

  const totalSpace = devCaches.filter(c => checkedEnvs.includes(c.path)).reduce((acc, c) => acc + c.size, 0);

  return (
    <div className="flex flex-col h-full overflow-hidden text-gray-200 relative">
      {/* Toast Notification */}
      {errorToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-brand-rose text-white px-4 py-2 rounded-lg shadow-lg shadow-brand-rose/20 flex items-center gap-2 font-medium text-sm">
            <ShieldAlert className="w-4 h-4" />
            {errorToast}
          </div>
        </div>
      )}
      
      {/* Scrollable Main Layout */}
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
          <>
            <DevCleanerScanSetup 
              isScanning={isScanning}
              scanMode={scanMode}
              setScanMode={setScanMode}
              pathInput={pathInput}
              setPathInput={setPathInput}
              handleManualPathAdd={handleManualPathAdd}
              handleAddFolder={handleAddFolder}
              customScanPaths={customScanPaths}
              handleRemoveFolder={handleRemoveFolder}
              selectedLanguage={selectedLanguage}
              setSelectedLanguage={setSelectedLanguage}
              customInput={customInput}
              setCustomInput={setCustomInput}
              handleAddCustomTarget={handleAddCustomTarget}
              customTargets={customTargets}
              handleRemoveCustomTarget={handleRemoveCustomTarget}
              debounceWarning={debounceWarning}
              scanText={scanText}
              handleScan={handleScan}
              cancelScan={cancelScan}
            />

            {devCaches.length > 0 && !isScanning && (
              <div className="mt-8">
                <h3 className="text-lg font-bold text-white mb-4">Found Environments</h3>
                <DevCleanerFoundEnvs 
                  checkedEnvs={checkedEnvs}
                  handleToggleCheck={handleToggleCheck}
                  totalSpace={totalSpace}
                  handleAnalyze={handleProceedToAnalyze}
                />
              </div>
            )}
          </>
        )}

        {/* STEP 2: ANALYZE & MASTER LIST */}
        {step === 'analyze' && (
          <div className="space-y-6">
            <button 
              onClick={() => useDevCleanerStore.setState({ step: 'scan' })}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              &larr; Back to Selection
            </button>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <DevCleanerAnalyzeGuide />
              </div>
              
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-white">Consolidated Packages Preview</h3>
                {masterList && masterList.length > 0 ? (
                  <MasterList checkedEnvs={checkedEnvs} />
                ) : (
                  <div className="glass-card p-6 border border-brand-border text-center">
                    <FolderSearch className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-white">No Packages Found</h3>
                    <p className="text-gray-400 text-sm mt-2">
                      None of the currently selected environments contained parsable dependencies. You can still proceed to delete them.
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end border-t border-brand-border/40 pt-4">
               <button 
                 onClick={() => useDevCleanerStore.setState({ step: 'delete' })}
                 className="bg-brand-rose hover:bg-brand-rose/90 text-white px-8 py-3 rounded-lg font-bold transition-colors"
               >
                 Proceed to Deletion &rarr;
               </button>
            </div>
          </div>
        )}

        {/* STEP 3: AWS DELETE */}
        {step === 'delete' && (
          <div className="space-y-6">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <AwsDeleteConfirm checkedEnvs={checkedEnvs} />
            </div>
          </div>
        )}
        
        {/* STEP 5: SUCCESS */}
        {step === 'success' && (
          <DevCleanerSuccess />
        )}

      </div>
    </div>
  );
}

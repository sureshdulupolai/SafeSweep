import React from 'react';
import { Search, Loader2, Plus, X } from 'lucide-react';

export default function DevCleanerScanSetup({
  isScanning,
  scanMode,
  setScanMode,
  pathInput,
  setPathInput,
  handleManualPathAdd,
  handleAddFolder,
  customScanPaths,
  handleRemoveFolder,
  selectedLanguage,
  setSelectedLanguage,
  customInput,
  setCustomInput,
  handleAddCustomTarget,
  customTargets,
  handleRemoveCustomTarget,
  debounceWarning,
  scanText,
  handleScan,
  cancelScan
}) {
  return (
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
          <label className="text-xs text-gray-500 font-semibold mb-1 block">Scan Target Area</label>
          <div className="flex bg-brand-darkest border border-brand-border rounded-lg p-1 mb-4">
            <button
              onClick={() => setScanMode('full')}
              disabled={isScanning}
              className={`flex-1 text-sm font-medium py-1.5 rounded transition-colors disabled:opacity-50 ${scanMode === 'full' ? 'bg-brand-accent text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Full PC Scan (C:\)
            </button>
            <button
              onClick={() => setScanMode('custom')}
              disabled={isScanning}
              className={`flex-1 text-sm font-medium py-1.5 rounded transition-colors disabled:opacity-50 ${scanMode === 'custom' ? 'bg-brand-accent text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Specific Folders
            </button>
          </div>
        </div>

        {scanMode === 'custom' && (
          <div className="mb-4">
            <label className="text-xs text-gray-500 font-semibold mb-2 block flex justify-between items-center">
              <span>Target Folders</span>
            </label>
            
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="Paste folder path here..."
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                className="flex-1 bg-brand-darkest border border-brand-border text-sm rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-brand-accent transition-colors disabled:opacity-50"
                disabled={isScanning}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleManualPathAdd();
                }}
              />
              <button 
                onClick={handleManualPathAdd}
                disabled={isScanning || !pathInput.trim()}
                className="bg-brand-accent hover:bg-brand-accent/80 text-white px-3 py-2 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
                title="Add Path"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button 
                onClick={handleAddFolder}
                disabled={isScanning}
                className="bg-brand-card hover:bg-brand-card/80 border border-brand-border text-gray-300 px-3 py-2 rounded-lg transition-colors flex items-center justify-center"
                title="Browse Folder"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
            
            {customScanPaths.length === 0 ? (
              <div className="text-center p-4 border border-dashed border-brand-border rounded bg-brand-darkest text-sm text-gray-500">
                No folders added. We will scan C:\ by default.
              </div>
            ) : (
              <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                {customScanPaths.map((path, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-brand-darkest border border-brand-border rounded px-3 py-2">
                    <span className="text-sm font-mono text-gray-300 truncate mr-2" title={path}>
                      {path}
                    </span>
                    <button 
                      onClick={() => handleRemoveFolder(path)}
                      className="text-gray-500 hover:text-brand-rose transition-colors shrink-0"
                      disabled={isScanning}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="text-xs text-gray-500 font-semibold mb-1 block">Programming Language</label>
          <select 
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            disabled={isScanning}
            className="w-full bg-brand-dark border border-brand-border text-sm rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-brand-accent transition-colors appearance-none disabled:opacity-50"
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
        {debounceWarning && !isScanning && (
          <div className="text-[11px] text-amber-500 mt-2 flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
            <span className="w-3 h-3 block bg-amber-500 rounded-full" />
            {debounceWarning}
          </div>
        )}
      </div>
      
      <div className="w-full max-w-sm mt-8 mx-auto flex flex-col gap-2">
        <button 
          onClick={isScanning ? cancelScan : handleScan}
          className={`w-full font-medium py-2.5 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 ${
            isScanning 
              ? "bg-brand-rose/20 text-brand-rose hover:bg-brand-rose/30 border border-brand-rose/50" 
              : "bg-brand-accent hover:bg-brand-accent/90 text-white"
          }`}
        >
          {isScanning ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin shrink-0 text-brand-rose" />
              <span className="truncate max-w-[280px]">{scanText} (Click to Cancel)</span>
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              Start Full Scan
            </>
          )}
        </button>
      </div>
    </div>
  );
}

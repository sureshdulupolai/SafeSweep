import React, { useState } from 'react';
import { Search, Loader2, Plus, X, Info } from 'lucide-react';

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
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="glass-card p-6 border border-brand-border flex flex-col items-center justify-center text-center space-y-4 relative overflow-hidden">
      
      {/* Help Button */}
      <button 
        onClick={() => setShowHelp(true)}
        className="absolute top-4 right-4 text-gray-500 hover:text-brand-accent transition-colors"
        title="How does this work?"
      >
        <Info className="w-5 h-5" />
      </button>

      {/* Help Modal Overlay */}
      {showHelp && (
        <div className="absolute inset-0 z-50 bg-brand-dark/95 backdrop-blur-sm p-6 flex flex-col text-left overflow-y-auto border border-brand-accent/30 rounded-xl">
          <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Info className="w-5 h-5 text-brand-accent" />
              How Scanning Works
            </h3>
            <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-4 text-sm text-gray-300">
            <div>
              <strong className="text-brand-accent block mb-1">Scan Target Area:</strong>
              <p>• <b>Full PC Scan:</b> Scans your entire C:\ drive. This is extremely thorough but can take several minutes depending on your drive speed.</p>
              <p>• <b>Specific Folders:</b> Only scans the folders you provide. This is lightning fast (often under 5 seconds) and highly recommended if you know where your projects live (e.g., your Desktop or Documents folder).</p>
            </div>
            
            <div>
              <strong className="text-brand-accent block mb-1">Programming Language:</strong>
              <p>Choosing a specific language makes the scan faster and more accurate. For example, if you pick Python, it strictly looks for valid Python environments (like venv or conda) containing python executables. Choosing "All Languages" will look for everything but might take slightly longer.</p>
            </div>
            
            <div>
              <strong className="text-brand-accent block mb-1">Custom Environment Names:</strong>
              <p>By default, we look for standard names like <code className="bg-black/30 px-1 rounded">node_modules</code>, <code className="bg-black/30 px-1 rounded">venv</code>, or <code className="bg-black/30 px-1 rounded">target</code>. If you name your environments something unique (e.g., <code className="bg-black/30 px-1 rounded">my_django_env</code>), you MUST add it here so the scanner knows to look for it.</p>
            </div>
            
            <div className="bg-brand-accent/10 p-3 rounded border border-brand-accent/20 text-xs">
              <strong>💡 Pro Tip:</strong> For the absolute fastest experience, choose "Specific Folders", add your main Projects folder, and select your specific programming language.
            </div>
          </div>
          
          <button 
            onClick={() => setShowHelp(false)}
            className="mt-6 w-full bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors font-medium"
          >
            Got it, let's scan!
          </button>
        </div>
      )}

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

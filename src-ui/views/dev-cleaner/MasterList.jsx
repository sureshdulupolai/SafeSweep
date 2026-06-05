import React, { useState } from 'react';
import { useDevCleanerStore } from '../../store/useDevCleanerStore';
import { Save, Plus, Trash2, Cpu, FolderSearch } from 'lucide-react';

export default function MasterList() {
  const masterList = useDevCleanerStore((state) => state.masterList);
  const devCaches = useDevCleanerStore((state) => state.devCaches);
  const updateMasterListVersion = useDevCleanerStore((state) => state.updateMasterListVersion);
  const addNewPackageToMasterList = useDevCleanerStore((state) => state.addNewPackageToMasterList);
  
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgVersion, setNewPkgVersion] = useState('');
  
  const getParentPath = (fullPath) => {
    if (!fullPath) return '';
    const parts = fullPath.split('\\');
    if (parts.length > 1) {
      parts.pop();
      return parts.join('\\');
    }
    return fullPath;
  };
  
  const handleAdd = () => {
    if (newPkgName.trim()) {
      addNewPackageToMasterList(newPkgName.trim().toLowerCase(), newPkgVersion.trim());
      setNewPkgName('');
      setNewPkgVersion('');
    }
  };

  return (
    <div className="space-y-4">
      {devCaches && devCaches.length > 0 && (
        <div className="bg-brand-dark/40 border border-brand-border/50 rounded-lg p-4 mb-2">
          <h4 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
            <FolderSearch className="h-4 w-4 text-brand-accent" />
            Environments Analyzed ({devCaches.length})
          </h4>
          <div className="max-h-40 overflow-y-auto text-xs font-mono text-gray-400 space-y-1 pr-2">
            {devCaches.map((cache, i) => (
              <div key={i} className="flex items-center justify-between bg-black/30 px-3 py-2 rounded border border-gray-800/50">
                <span className="truncate pr-4 text-gray-300" title={getParentPath(cache.path)}>{getParentPath(cache.path)}</span>
                <span className="shrink-0 text-brand-accent/80 font-bold tracking-wider uppercase text-[10px]">{cache.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="bg-brand-card border border-brand-border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="text-brand-accent h-5 w-5" />
          <h3 className="font-bold text-gray-200">Common Master List</h3>
        </div>
        <p className="text-xs text-gray-400 mb-6">
          Review the packages discovered across your environments. Package names are read-only.
          You can select/edit the version, leave it blank for the latest, or add new packages manually.
        </p>
        
        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
          {masterList.map((pkg, idx) => (
            <div key={`${pkg.name}-${idx}`} className="flex items-center gap-3 bg-brand-dark/50 p-2.5 rounded border border-brand-border/50">
              <div className="w-1/3 text-sm font-mono text-gray-300 font-semibold">{pkg.name}</div>
              <div className="w-1/3 flex flex-col">
                <span className="text-[10px] text-gray-500 mb-1">Found: {pkg.versions.length ? pkg.versions.join(', ') : 'None'}</span>
                <input 
                  type="text" 
                  value={pkg.selected_version}
                  onChange={(e) => updateMasterListVersion(pkg.name, e.target.value)}
                  placeholder="Latest"
                  className="bg-brand-darkest border border-brand-border text-xs rounded px-2 py-1 text-gray-200 focus:outline-none focus:border-brand-accent transition-colors"
                />
              </div>
              <div className="flex-1 flex justify-end">
                <button 
                  onClick={() => updateMasterListVersion(pkg.name, '')}
                  className="text-[10px] text-brand-rose/80 hover:text-brand-rose uppercase tracking-wider flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" /> Remove Version
                </button>
              </div>
            </div>
          ))}
        </div>
        
        {/* Add New Package */}
        <div className="mt-6 border-t border-brand-border pt-4">
          <h4 className="text-xs font-semibold text-gray-300 mb-3">Add Custom Package</h4>
          <div className="flex gap-3">
            <input 
              type="text"
              placeholder="Package Name (e.g., django)"
              value={newPkgName}
              onChange={(e) => setNewPkgName(e.target.value)}
              className="flex-1 bg-brand-dark border border-brand-border text-xs rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-brand-accent transition-colors"
            />
            <input 
              type="text"
              placeholder="Version (optional)"
              value={newPkgVersion}
              onChange={(e) => setNewPkgVersion(e.target.value)}
              className="w-32 bg-brand-dark border border-brand-border text-xs rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-brand-accent transition-colors"
            />
            <button 
              onClick={handleAdd}
              className="bg-brand-accent hover:bg-brand-accent/90 text-white px-4 rounded-lg flex items-center justify-center transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { ShieldCheck, Plus, Trash2, Eye, EyeOff, ShieldAlert, BookOpen } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { motion } from 'framer-motion';

export default function Settings() {
  const exclusions = useAppStore((state) => state.exclusions);
  const addExclusion = useAppStore((state) => state.addExclusion);
  const removeExclusion = useAppStore((state) => state.removeExclusion);
  const developerMode = useAppStore((state) => state.developerMode);
  const setDeveloperMode = useAppStore((state) => state.setDeveloperMode);

  const [newExclusionPath, setNewExclusionPath] = useState('');
  const [showDeveloperModal, setShowDeveloperModal] = useState(false);
  const [typedConfirmation, setTypedConfirmation] = useState('');

  const handleAddExclusion = () => {
    if (!newExclusionPath) return;
    addExclusion(newExclusionPath);
    setNewExclusionPath('');
  };

  const handleToggleDeveloperMode = () => {
    if (developerMode) {
      // Direct disable
      setDeveloperMode(false);
    } else {
      // Hardened Enable flow
      setTypedConfirmation('');
      setShowDeveloperModal(true);
    }
  };

  const handleConfirmDeveloperMode = () => {
    if (typedConfirmation === 'ENABLE DEVELOPER MODE') {
      setDeveloperMode(true);
      setShowDeveloperModal(false);
      alert('Developer Mode Enabled. Destructive actions on critical system files are now accessible. Exercise caution!');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      className="flex-1 p-6 space-y-6 overflow-y-auto select-text text-sm"
    >
      <div>
        <h2 className="text-xl font-bold tracking-tight text-gray-200">Settings & Transparency Deck</h2>
        <p className="text-xs text-gray-400 mt-0.5 font-sans">Manage database filters, customize directory exclusions, and view privacy transparency disclosures.</p>
      </div>

      {/* Grid: Exclusions + Privacy Transparency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Exclusion Manager */}
        <div className="glass-card p-5 space-y-4 flex flex-col h-[400px]">
          <div className="space-y-1">
            <h3 className="font-semibold text-gray-200 text-sm">Directory Exclusion Index</h3>
            <p className="text-xs text-gray-400">Add paths to bypass during folder traversal (e.g. game drives or developer folder trees).</p>
          </div>

          <div className="flex gap-2">
            <input 
              type="text"
              value={newExclusionPath}
              onChange={(e) => setNewExclusionPath(e.target.value)}
              placeholder="e.g. C:\Projects"
              className="bg-brand-darkest border border-brand-border rounded-lg px-3 py-1.5 flex-1 focus:outline-none focus:border-brand-accent text-xs font-mono text-gray-200"
            />
            <button 
              onClick={handleAddExclusion}
              className="bg-brand-accent hover:bg-brand-accent/95 text-white py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add</span>
            </button>
          </div>

          <div className="flex-grow overflow-y-auto border border-brand-border rounded-lg p-2 space-y-1 font-mono text-xs text-gray-300">
            {exclusions.length === 0 ? (
              <span className="text-gray-500 block text-center py-10 font-sans">No custom exclusions configured.</span>
            ) : (
              exclusions.map((path, idx) => (
                <div key={idx} className="flex items-center justify-between p-1.5 hover:bg-brand-card/50 rounded transition-colors">
                  <span className="truncate flex-1 pr-2 select-text">{path}</span>
                  <button 
                    onClick={() => removeExclusion(path)}
                    className="text-gray-500 hover:text-brand-rose transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Privacy Transparency Grid */}
        <div className="glass-card p-5 space-y-4 flex flex-col h-[400px] justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-brand-green" />
              <h3 className="font-semibold text-gray-200 text-sm">Privacy & Security Transparency</h3>
            </div>
            
            <p className="text-xs text-gray-400 leading-relaxed font-sans">
              AI Smart PC Cleaner operates on a **100% offline, privacy-first, zero-telemetry** model. We strictly outline what is processed:
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div className="bg-brand-card p-2.5 rounded-lg border border-brand-border">
                <span className="text-brand-green font-semibold block mb-0.5">Natively Stored (SQLite)</span>
                <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-gray-300 mt-1">
                  <li>Custom Exclusions</li>
                  <li>Interface Preferences</li>
                  <li>Quarantine metadata keys</li>
                </ul>
              </div>
              <div className="bg-brand-card p-2.5 rounded-lg border border-brand-border">
                <span className="text-brand-rose font-semibold block mb-0.5">NEVER Stored or Logged</span>
                <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-gray-300 mt-1">
                  <li>File contents / names</li>
                  <li>Browser logins / cache DBs</li>
                  <li>Passwords / Personal paths</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-brand-darkest p-3 rounded-lg border border-brand-border flex gap-2">
            <ShieldCheck className="h-5 w-5 text-brand-green mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-gray-400 leading-relaxed">
              No cloud accounts, no sync uploads, no background services, no port-listening triggers. All temporary metadata exists only in volatile runtime RAM memory.
            </p>
          </div>
        </div>
      </div>

      {/* Developer Mode Hardening panel */}
      <div className="glass-card p-5 space-y-4 border border-brand-border">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold text-gray-200 text-sm flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-brand-amber" />
              <span>Advanced Developer Lock Override</span>
            </h3>
            <p className="text-xs text-gray-400">Unlock destructive operations on high-risk system paths (e.g. deleting `.sys` or `.dll` components).</p>
          </div>

          <button 
            onClick={handleToggleDeveloperMode}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors ${
              developerMode 
                ? 'bg-brand-rose/10 border-brand-rose text-brand-rose' 
                : 'bg-brand-card border-brand-border text-gray-400 hover:bg-brand-card/80'
            }`}
          >
            {developerMode ? 'Developer Mode Active' : 'Unlock Developer Mode'}
          </button>
        </div>
      </div>

      {/* Developer Mode Confirmation Modal */}
      {showDeveloperModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-brand-dark border border-brand-border rounded-xl p-5 space-y-4 premium-glow-subtle">
            <div className="flex items-center gap-2 text-brand-rose">
              <ShieldAlert className="h-5 w-5" />
              <span className="font-semibold text-base">Confirm Developer Mode Unlock</span>
            </div>
            
            <p className="text-xs text-gray-300 leading-relaxed">
              <strong>Warning:</strong> Exposing Developer Mode overrides Safety Middleware boundaries. Destructive file operations on critical system components (.sys, .dll) become accessible. An accidental wipe inside windows files may prevent your operating system from booting.
            </p>

            <div className="space-y-2">
              <label className="text-xs text-gray-400">
                Please type the exact phrase <code className="bg-brand-card px-1.5 py-0.5 rounded text-brand-amber font-mono">ENABLE DEVELOPER MODE</code> to authorize this action:
              </label>
              <input 
                type="text"
                value={typedConfirmation}
                onChange={(e) => setTypedConfirmation(e.target.value)}
                placeholder="Type ENABLE DEVELOPER MODE"
                className="w-full bg-brand-darkest border border-brand-border rounded-lg px-3 py-2.5 font-semibold text-center focus:outline-none focus:border-brand-accent text-gray-200 font-mono text-xs"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2 border-t border-brand-border">
              <button 
                onClick={() => setShowDeveloperModal(false)}
                className="px-4 py-2 bg-brand-card hover:bg-brand-card/80 border border-brand-border text-gray-300 rounded-lg text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmDeveloperMode}
                disabled={typedConfirmation !== 'ENABLE DEVELOPER MODE'}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  typedConfirmation === 'ENABLE DEVELOPER MODE' 
                    ? 'bg-brand-rose text-white hover:bg-brand-rose/95 cursor-pointer' 
                    : 'bg-brand-card border border-brand-border text-gray-500 cursor-not-allowed'
                }`}
              >
                Authorize Unlock
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

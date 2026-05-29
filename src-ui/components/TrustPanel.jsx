import React from 'react';
import { ShieldCheck, Info, X, Lock, Database } from 'lucide-react';
import { motion } from 'framer-motion';

export default function TrustPanel({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      className="fixed inset-y-0 right-0 w-80 bg-brand-dark border-l border-brand-border z-50 flex flex-col premium-glow-subtle select-text text-sm"
    >
      <div className="p-4 border-b border-brand-border flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-5 w-5 text-brand-accent" />
          <span>Why Was This Protected?</span>
        </div>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div className="bg-brand-card/50 rounded-lg p-3 border border-brand-border flex gap-2">
          <Info className="h-4 w-4 text-brand-accent flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-300 leading-relaxed">
            The safety middleware intercepts all filesystem operations before they are committed, protecting standard operations from accidental OS damage.
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold text-xs uppercase tracking-wider text-gray-400">Shielded system vectors</h4>
          
          <div className="space-y-3">
            <div className="flex gap-2.5">
              <div className="h-6 w-6 rounded bg-brand-amber/10 flex items-center justify-center flex-shrink-0 text-brand-amber text-xs font-semibold">C:\</div>
              <div>
                <h5 className="font-medium text-gray-200">OS Directory Roots</h5>
                <p className="text-xs text-gray-400 mt-0.5">Locations such as <code className="text-brand-amber">C:\Windows</code> and <code className="text-brand-amber">System32</code> hold system binaries. Deletions inside these are locked.</p>
              </div>
            </div>

            <div className="flex gap-2.5">
              <div className="h-6 w-6 rounded bg-brand-rose/10 flex items-center justify-center flex-shrink-0 text-brand-rose text-xs font-semibold">.sys</div>
              <div>
                <h5 className="font-medium text-gray-200">Critical File Extensions</h5>
                <p className="text-xs text-gray-400 mt-0.5">Files like <code className="text-brand-rose">.sys</code>, <code className="text-brand-rose">.dll</code>, and <code className="text-brand-rose">.efi</code> are kernel links or driver links. Removing them is restricted.</p>
              </div>
            </div>

            <div className="flex gap-2.5">
              <div className="h-6 w-6 rounded bg-brand-accent/10 flex items-center justify-center flex-shrink-0 text-brand-accent flex-shrink-0"><Database className="h-3.5 w-3.5 text-brand-accent" /></div>
              <div>
                <h5 className="font-medium text-gray-200">Active Workspaces & Dev Folders</h5>
                <p className="text-xs text-gray-400 mt-0.5">Subfolders like <code className="text-brand-accent">node_modules</code>, <code className="text-brand-accent">.git</code>, or SSH keydirs are shielded to preserve developer workspaces.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2 border-t border-brand-border pt-4">
          <h4 className="font-semibold text-xs uppercase tracking-wider text-gray-400">Offline Privacy Shield</h4>
          <div className="flex gap-2 text-xs text-gray-300">
            <Lock className="h-4 w-4 text-brand-green flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              No scanning hashes, path names, or details are stored on your local disk permanently or uploaded. Temporary scan data exists solely inside volatile, temporary runtime RAM memory.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Power, Loader2, Gauge } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export default function StartupManagerModal({ isOpen, onClose }) {
  const fetchStartupApps = useAppStore(state => state.fetchStartupApps);
  const startupApps = useAppStore(state => state.startupApps);
  const startupStatus = useAppStore(state => state.startupStatus);
  const toggleStartupApp = useAppStore(state => state.toggleStartupApp);

  useEffect(() => {
    if (isOpen) {
      fetchStartupApps();
    }
  }, [isOpen, fetchStartupApps]);

  const handleToggle = (app) => {
    toggleStartupApp(app.name, !app.enabled);
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          className="bg-brand-darkest border border-brand-border rounded-2xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] max-w-2xl w-full max-h-[80vh] flex flex-col relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b border-brand-border bg-brand-dark/50 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Gauge className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-gray-200">Startup Optimizer</h2>
                  {startupStatus === 'completed' && (
                    <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider">
                      {startupApps.length} APPS
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Manage apps that launch automatically on boot</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
            {startupStatus === 'loading' && (
              <div className="absolute inset-0 z-10 bg-brand-darkest/80 flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 text-yellow-500 animate-spin mb-4" />
                <p className="text-sm font-semibold text-gray-300 animate-pulse tracking-widest uppercase">Scanning Registry</p>
              </div>
            )}

            {startupStatus === 'completed' && startupApps.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Power className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No startup applications found.</p>
              </div>
            )}

            <div className="space-y-3">
              {startupApps.map((app, idx) => (
                <div key={idx} className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${app.enabled ? 'bg-brand-card border-brand-border' : 'bg-brand-dark/30 border-brand-border/50 opacity-70'}`}>
                  <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                    <div className={`w-2 h-2 rounded-full ${app.enabled ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-600'}`}></div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-bold truncate ${app.enabled ? 'text-gray-200' : 'text-gray-400'}`}>{app.name}</h3>
                      <p className="text-[10px] text-gray-500 font-mono truncate mt-1" title={app.command}>{app.command}</p>
                    </div>
                  </div>
                  
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => handleToggle(app)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${app.enabled ? 'bg-yellow-500' : 'bg-gray-600'}`}
                    >
                      <span className="sr-only">Toggle {app.name}</span>
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${app.enabled ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="p-4 border-t border-brand-border bg-brand-dark/50 text-center flex-shrink-0">
            <p className="text-[10px] text-gray-500 max-w-lg mx-auto leading-relaxed">
              Disabling unnecessary startup items can significantly improve your computer's boot time and free up background memory.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

import React from 'react';
import { LayoutDashboard, Trash2, Layers, Archive, Settings, ShieldAlert, Cpu, AlertTriangle, Loader2 } from 'lucide-react';
import { useAppStore } from './store/useAppStore';
import Dashboard from './views/Dashboard';
import Cleaner from './views/Cleaner';
import DuplicateFinder from './views/DuplicateFinder';
import QuarantineView from './views/QuarantineView';
import SettingsView from './views/Settings';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const activePanel = useAppStore((state) => state.activePanel);
  const setActivePanel = useAppStore((state) => state.setActivePanel);
  const developerMode = useAppStore((state) => state.developerMode);
  const serviceWarning = useAppStore((state) => state.serviceWarning);
  const serviceError = useAppStore((state) => state.serviceError);
  const isSystemLoading = useAppStore((state) => state.isSystemLoading);
  const loadingSteps = useAppStore((state) => state.loadingSteps);

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'cleaner', name: 'Interactive Cleaner', icon: Trash2 },
    { id: 'duplicates', name: 'Duplicate Finder', icon: Layers },
    { id: 'quarantine', name: 'Quarantine Board', icon: Archive },
    { id: 'settings', name: 'Settings & Privacy', icon: Settings },
  ];

  return (
    <AnimatePresence mode="wait">
      {isSystemLoading ? (
        <motion.div
          key="loader-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          className="h-screen w-screen bg-brand-darkest flex flex-col items-center justify-center relative overflow-hidden font-sans text-gray-100"
        >
          {/* Subtle glowing radial background */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(42,123,239,0.08)_0%,transparent_70%)] pointer-events-none" />
          
          <div className="w-full max-w-md p-8 glass-card border border-brand-border/40 premium-glow-subtle flex flex-col items-center relative z-10 space-y-6">
            {/* Spinning Brand Icon Logo */}
            <div className="relative h-16 w-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-2xl border-2 border-brand-accent/20 animate-pulse" />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
                className="absolute inset-0 rounded-2xl border-2 border-t-brand-accent border-r-transparent border-b-transparent border-l-transparent"
              />
              <Cpu className="h-8 w-8 text-brand-accent animate-pulse" />
            </div>

            {/* Title */}
            <div className="text-center">
              <h2 className="text-xl font-bold tracking-tight text-gray-200">SafeSweep Security</h2>
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mt-1">Initializing Secure PC Middleware</p>
            </div>

            {/* Real-time Checklist Logs */}
            <div className="w-full space-y-3.5 bg-brand-dark/40 border border-brand-border/30 rounded-xl p-4 font-mono text-[11px] leading-relaxed">
              {loadingSteps.map((step) => {
                const isCompleted = step.status === 'completed';
                const isActive = step.status === 'active';
                
                return (
                  <div key={step.id} className="flex items-center gap-3 transition-all duration-300">
                    {/* Status Icons */}
                    {isCompleted ? (
                      <div className="h-4.5 w-4.5 rounded-full bg-brand-green/10 border border-brand-green/30 flex items-center justify-center flex-shrink-0">
                        <svg className="h-2.5 w-2.5 text-brand-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : isActive ? (
                      <Loader2 className="h-4 w-4 text-brand-accent animate-spin flex-shrink-0" />
                    ) : (
                      <div className="h-4.5 w-4.5 rounded-full border border-gray-700/60 bg-transparent flex-shrink-0" />
                    )}

                    {/* Step Label */}
                    <span className={`transition-colors duration-300 ${
                      isCompleted ? 'text-gray-300 font-semibold' :
                      isActive ? 'text-brand-accent font-semibold animate-pulse' : 'text-gray-600'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
            
            {/* Minimal footer */}
            <span className="text-[9px] font-mono text-gray-600 uppercase tracking-widest">
              v1.0.0 (Hardened Runtime Mode)
            </span>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="app-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="flex h-screen w-screen bg-brand-darkest text-gray-100 overflow-hidden font-sans"
        >
          {/* Sidebar Navigation */}
          <div className="w-64 bg-brand-dark border-r border-brand-border flex flex-col justify-between flex-shrink-0">
            
            {/* Sidebar Header */}
            <div className="p-4 border-b border-brand-border space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-brand-accent flex items-center justify-center premium-glow-subtle flex-shrink-0">
                  <Cpu className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-sm tracking-tight text-gray-100">SafeSweep</h1>
                  <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">Production Utility</span>
                </div>
              </div>
            </div>

            {/* Sidebar Menu Items */}
            <div className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activePanel === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActivePanel(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                      isActive
                        ? 'bg-brand-accent/10 text-brand-accent border border-brand-accent/25'
                        : 'text-gray-400 hover:bg-brand-card hover:text-white border border-transparent'
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Sidebar Footer */}
            <div className="p-4 border-t border-brand-border space-y-2">
              {developerMode && (
                <div className="bg-brand-rose/10 border border-brand-rose/25 text-brand-rose rounded-lg px-3 py-2 flex items-center gap-2 text-[10px] font-semibold tracking-wide uppercase">
                  <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                  <span>Dev Override active</span>
                </div>
              )}
              <div className="text-[9px] text-gray-500 font-mono text-center">
                v1.0.0 (Windows Offline API)
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            
            {/* Watchdog Warnings */}
            <AnimatePresence>
              {serviceWarning && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-brand-amber text-brand-darkest font-semibold px-4 py-2 text-center text-xs flex items-center justify-center gap-2 z-50 select-text"
                >
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>{serviceWarning}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Fatal Watchdog Crash Lock */}
            {serviceError ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-text bg-brand-darkest">
                <div className="h-16 w-16 rounded-full bg-brand-rose/10 flex items-center justify-center mb-4 border border-brand-rose/20">
                  <ShieldAlert className="h-8 w-8 text-brand-rose" />
                </div>
                <h2 className="text-xl font-bold text-gray-200">Local System Service Error</h2>
                <p className="text-xs text-gray-400 max-w-sm mt-2 leading-relaxed">
                  {serviceError}
                </p>
                <button 
                  onClick={() => window.location.reload()}
                  className="mt-6 bg-brand-card hover:bg-brand-card/80 border border-brand-border text-gray-300 py-2 px-5 rounded-lg text-xs font-semibold transition-colors"
                >
                  Reload Application
                </button>
              </div>
            ) : (
              /* Render Active Panel views */
              <AnimatePresence mode="wait">
                {activePanel === 'dashboard' && <Dashboard />}
                {activePanel === 'cleaner' && <Cleaner />}
                {activePanel === 'duplicates' && <DuplicateFinder />}
                {activePanel === 'quarantine' && <QuarantineView />}
                {activePanel === 'settings' && <SettingsView />}
              </AnimatePresence>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

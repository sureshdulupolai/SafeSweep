import React from 'react';
import { LayoutDashboard, Trash2, Layers, Archive, Settings, ShieldAlert, Cpu, AlertTriangle } from 'lucide-react';
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

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'cleaner', name: 'Interactive Cleaner', icon: Trash2 },
    { id: 'duplicates', name: 'Duplicate Finder', icon: Layers },
    { id: 'quarantine', name: 'Quarantine Board', icon: Archive },
    { id: 'settings', name: 'Settings & Privacy', icon: Settings },
  ];

  return (
    <div className="flex h-screen w-screen bg-brand-darkest text-gray-100 overflow-hidden font-sans">
      
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
    </div>
  );
}

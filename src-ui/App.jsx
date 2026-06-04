import React from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ShieldAlert, Cpu, AlertTriangle, Loader2 } from 'lucide-react';
import { useAppStore } from './store/useAppStore';
import Dashboard from './views/Dashboard';
import Cleaner from './views/Cleaner';
import DevCleaner from './views/dev-cleaner/DevCleaner';
import SettingsView from './views/Settings';
import Sidebar from './components/Sidebar';
import ErrorBoundary from './components/ErrorBoundary';
import { motion, AnimatePresence } from 'framer-motion';
const isElectron = navigator.userAgent.toLowerCase().includes('electron');
const Router = isElectron ? HashRouter : BrowserRouter;

function AppLayout() {
  const serviceWarning = useAppStore((state) => state.serviceWarning);
  const serviceError = useAppStore((state) => state.serviceError);

  return (
    <div className="flex h-screen w-screen bg-brand-darkest text-gray-100 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar />

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
          /* Render Active Panel views with secure error boundaries */
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const isSystemLoading = useAppStore((state) => state.isSystemLoading);
  const loadingSteps = useAppStore((state) => state.loadingSteps);

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
        <Router>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="cleaner" element={<Cleaner />} />
              <Route path="dev-cleaner" element={<DevCleaner />} />
              <Route path="settings" element={<SettingsView />} />
            </Route>
          </Routes>
        </Router>
      )}
    </AnimatePresence>
  );
}

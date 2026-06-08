import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Cpu, MemoryStick, Rocket, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export default function GameBoosterModal({ isOpen, onClose }) {
  const boostSystem = useAppStore(state => state.boostSystem);
  const boostStatus = useAppStore(state => state.boostStatus);
  const boostResults = useAppStore(state => state.boostResults);

  const [localStatus, setLocalStatus] = useState('idle'); // idle, boosting, completed

  useEffect(() => {
    if (isOpen) {
      setLocalStatus('idle');
      useAppStore.setState({ boostStatus: 'idle', boostResults: null });
    }
  }, [isOpen]);

  useEffect(() => {
    if (boostStatus === 'boosting') {
      setLocalStatus('boosting');
    } else if (boostStatus === 'completed') {
      // Add a slight delay for the animation to look cooler
      const timer = setTimeout(() => {
        setLocalStatus('completed');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [boostStatus]);

  const handleBoost = () => {
    boostSystem();
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 MB';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-brand-darkest border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_-12px_rgba(6,182,212,0.3)] max-w-lg w-full overflow-hidden relative"
        >
          {/* Header */}
          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-8 text-center relative overflow-hidden min-h-[400px] flex flex-col justify-center">
            
            {localStatus === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex flex-col items-center z-10"
              >
                <div className="w-24 h-24 rounded-full bg-cyan-500/10 flex items-center justify-center border border-cyan-500/30 mb-6 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
                  <Rocket className="h-10 w-10 text-cyan-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2 tracking-wide uppercase">Game Booster</h2>
                <p className="text-sm text-gray-400 mb-8 max-w-xs mx-auto">
                  Maximize FPS and reduce latency by suspending telemetry services and flushing RAM standby lists.
                </p>
                <button
                  onClick={handleBoost}
                  className="group relative px-8 py-4 bg-cyan-500 text-brand-darkest font-black uppercase tracking-widest text-lg rounded-xl overflow-hidden shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_40px_rgba(6,182,212,0.6)] transition-all hover:scale-105"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <Zap className="h-5 w-5" fill="currentColor" />
                    Boost Now
                  </span>
                  <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
                </button>
              </motion.div>
            )}

            {localStatus === 'boosting' && (
              <motion.div
                key="boosting"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.2 }}
                className="flex flex-col items-center z-10"
              >
                <div className="relative w-32 h-32 mb-8">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                    className="absolute inset-0 rounded-full border-t-4 border-l-4 border-cyan-400 opacity-80 shadow-[0_0_20px_rgba(6,182,212,0.5)]"
                  />
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="absolute inset-2 rounded-full border-b-4 border-r-4 border-purple-500 opacity-60"
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-cyan-300 font-black animate-pulse text-xl">
                    <Zap className="h-12 w-12 text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]" fill="currentColor" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-white mb-2 animate-pulse tracking-widest uppercase text-cyan-300">Unleashing Maximum Performance</h2>
                <p className="text-xs text-gray-400 font-mono">Flushing Memory & Suspending Background Apps...</p>
              </motion.div>
            )}

            {localStatus === 'completed' && boostResults && (
              <motion.div
                key="completed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center z-10 w-full"
              >
                <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/30 mb-4 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                  <CheckCircle2 className="h-10 w-10 text-green-400" />
                </div>
                <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-green-400 mb-1 uppercase tracking-wider">
                  System Boosted!
                </h2>
                <p className="text-sm text-gray-400 mb-6">Maximum resources allocated to foreground apps.</p>

                <div className="grid grid-cols-3 gap-3 w-full mb-6">
                  <div className="bg-brand-dark/50 border border-cyan-500/20 rounded-xl p-3 flex flex-col items-center">
                    <Cpu className="h-5 w-5 text-purple-400 mb-2" />
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Services Stopped</span>
                    <span className="text-lg font-mono font-bold text-white">{boostResults.services_stopped}</span>
                  </div>
                  <div className="bg-brand-dark/50 border border-cyan-500/20 rounded-xl p-3 flex flex-col items-center">
                    <MemoryStick className="h-5 w-5 text-cyan-400 mb-2" />
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">RAM Freed</span>
                    <span className="text-lg font-mono font-bold text-white">{formatBytes(boostResults.ram_freed_bytes)}</span>
                  </div>
                  <div className="bg-brand-dark/50 border border-green-500/20 rounded-xl p-3 flex flex-col items-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-green-500/5 animate-pulse"></div>
                    <Zap className="h-5 w-5 text-green-400 mb-2 relative z-10" fill="currentColor" />
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1 relative z-10">Est. FPS Boost</span>
                    <span className="text-lg font-black text-green-400 relative z-10">+{boostResults.estimated_fps_boost}%</span>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="px-8 py-2.5 bg-brand-dark border border-cyan-500/30 text-white text-sm font-bold uppercase tracking-widest rounded-lg hover:bg-cyan-500/10 transition-colors"
                >
                  Return to Dashboard
                </button>
              </motion.div>
            )}

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

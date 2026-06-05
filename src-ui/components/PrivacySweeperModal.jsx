import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldAlert, CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export default function PrivacySweeperModal({ isOpen, onClose }) {
  const privacySweep = useAppStore(state => state.privacySweep);
  const sweepStatus = useAppStore(state => state.privacySweepStatus);
  const sweepResults = useAppStore(state => state.privacySweepResults);

  const [localStatus, setLocalStatus] = useState('idle');

  useEffect(() => {
    if (isOpen) {
      setLocalStatus('idle');
      useAppStore.setState({ privacySweepStatus: 'idle', privacySweepResults: null });
    }
  }, [isOpen]);

  useEffect(() => {
    if (sweepStatus === 'sweeping') {
      setLocalStatus('sweeping');
    } else if (sweepStatus === 'completed') {
      const timer = setTimeout(() => {
        setLocalStatus('completed');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [sweepStatus]);

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
          className="bg-brand-darkest border border-brand-green/30 rounded-2xl shadow-[0_0_50px_-12px_rgba(34,197,94,0.3)] max-w-md w-full overflow-hidden relative"
        >
          {/* Header */}
          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={onClose}
              disabled={localStatus === 'sweeping'}
              className="p-2 text-gray-500 hover:text-white transition-colors disabled:opacity-0"
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
                <div className="w-24 h-24 rounded-full bg-brand-green/10 flex items-center justify-center border border-brand-green/30 mb-6 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
                  <ShieldAlert className="h-10 w-10 text-brand-green" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2 tracking-wide uppercase">Privacy Sweeper</h2>
                <p className="text-sm text-gray-400 mb-8 max-w-xs mx-auto">
                  Instantly wipe your Clipboard, Recent Documents list, Run dialog history, and flush DNS cache to protect your privacy.
                </p>
                <button
                  onClick={() => privacySweep()}
                  className="group relative px-8 py-4 bg-brand-green text-brand-darkest font-black uppercase tracking-widest text-lg rounded-xl overflow-hidden shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:shadow-[0_0_40px_rgba(34,197,94,0.6)] transition-all hover:scale-105 flex items-center gap-2"
                >
                  <ShieldCheck className="h-5 w-5" />
                  Sweep Traces
                  <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
                </button>
              </motion.div>
            )}

            {localStatus === 'sweeping' && (
              <motion.div
                key="sweeping"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.2 }}
                className="flex flex-col items-center z-10"
              >
                <div className="relative w-32 h-32 mb-8">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="absolute inset-0 rounded-full border-t-4 border-l-4 border-brand-green opacity-80 shadow-[0_0_20px_rgba(34,197,94,0.5)]"
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-green-300 font-black animate-pulse text-xl">
                    <ShieldCheck className="h-12 w-12 text-brand-green drop-shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-white mb-2 animate-pulse tracking-widest uppercase text-brand-green">Scrubbing Data</h2>
                <p className="text-xs text-gray-400 font-mono">Wiping clipboard and recent history...</p>
              </motion.div>
            )}

            {localStatus === 'completed' && sweepResults && (
              <motion.div
                key="completed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center z-10 w-full"
              >
                <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/30 mb-4 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                  <CheckCircle2 className="h-10 w-10 text-green-400" />
                </div>
                <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-300 to-green-500 mb-1 uppercase tracking-wider">
                  Traces Wiped!
                </h2>
                <p className="text-sm text-gray-400 mb-6">Your activity history has been successfully sanitized.</p>

                <div className="bg-brand-dark/50 border border-green-500/20 rounded-xl p-4 w-full mb-6">
                  <span className="text-xs text-gray-500 uppercase tracking-wider font-bold block mb-2">Traces Cleaned</span>
                  <span className="text-3xl font-mono font-bold text-white block">{sweepResults.traces_cleaned}</span>
                </div>

                <button
                  onClick={onClose}
                  className="px-8 py-2.5 bg-brand-dark border border-green-500/30 text-white text-sm font-bold uppercase tracking-widest rounded-lg hover:bg-green-500/10 transition-colors"
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

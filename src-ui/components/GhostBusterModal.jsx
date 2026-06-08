import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, X, BatteryCharging, Skull } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

const GhostBusterModal = () => {
  const ghostsKilled = useAppStore(state => state.ghostsKilled);
  const setGhostsKilled = useAppStore(state => state.setGhostsKilled);

  return (
    <AnimatePresence>
      {ghostsKilled > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: -20, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-md relative overflow-hidden rounded-2xl glass-card border border-brand-accent/30 premium-glow-accent shadow-2xl"
          >
            {/* Background animated gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/20 to-transparent opacity-50" />
            
            {/* Close Button */}
            <button
              onClick={() => setGhostsKilled(0)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-black/40 border border-white/5 text-gray-400 hover:text-white transition-all z-10 group"
            >
              <X className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>

            <div className="p-8 relative z-10 flex flex-col items-center text-center">
              
              {/* Animated Icon Container */}
              <div className="relative mb-6">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 bg-brand-accent/20 rounded-full blur-xl"
                />
                <div className="h-20 w-20 rounded-full bg-brand-dark border-2 border-brand-accent/50 flex items-center justify-center relative shadow-[0_0_30px_rgba(42,123,239,0.3)]">
                  <ShieldAlert className="w-10 h-10 text-brand-accent drop-shadow-[0_0_10px_rgba(42,123,239,0.8)]" />
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: -5, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="absolute -bottom-2 -right-2 bg-brand-dark border border-gray-700 rounded-full p-1.5"
                  >
                    <Skull className="w-4 h-4 text-red-400" />
                  </motion.div>
                </div>
              </div>

              {/* Text Content */}
              <h2 className="text-2xl font-bold text-gray-100 mb-2 tracking-tight">
                Ghost & Threat Buster 👻🛡️
              </h2>
              
              <div className="bg-brand-dark/50 border border-gray-700/50 rounded-xl p-4 mb-6 w-full text-left flex gap-4 items-center">
                <BatteryCharging className="w-8 h-8 text-brand-green flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-300 font-medium">
                    Terminated <span className="text-brand-accent font-bold text-base px-1">{ghostsKilled}</span> background process(es).
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Old orphaned instances of SafeSweep, unused bloatware, and potential malware threats secretly running in the background have been cleared.
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => setGhostsKilled(0)}
                className="w-full py-3.5 px-4 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-xl font-semibold shadow-lg shadow-brand-accent/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                Continue to SafeSweep
              </button>
              
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GhostBusterModal;

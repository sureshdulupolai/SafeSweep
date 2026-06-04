import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, CheckCircle2, Trash2, X } from 'lucide-react';

export default function SuccessCard({ 
  isOpen, 
  onClose, 
  title = "Operation Successful", 
  subtitle = "Items Permanently Eradicated", 
  logTitle = "Destruction Log",
  logDescription = "The following items have been cryptographically unlinked from the filesystem and permanently destroyed.",
  itemsLabel = "Items Deleted",
  freedBytes = 0,
  freedLabel = "Storage Freed",
  deletedList = []
}) {

  const formatBytes = (bytes) => {
    if (bytes === 0) return { value: '0', unit: 'B' };
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return {
      value: parseFloat((bytes / Math.pow(k, i)).toFixed(1)),
      unit: sizes[i]
    };
  };

  const freedFormatted = formatBytes(freedBytes);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-brand-dark border border-brand-green/30 rounded-2xl shadow-[0_0_40px_rgba(34,197,94,0.1)] max-w-xl w-full flex flex-col overflow-hidden premium-glow-subtle"
        >
          {/* Header */}
          <div className="bg-brand-green/10 border-b border-brand-green/20 p-5 flex items-center justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-green/10 rounded-full blur-3xl" />
            
            <div className="flex items-center gap-4 relative z-10">
              <div className="bg-brand-green/20 p-2.5 rounded-full shadow-inner border border-brand-green/30">
                <CheckCircle2 className="h-7 w-7 text-brand-green" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-100 tracking-tight">{title}</h3>
                <p className="text-xs text-brand-green/80 mt-0.5 font-medium flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {deletedList.length} {subtitle}
                </p>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white bg-black/20 hover:bg-black/40 p-1.5 rounded-lg transition-all relative z-10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Metrics Summary Row */}
          <div className="bg-brand-darkest/80 border-b border-brand-border p-5 grid grid-cols-3 gap-4">
             <div className="flex flex-col items-center justify-center p-3 bg-brand-card/40 rounded-xl border border-brand-border/50 shadow-inner">
                <span className="text-2xl font-black text-white">{deletedList.length}</span>
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mt-1">{itemsLabel}</span>
             </div>
             <div className="flex flex-col items-center justify-center p-3 bg-brand-card/40 rounded-xl border border-brand-border/50 shadow-inner">
                <span className="text-2xl font-black text-brand-green flex items-center gap-1">
                  100<span className="text-sm">%</span>
                </span>
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mt-1">Success Rate</span>
             </div>
             <div className="flex flex-col items-center justify-center p-3 bg-brand-card/40 rounded-xl border border-brand-border/50 shadow-inner">
                <span className="text-2xl font-black text-brand-accent flex items-center gap-1">
                  {freedFormatted.value}<span className="text-sm">{freedFormatted.unit}</span>
                </span>
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mt-1">{freedLabel}</span>
             </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 bg-brand-darkest relative">
            <div className="mb-4">
               <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-1">{logTitle}</h4>
               <p className="text-[11px] text-gray-500">{logDescription}</p>
            </div>

            <div className="border border-brand-border rounded-xl overflow-hidden bg-brand-card/30 shadow-inner">
              <div className="max-h-[40vh] overflow-y-auto p-2 space-y-1">
                {deletedList.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-500">
                    No items were deleted.
                  </div>
                ) : (
                  deletedList.map((path, idx) => (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(idx * 0.02, 0.5) }}
                      key={idx} 
                      className="flex items-start gap-3 p-2 hover:bg-brand-card/60 rounded-lg transition-colors border border-transparent hover:border-brand-border/40"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 overflow-hidden">
                        <span className="text-xs text-gray-400 font-mono truncate block" title={path}>{path}</span>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-brand-card border-t border-brand-border p-4 flex justify-end">
             <button
               onClick={onClose}
               className="px-6 py-2.5 rounded-xl text-xs font-bold text-brand-darkest bg-brand-green hover:bg-green-400 transition-colors shadow-lg shadow-brand-green/20"
             >
               Acknowledge & Close
             </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

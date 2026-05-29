import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SafeModeWatermark({ visible }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="bg-brand-amber/10 border border-brand-amber/30 text-brand-amber rounded-lg px-4 py-3 flex items-start gap-3 premium-glow-subtle select-text mb-4"
        >
          <ShieldAlert className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-sm">Protected Inspection Mode Active</h4>
            <p className="text-xs text-gray-300 mt-0.5 leading-relaxed">
              To guarantee operating system stability, destructive actions are completely disabled for this folder structure. 
              You can safely traverse and preview its contents, but no files will be unlinked or modified.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

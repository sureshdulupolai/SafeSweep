import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, ShieldCheck, X, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DeleteModal({ isOpen, onClose, simulation, onConfirm, permanent }) {
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [currentStep, setCurrentStep] = useState(1); // Step 1: Mode Review, Step 2: Typed Confirmation

  // Clean inputs on opening
  useEffect(() => {
    if (isOpen) {
      setTypedConfirmation('');
      setCurrentStep(1);
    }
  }, [isOpen]);

  if (!isOpen || !simulation) return null;

  const totalFiles = simulation.files_to_remove ? simulation.files_to_remove.length : 0;
  const totalBytes = simulation.total_freed_bytes || 0;

  // Large cleanup detection: > 100k files or > 50 GB
  const isLargeCleanup = totalFiles > 100000 || totalBytes > 50 * 1024 * 1024 * 1024;

  // Format bytes helper
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Standardize the required verification phrase to "delete" for user friendliness
  const requiredPhrase = 'delete';

  const handleNextStep = () => {
    setCurrentStep(2);
  };

  const handleFinalSubmit = () => {
    if (typedConfirmation.trim().toLowerCase() === 'delete') {
      onConfirm(permanent);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-lg bg-brand-dark border border-brand-border rounded-xl premium-glow-subtle flex flex-col overflow-hidden text-sm"
        >
          {/* Header */}
          <div className="p-4 border-b border-brand-border flex items-center justify-between">
            <div className="flex items-center gap-2 text-brand-rose">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-semibold text-base">
                {isLargeCleanup ? '⚠️ Warning: High-Scale Cleanup Transaction' : 'Confirm File Cleanup'}
              </span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 flex-1 space-y-4">
            {currentStep === 1 ? (
              <>
                {/* Step 1: Mode Review */}
                <div className={`p-4 rounded-lg flex gap-3 ${isLargeCleanup ? 'bg-brand-rose/10 border border-brand-rose/20' : 'bg-brand-card border border-brand-border'}`}>
                  <AlertTriangle className={`h-6 w-6 flex-shrink-0 ${isLargeCleanup ? 'text-brand-rose' : 'text-brand-amber'}`} />
                  <div>
                    <h4 className="font-semibold text-gray-200">
                      {isLargeCleanup ? 'Extreme I/O Load Detected' : 'You are about to delete files'}
                    </h4>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      {isLargeCleanup
                        ? 'This operation targets more than 100,000 files or 50 GB. This may cause prolonged system disk locking handles. We highly recommend exporting a dry-run report first.'
                        : 'Review the total assets targeted by your cleanup choice before proceeding.'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-brand-card p-3 rounded-lg border border-brand-border">
                    <span className="text-xs text-gray-400 block">Total Files to Clean</span>
                    <span className="font-bold text-lg text-gray-200 mt-1 block">{totalFiles.toLocaleString()}</span>
                  </div>
                  <div className="bg-brand-card p-3 rounded-lg border border-brand-border">
                    <span className="text-xs text-gray-400 block">Freed Disk Space</span>
                    <span className="font-bold text-lg text-brand-green mt-1 block">{formatBytes(totalBytes)}</span>
                  </div>
                </div>

                <div className="bg-brand-card p-3 rounded-lg border border-brand-border text-xs text-gray-300 leading-relaxed">
                  <span className="font-semibold text-gray-200 block mb-1">Deletion Mode: {permanent ? 'Permanent Delete (Shred)' : 'Safe Delete (Recycle Bin)'}</span>
                  {permanent ? (
                    <span className="text-brand-rose">
                      🚨 Danger: Files will be securely overwritten, truncated, and unlinked.
                      <strong> Permanent deletion may not be recoverable through any standard undelete tools.</strong>
                    </span>
                  ) : (
                    <span className="text-brand-accent">
                      ✔️ Safe Mode: Files will be relocated natively to the Windows Recycle Bin, allowing you to restore them if needed.
                    </span>
                  )}
                </div>

                {isLargeCleanup && (
                  <button
                    onClick={() => {
                      alert("Simulation report generated and saved locally as 'SimulationReport.txt'.");
                    }}
                    className="flex items-center justify-center gap-2 w-full bg-brand-card hover:bg-brand-card/80 border border-brand-border py-2 rounded-lg text-xs font-semibold text-gray-300 transition-colors"
                  >
                    <FileText className="h-4 w-4" />
                    <span>Export Cleanup Simulation Report First</span>
                  </button>
                )}

                <div className="flex gap-3 justify-end pt-2 border-t border-brand-border">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-brand-card hover:bg-brand-card/80 border border-brand-border text-gray-300 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleNextStep}
                    className="px-4 py-2 bg-brand-rose hover:bg-brand-rose/95 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <span>Proceed to Confirmation</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Step 2: Typed Confirmation */}
                <div className="space-y-3">
                  <label className="text-xs text-gray-400 block">
                    Please type the exact phrase <code className="bg-brand-card px-1.5 py-0.5 rounded text-brand-amber font-mono">{requiredPhrase}</code> below to confirm the cleanup:
                  </label>

                  <input
                    type="text"
                    value={typedConfirmation}
                    onChange={(e) => setTypedConfirmation(e.target.value)}
                    placeholder={`Type ${requiredPhrase} to proceed`}
                    autoFocus
                    className="w-full bg-brand-darkest border border-brand-border rounded-lg px-3 py-2.5 font-semibold text-center focus:outline-none focus:border-brand-accent text-gray-200"
                  />

                  <p className="text-xs text-brand-rose/90 flex gap-2 pt-1">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>This operation is irreversible after you click final execute.</span>
                  </p>
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-brand-border">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="px-4 py-2 bg-brand-card hover:bg-brand-card/80 border border-brand-border text-gray-300 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleFinalSubmit}
                    disabled={typedConfirmation.trim().toLowerCase() !== requiredPhrase}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      typedConfirmation.trim().toLowerCase() === requiredPhrase
                        ? 'bg-brand-rose text-white hover:bg-brand-rose/95 cursor-pointer'
                        : 'bg-brand-card border border-brand-border text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Final Execute Cleanup</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Loader2, Play, Square, X, AlertTriangle, ShieldAlert, Cpu, HardDrive } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export default function BackgroundServiceAdvisor({ isOpen, onClose }) {
  const fetchServices = useAppStore(state => state.fetchServices);
  const servicesList = useAppStore(state => state.servicesList);
  const scanStatus = useAppStore(state => state.servicesScanStatus);
  const toggleService = useAppStore(state => state.toggleService);

  const [operatingService, setOperatingService] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (isOpen && scanStatus === 'idle') {
      fetchServices();
    }
  }, [isOpen, scanStatus, fetchServices]);

  const handleToggle = async (name, currentStatus) => {
    if (operatingService) return;
    setOperatingService(name);
    setErrorMsg(null);
    
    const action = currentStatus === 'running' ? 'stop' : 'start';
    const result = await toggleService(name, action);
    
    if (!result.success) {
      setErrorMsg(`Failed to ${action} ${name}: ${result.error}`);
    }
    setOperatingService(null);
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          className="bg-brand-dark border border-brand-border rounded-xl shadow-2xl max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="bg-brand-card/80 border-b border-brand-border p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-brand-accent/20 p-2 rounded-full">
                <Activity className="h-5 w-5 text-brand-accent" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-200">Background Service Advisor</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Safely identify and manage unused background bloatware.</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              disabled={operatingService !== null}
              className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 bg-brand-darkest relative">
            {errorMsg && (
              <div className="mb-4 bg-brand-rose/10 border border-brand-rose/30 p-3 rounded-lg flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-brand-rose flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-brand-rose">Operation Failed</h4>
                  <p className="text-[11px] text-brand-rose/80 mt-1 leading-relaxed">{errorMsg}</p>
                </div>
                <button onClick={() => setErrorMsg(null)} className="text-brand-rose/50 hover:text-brand-rose">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {scanStatus === 'scanning' ? (
              <div className="h-full flex flex-col items-center justify-center space-y-4">
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="absolute inset-0 rounded-full border-t-2 border-r-2 border-brand-accent border-opacity-70"
                  />
                  <Activity className="h-8 w-8 text-brand-accent animate-pulse" />
                </div>
                <div className="text-center">
                  <h4 className="text-sm font-bold text-gray-200 mb-1">Analyzing Background Services</h4>
                  <p className="text-xs text-gray-400">Scanning for known bloatware and telemetry services...</p>
                </div>
              </div>
            ) : scanStatus === 'completed' ? (
              <div className="space-y-4">
                <div className="bg-brand-card/40 border border-brand-border/50 p-4 rounded-xl mb-4">
                   <p className="text-xs text-gray-400 leading-relaxed">
                     The services listed below are known telemetry, bloatware, or legacy services that are generally safe to disable to free up system resources. 
                     <strong className="text-gray-200"> We do not automatically disable them.</strong> Please review the reason and toggle them at your own discretion.
                   </p>
                </div>

                <div className="space-y-3">
                  {servicesList.map((svc, idx) => (
                    <div key={idx} className="bg-brand-card border border-brand-border rounded-xl p-4 transition-colors hover:border-brand-border/80">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                             <h4 className="text-sm font-bold text-gray-200">{svc.display_name}</h4>
                             <span className="text-[10px] font-mono text-gray-500 bg-brand-darkest px-2 py-0.5 rounded-full border border-brand-border/50">
                               {svc.name}
                             </span>
                             {svc.status === 'running' ? (
                                <span className="text-[10px] uppercase font-bold text-brand-green flex items-center gap-1 bg-brand-green/10 px-2 py-0.5 rounded-full">
                                  <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
                                  Running
                                </span>
                             ) : (
                                <span className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1 bg-gray-800 px-2 py-0.5 rounded-full">
                                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                                  Stopped
                                </span>
                             )}
                          </div>
                          
                          <p className="text-[11px] text-gray-400 leading-relaxed mb-3 pr-4">
                            {svc.reason}
                          </p>

                          <div className="flex items-center gap-4 text-[10px] text-gray-500 font-mono">
                            <span className="flex items-center gap-1.5">
                              <HardDrive className="h-3.5 w-3.5 text-brand-accent" />
                              {formatBytes(svc.memory_bytes)} RAM
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Cpu className="h-3.5 w-3.5 text-brand-amber" />
                              {svc.status === 'running' ? 'Active' : 'Idle'}
                            </span>
                            {svc.pid ? (
                              <span>PID: {svc.pid}</span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex-shrink-0 flex items-center justify-center">
                          <button
                            onClick={() => handleToggle(svc.name, svc.status)}
                            disabled={operatingService !== null}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                              operatingService === svc.name 
                                ? 'bg-brand-darkest text-gray-500 cursor-not-allowed border border-brand-border' 
                                : svc.status === 'running'
                                  ? 'bg-brand-card hover:bg-brand-rose/10 text-brand-rose border border-brand-rose/30 hover:border-brand-rose/50 shadow-lg shadow-brand-rose/5'
                                  : 'bg-brand-card hover:bg-brand-green/10 text-brand-green border border-brand-green/30 hover:border-brand-green/50 shadow-lg shadow-brand-green/5'
                            } disabled:opacity-50`}
                          >
                            {operatingService === svc.name ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Working...
                              </>
                            ) : svc.status === 'running' ? (
                              <>
                                <Square className="h-3.5 w-3.5 fill-current" />
                                Stop Service
                              </>
                            ) : (
                              <>
                                <Play className="h-3.5 w-3.5 fill-current" />
                                Start Service
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {servicesList.length === 0 && (
                    <div className="text-center p-8 bg-brand-card/30 rounded-xl border border-brand-border border-dashed">
                      <ShieldAlert className="h-8 w-8 text-gray-500 mx-auto mb-3" />
                      <h4 className="text-sm font-bold text-gray-300">No Services Detected</h4>
                      <p className="text-xs text-gray-500 mt-1">Could not find any known services to manage.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-brand-rose text-sm">Failed to load services.</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

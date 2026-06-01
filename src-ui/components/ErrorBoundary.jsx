import React from 'react';
import { ShieldAlert, RotateCcw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("SafeSweep UI Render Catch:", error, errorInfo);
  }

  handleReload = () => {
    // Force clear caches and reload page to recover
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-text bg-brand-darkest h-full w-full">
          <div className="h-16 w-16 rounded-full bg-brand-rose/10 flex items-center justify-center mb-4 border border-brand-rose/20 animate-pulse">
            <ShieldAlert className="h-8 w-8 text-brand-rose" />
          </div>
          <h2 className="text-base font-bold text-gray-200">Panel Render Failure</h2>
          <p className="text-xs text-gray-400 max-w-sm mt-2 leading-relaxed font-sans">
            The active panel failed to render. This typically happens if the browser's local asset cache is cleared while a development session is active.
          </p>
          <div className="mt-4 p-3 bg-brand-card/40 border border-brand-border/60 rounded-lg text-left max-w-md w-full">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">Diagnostic Details</span>
            <code className="text-[10px] font-mono text-brand-rose block mt-1 break-all bg-brand-darkest/60 p-2 rounded border border-brand-border/30">
              {this.state.error?.message || "ChunkLoadError: ERR_CACHE_READ_FAILURE"}
            </code>
          </div>
          <button 
            onClick={this.handleReload}
            className="mt-6 bg-brand-accent hover:bg-brand-accent/90 text-white py-2 px-5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-lg"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reload & Recover System</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { useAppStore } from './store/useAppStore';

function Root() {
  const initBridge = useAppStore((state) => state.initBridge);
  const fetchExclusions = useAppStore((state) => state.fetchExclusions);
  const fetchQuarantine = useAppStore((state) => state.fetchQuarantine);

  useEffect(() => {
    // Initialise the IPC bridge listeners to receive sidecar responses
    initBridge();
    
    // Fetch initial database datasets
    setTimeout(() => {
      fetchExclusions();
      fetchQuarantine();
    }, 1500);
  }, [initBridge, fetchExclusions, fetchQuarantine]);

  return (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);

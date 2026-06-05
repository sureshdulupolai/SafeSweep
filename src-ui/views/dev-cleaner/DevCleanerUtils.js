import { useState, useEffect } from 'react';

export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export function useProgressiveText(isScanning, cacheCount, selectedLanguage) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const getDynamicSteps = (language) => {
    if (language === 'python') {
      return [
        "Initializing parallel system scan...",
        "Querying C:\\ drive for Python directories...",
        "Locating virtual environments (venv, conda)...",
        "Aggregating __pycache__ and unused packages...",
        "Building master Python cache list...",
        "Finalizing deep Python environment analysis..."
      ];
    } else if (language === 'node') {
      return [
        "Initializing parallel system scan...",
        "Querying C:\\ drive for JS projects...",
        "Locating heavy node_modules folders...",
        "Aggregating npm/yarn/pnpm global caches...",
        "Building master JavaScript cache list...",
        "Finalizing deep Node environment analysis..."
      ];
    } else if (language === 'java') {
      return [
        "Initializing parallel system scan...",
        "Querying C:\\ drive for Java projects...",
        "Locating Maven (.m2) and Gradle caches...",
        "Aggregating heavy target/build folders...",
        "Building master Java cache list...",
        "Finalizing deep Java environment analysis..."
      ];
    } else if (language === 'rust') {
      return [
        "Initializing parallel system scan...",
        "Querying C:\\ drive for Rust projects...",
        "Locating Cargo caches...",
        "Aggregating heavy target folders...",
        "Building master Rust cache list...",
        "Finalizing deep Rust environment analysis..."
      ];
    }
    return [
      "Initializing parallel system scan...",
      "Querying C:\\ drive NTFS analytics...",
      "Locating developer environments...",
      "Aggregating massive build caches...",
      "Building master developer cache list...",
      "Finalizing deep system analysis..."
    ];
  };

  const SCAN_STEPS = getDynamicSteps(selectedLanguage);

  useEffect(() => {
    if (!isScanning) {
      setCurrentStepIndex(0);
      return;
    }
    if (cacheCount > 0) {
      setCurrentStepIndex(s => Math.max(s, 1));
      if (cacheCount > 5) setCurrentStepIndex(s => Math.max(s, 2));
      if (cacheCount > 20) setCurrentStepIndex(s => Math.max(s, 3));
      if (cacheCount > 50) setCurrentStepIndex(s => Math.max(s, 4));
      if (cacheCount > 100) setCurrentStepIndex(s => Math.max(s, 5));
    }
  }, [cacheCount, isScanning]);

  useEffect(() => {
    if (!isScanning) return;
    let isActive = true;
    const timeouts = [
      setTimeout(() => isActive && setCurrentStepIndex(s => Math.max(s, 1)), 2500),
      setTimeout(() => isActive && setCurrentStepIndex(s => Math.max(s, 2)), 7000),
      setTimeout(() => isActive && setCurrentStepIndex(s => Math.max(s, 3)), 14000),
      setTimeout(() => isActive && setCurrentStepIndex(s => Math.max(s, 4)), 22000),
      setTimeout(() => isActive && setCurrentStepIndex(s => Math.max(s, 5)), 32000),
      setTimeout(() => isActive && setCurrentStepIndex(s => Math.max(s, 6)), 40000)
    ];
    return () => {
      isActive = false;
      timeouts.forEach(clearTimeout);
    };
  }, [isScanning]);

  return SCAN_STEPS[Math.min(currentStepIndex, SCAN_STEPS.length - 1)];
}

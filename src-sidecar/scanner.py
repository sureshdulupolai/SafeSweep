import os
import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor
from safety import normalize_windows_path, is_reparse_point
from safety_middleware import middleware
from exclusion_engine import exclusion_engine
from performance_manager import performance_manager
from error_classification import wrap_sys_error, CleanerError
from utils.logger import logger

class ScanningTask:
    def __init__(self, start_path, scan_mode="balanced", rpc_notify_callback=None):
        self.start_path = normalize_windows_path(start_path)
        self.scan_mode = scan_mode.lower()
        self.rpc_notify_callback = rpc_notify_callback
        self.cancel_event = threading.Event()
        self.files_found = []
        self.scanned_count = 0
        self.total_size_bytes = 0
        self.batch_size = 500
        self.active_batch = []
        self.lock = threading.Lock()

    def cancel(self):
        """Signals active scanning threads to immediately abort execution."""
        self.cancel_event.set()

    def execute(self):
        """Starts recursive folder traversal across specified target volumes."""
        logger.info("Initializing recursive directory scan.", {
            "path": self.start_path, 
            "mode": self.scan_mode
        })
        
        # Enforce central Safety Middleware path approvals
        safety_status = middleware.verify_scan_request(self.start_path)
        safe_mode = safety_status["safe_mode"]

        # Run directory traversal
        max_workers, _ = performance_manager.evaluate_throttling()
        
        # Quick Scan limits targets strictly to temporary and cache paths
        if self.scan_mode == "quick":
            self._scan_quick_directories()
        else:
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                executor.submit(self._recursive_walk, self.start_path)

        # Flush any remaining items in the buffer
        self._flush_batch()
        
        logger.info("Finished folder scanning operations.", {
            "scanned_count": self.scanned_count,
            "total_size_bytes": self.total_size_bytes
        })
        
        limit_exceeded = self.scanned_count >= 5000
        
        return {
            "status": "completed",
            "safe_mode_enforced": safe_mode,
            "files_found_count": self.scanned_count,
            "total_size_bytes": self.total_size_bytes,
            "warning": safety_status["warning"],
            "limit_exceeded": limit_exceeded
        }

    def _scan_quick_directories(self):
        """Quick Scan: Sweep predefined safe targets only, bypassing deep user folders."""
        safe_paths = [
            os.environ.get("TEMP"),
            os.path.join(os.environ.get("SystemRoot", "C:\\Windows"), "Temp"),
            os.path.join(os.environ.get("SystemRoot", "C:\\Windows"), "Prefetch")
        ]
        for p in safe_paths:
            if p and os.path.exists(p):
                normalized = normalize_windows_path(p)
                self._recursive_walk(normalized)
                if self.cancel_event.is_set():
                    break

    def _recursive_walk(self, current_dir):
        """Traverses a directory structure using fast, non-blocking os.scandir loops."""
        if self.cancel_event.is_set():
            return

        # Check path exclusions (.git, node_modules, WSL, VMs)
        if exclusion_engine.is_excluded(current_dir):
            return

        try:
            with os.scandir(current_dir) as it:
                for entry in it:
                    if self.cancel_event.is_set():
                        return

                    # Detect and skip NTFS directory junctions, mounts, or symlink boundaries
                    if entry.is_symlink() or is_reparse_point(entry.path):
                        continue

                    if entry.is_dir(follow_symlinks=False):
                        # Recursive descent
                        self._recursive_walk(entry.path)
                    elif entry.is_file(follow_symlinks=False):
                        self._process_file_entry(entry)

        except Exception as e:
            # Handle permission denials or OS errors gracefully without terminating sidecar
            logger.warn("Skipped folder traversal due to OS access limitations.", {"path": current_dir, "error": str(e)})

    def _process_file_entry(self, entry):
        """Validates, classifies, and indexes a single filesystem file."""
        if self.scanned_count >= 5000:
            self.cancel()
            return

        try:
            file_path = entry.path
            
            # Skip hidden system file extensions (like .sys or .dll) unless override in Dev Mode
            _, ext = os.path.splitext(file_path)
            if ext.lower() in {".sys", ".dll", ".efi", ".boot"}:
                return

            size = entry.stat(follow_symlinks=False).st_size
            risk = middleware.classify_risk(file_path)

            file_record = {
                "name": entry.name,
                "path": file_path,
                "size": size,
                "risk": risk
            }

            with self.lock:
                if self.scanned_count >= 5000:
                    self.cancel()
                    return

                self.active_batch.append(file_record)
                self.scanned_count += 1
                self.total_size_bytes += size

                if len(self.active_batch) >= self.batch_size:
                    self._flush_batch()

        except Exception:
            # Skip file gracefully if stat or classification fails
            pass

    def _flush_batch(self):
        """Streams the current batch of scanned results back to Electron via JSON-RPC."""
        if not self.active_batch:
            return
            
        if self.rpc_notify_callback:
            # Send notification
            self.rpc_notify_callback("scanner.progress", {
                "scanned_count": self.scanned_count,
                "total_size_bytes": self.total_size_bytes,
                "files": self.active_batch
            })
            
        self.active_batch = []

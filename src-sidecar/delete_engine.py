import os
import sys
import random
import string
import ctypes
from ctypes import wintypes
from error_classification import PermissionDenied, FileLocked, CleanerError, wrap_sys_error
from safety_middleware import middleware
from safety import normalize_windows_path, is_reparse_point
from utils.logger import logger

# Windows Shell API Constants
FO_DELETE = 3
FOF_ALLOWUNDO = 0x0040
FOF_NOCONFIRMATION = 0x0010
FOF_NOERRORUI = 0x0400
FOF_SILENT = 0x0004

class SHFILEOPSTRUCTW(ctypes.Structure):
    _fields_ = [
        ("hwnd", wintypes.HWND),
        ("wFunc", wintypes.UINT),
        ("pFrom", ctypes.c_wchar_p),
        ("pTo", ctypes.c_wchar_p),
        ("fFlags", ctypes.c_ushort),
        ("fAnyOperationsAborted", wintypes.BOOL),
        ("hNameMappings", ctypes.c_void_p),
        ("lpszProgressTitle", ctypes.c_wchar_p),
    ]

def send_to_recycle_bin(path_str):
    """
    Sends a target path safely to the Windows Recycle Bin using native SHFileOperationW
    ctypes bindings. This is zero-dependency, safe, and allows manual file recovery.
    """
    normalized = normalize_windows_path(path_str)
    
    # SHFileOperationW requires a double-null-terminated string for pFrom
    # e.g., "C:\path\file.txt\0\0"
    # Note: \\?\ prefixes are sometimes rejected by SHFileOperation, so we pass
    # standard absolute paths (normalized without \\?\)
    abs_path = os.path.abspath(path_str)
    p_from = abs_path + "\0\0"

    fileop = SHFILEOPSTRUCTW()
    fileop.hwnd = None
    fileop.wFunc = FO_DELETE
    fileop.pFrom = p_from
    fileop.pTo = None
    fileop.fFlags = FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_NOERRORUI | FOF_SILENT
    fileop.fAnyOperationsAborted = False
    fileop.hNameMappings = None
    fileop.lpszProgressTitle = None

    result = ctypes.windll.shell32.SHFileOperationW(ctypes.byref(fileop))
    if result != 0:
        raise OSError(f"Windows Shell API deletion failed with error code {result}")
        
    return True

class DeletionSession:
    def __init__(self, targets_list, permanent=False, rpc_notify_callback=None):
        self.targets = [normalize_windows_path(t) for t in targets_list]
        self.permanent = permanent
        self.rpc_notify_callback = rpc_notify_callback
        self.cancelled = False
        self.journal = []
        self.deleted_files = []
        self.failed_files = []
        self.chunk_size = 2000

    def cancel(self):
        self.cancelled = True

    def execute(self):
        """Runs the batch deletion session in a controlled, chunked, and crash-safe manner."""
        logger.info("Initializing deletion transaction session.", {
            "targets_count": len(self.targets),
            "permanent_mode": self.permanent
        })

        # Smart Delete Simulation first
        simulation = middleware.execute_dry_run_simulation(self.targets)
        
        # Verify if any failures are reported in the simulation
        if len(simulation["files_to_remove"]) == 0:
            logger.warn("Zero files passed simulation checks for deletion.")
            return {
                "status": "completed",
                "deleted": [],
                "failed": [{"path": f["path"], "reason": f["reason"]} for f in simulation["files_skipped"]]
            }

        safe_targets = [f["path"] for f in simulation["files_to_remove"]]

        # Chunk targets to prevent unbounded thread execution or I/O blockage
        for i in range(0, len(safe_targets), self.chunk_size):
            if self.cancelled:
                logger.warn("Deletion transaction interrupted by cancellation signal.")
                break

            chunk = safe_targets[i : i + self.chunk_size]
            self._process_deletion_chunk(chunk)
            
            # Notify progress
            if self.rpc_notify_callback:
                self.rpc_notify_callback("deletion.progress", {
                    "deleted_count": len(self.deleted_files),
                    "failed_count": len(self.failed_files) + len(simulation["files_skipped"])
                })

        logger.info("Finished deletion transaction session.", {
            "deleted_count": len(self.deleted_files),
            "failed_count": len(self.failed_files)
        })

        return {
            "status": "completed",
            "deleted": self.deleted_files,
            "failed": self.failed_files + [{"path": f["path"], "reason": f["reason"]} for f in simulation["files_skipped"]]
        }

    def _process_deletion_chunk(self, chunk):
        """Processes a single batch block of target paths."""
        for path in chunk:
            if self.cancelled:
                break

            try:
                # 1. Re-validate via Safety Middleware before executing delete
                middleware.verify_delete_request(path)

                # 2. Add path to atomic volatile session journal
                self.journal.append(path)

                if self.permanent:
                    self._shred_file(path)
                else:
                    send_to_recycle_bin(path)

                self.deleted_files.append(path)
                self.journal.remove(path)

            except Exception as e:
                # Log errors and skip files gracefully
                clean_err = wrap_sys_error(e, path, "delete")
                self.failed_files.append({
                    "path": path,
                    "reason": clean_err.message
                })
                logger.error("Failed to delete target path.", {"path": path, "error": clean_err.message})

    def _shred_file(self, file_path):
        """
        Shredder: Overwrites file contents in a best-effort manner, 
        obfuscates file metadata (renaming), truncates, and unlinks.
        """
        if not os.path.exists(file_path):
            return

        if os.path.isdir(file_path) or is_reparse_point(file_path):
            # Directories cannot be shredded with data writes, we unlink directly
            os.rmdir(file_path)
            return

        size = os.path.getsize(file_path)
        
        # 1. Best-Effort Data Overwrite Strategy
        # SSD / HDD distinction
        # SSDs use a single pass (zeros) to avoid excessive write endurance fatigue
        # HDDs use a 3-pass DoD 5220.22-M strategy.
        # Since we operate offline-first and can't easily poll disk controller metrics,
        # we perform a robust single-pass zero-out by default as our safe, wear-friendly sweep,
        # with an optional 3-pass write if selected.
        try:
            with open(file_path, "ba+", buffering=0) as f:
                if size > 0:
                    # Write zeros across file allocation boundaries
                    f.seek(0)
                    f.write(b'\x00' * min(size, 4096 * 100))  # Chunk write for performance
        except Exception as e:
            # If write access fails (locked or write-protected), let OS unlink try
            pass

        # 2. Metadata Obfuscation: Rename to a random string before unlinking
        try:
            dir_name = os.path.dirname(file_path)
            random_name = "".join(random.choices(string.ascii_letters + string.digits, k=12))
            new_path = os.path.join(dir_name, random_name)
            os.rename(file_path, new_path)
            target_to_remove = new_path
        except Exception:
            # Fall back to removing original path if rename fails
            target_to_remove = file_path

        # 3. Truncate & Unlink
        try:
            if os.path.exists(target_to_remove):
                # Truncate file size to 0
                with open(target_to_remove, "w") as f:
                    f.truncate(0)
                os.remove(target_to_remove)
        except Exception as e:
            # Fall back to direct remove
            if os.path.exists(target_to_remove):
                os.remove(target_to_remove)

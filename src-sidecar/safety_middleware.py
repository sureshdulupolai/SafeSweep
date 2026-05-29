import os
import sys
import ctypes
from error_classification import PermissionDenied, FileLocked, JunctionBlocked, CleanerError
import safety

class SafetyMiddleware:
    def __init__(self, developer_mode=False):
        self.developer_mode = developer_mode

    def set_developer_mode(self, enabled):
        self.developer_mode = bool(enabled)

    def classify_risk(self, file_path):
        """
        Evaluates and labels any file with a safety risk rating:
        SAFE, LOW, MEDIUM, HIGH, or CRITICAL.
        """
        # Canonical normalization
        norm_path = os.path.normpath(file_path).lower()
        _, ext = os.path.splitext(norm_path)

        # Check critical system parameters first
        if safety.verify_safe_mode_needed(file_path):
            return "CRITICAL"
        if ext in safety.PROTECTED_EXTENSIONS:
            return "CRITICAL" if ext in {".sys", ".dll", ".efi", ".boot", ".reg"} else "HIGH"

        # High Risk elements: Executables, installers, commands
        if ext in {".exe", ".msi", ".msp", ".bat", ".cmd", ".ps1", ".vhd", ".vhdx"}:
            return "HIGH"

        # Medium Risk elements: User secondary documents
        if ext in {".zip", ".rar", ".7z", ".tar", ".gz", ".iso"}:
            return "MEDIUM"

        # Low Risk elements: Log records, shortcut indices
        if ext in {".log", ".tmp", ".bak"} or "recent" in norm_path or "logs" in norm_path:
            return "LOW"

        # Safe elements: Caches, thumbnails
        if "temp" in norm_path or "cache" in norm_path or "thumbnail" in norm_path or "thumbcache" in norm_path:
            return "SAFE"

        return "LOW"

    def verify_scan_request(self, path_str):
        """
        Validates folder scan parameters.
        Returns a dictionary detailing:
        { "safe_mode": bool, "risk": str, "warning": str or None }
        """
        normalized = safety.normalize_windows_path(path_str)

        # Check for NTFS Reparse junction links
        if safety.is_reparse_point(normalized):
            raise JunctionBlocked(f"Folder '{path_str}' is an NTFS directory junction or symlink. Direct scanning blocked.")

        # Determine if target falls under read-only system locks
        safe_mode_enforced = safety.verify_safe_mode_needed(normalized)
        
        warning = None
        if safe_mode_enforced:
            warning = "⚠️ Protected Windows/System Location Detected. To protect system stability, destructive operations are disabled for this location."

        return {
            "safe_mode": safe_mode_enforced,
            "risk": "CRITICAL" if safe_mode_enforced else "LOW",
            "warning": warning
        }

    def verify_delete_request(self, file_path):
        """
        Validates individual file deletion parameters.
        Throws CleanerError exceptions if rules are violated.
        """
        normalized = safety.normalize_windows_path(file_path)

        # 1. Enforce Read-Only safe boundaries
        if safety.verify_safe_mode_needed(normalized):
            raise PermissionDenied(f"Delete blocked: Target '{file_path}' lies inside a protected system directory.")

        # 2. Check junction reference lines
        if safety.is_reparse_point(normalized):
            raise JunctionBlocked(f"Delete blocked: Target '{file_path}' is an NTFS symbolic link or directory junction.")

        # 3. Check System Extension protections
        _, ext = os.path.splitext(normalized)
        if ext.lower() in safety.PROTECTED_EXTENSIONS:
            if not self.developer_mode:
                raise PermissionDenied(
                    f"Delete blocked: '{ext}' is a protected system file extension. Exposing this requires Developer Mode overrides."
                )

        # 4. Critical User Profiles checks
        if safety.check_path_matches_list(normalized, safety.PROTECTED_CRITICAL_USER_DATA):
            raise PermissionDenied(f"Delete blocked: '{file_path}' resides inside highly sensitive user directories (SSH, WALLETS, WSL).")

        # 5. Check process locking handles
        if self.is_file_locked(normalized):
            raise FileLocked(f"Delete blocked: '{file_path}' is currently locked/in use by another process.")

        return True

    def is_file_locked(self, file_path):
        """
        Audits process locks on a file by attempting a non-disruptive, sharing-inhibited write handle
        query via standard Windows OS APIs.
        """
        # Reparse points and directories are never audited with standard file writes
        if os.path.isdir(file_path) or safety.is_reparse_point(file_path):
            return False

        # Attempt to open file exclusively to check if another process holds locks
        # On Windows, we can use ctypes CreateFileW with zero sharing to test lock states cleanly
        GENERIC_WRITE = 0x40000000
        FILE_SHARE_NONE = 0
        OPEN_EXISTING = 3
        FILE_ATTRIBUTE_NORMAL = 0x80

        # Long path wrapper
        normalized = safety.normalize_windows_path(file_path)

        handle = ctypes.windll.kernel32.CreateFileW(
            normalized,
            GENERIC_WRITE,
            FILE_SHARE_NONE,
            None,
            OPEN_EXISTING,
            FILE_ATTRIBUTE_NORMAL,
            None
        )

        INVALID_HANDLE_VALUE = -1
        if handle == INVALID_HANDLE_VALUE:
            err = ctypes.windll.kernel32.GetLastError()
            # 32 (ERROR_SHARING_VIOLATION) or 5 (ERROR_ACCESS_DENIED) indicates lock/privilege locks
            if err in (5, 32):
                return True
            return False

        # If we successfully got the handle, the file is not locked by another process
        ctypes.windll.kernel32.CloseHandle(handle)
        return False

    def execute_dry_run_simulation(self, targets_list):
        """
        Performs a full dry-run simulation of an active clean request.
        Compiles structural summaries detailing what will change, what will be skipped,
        and provides risk metrics before any writes are committed to disk.
        """
        files_to_remove = []
        files_skipped = []
        protected_ignored = []
        total_freed_bytes = 0
        risk_summary = {"SAFE": 0, "LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}

        for path in targets_list:
            normalized = safety.normalize_windows_path(path)
            
            if not os.path.exists(normalized) and not safety.is_reparse_point(normalized):
                continue

            try:
                # Run through all safety validations
                self.verify_delete_request(normalized)
                
                # If safe, compute stats
                size = 0
                if os.path.isfile(normalized) and not safety.is_reparse_point(normalized):
                    size = os.path.getsize(normalized)
                
                risk = self.classify_risk(normalized)
                risk_summary[risk] += 1
                total_freed_bytes += size

                files_to_remove.append({
                    "path": path,
                    "size": size,
                    "risk": risk
                })
            except (PermissionDenied, JunctionBlocked) as e:
                protected_ignored.append({
                    "path": path,
                    "reason": str(e)
                })
                risk_summary["CRITICAL"] += 1
            except FileLocked as e:
                files_skipped.append({
                    "path": path,
                    "reason": "Currently In Use"
                })
                risk_summary["HIGH"] += 1
            except Exception as e:
                files_skipped.append({
                    "path": path,
                    "reason": str(e)
                })

        return {
            "status": "simulation_success",
            "files_to_remove": files_to_remove,
            "files_skipped": files_skipped,
            "protected_ignored": protected_ignored,
            "total_freed_bytes": total_freed_bytes,
            "risk_summary": risk_summary
        }

# Global middleware instance
middleware = SafetyMiddleware()

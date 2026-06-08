import os
import sys
import json
import re
import datetime
import hashlib

# Masking logic to prevent personal paths or user profiles from leaking into logs
USER_PROFILE_RAW = os.environ.get("USERPROFILE", "")
USERNAME_RAW = os.environ.get("USERNAME", "")

def mask_sensitive_paths(path_str):
    """
    Masks personal information (such as system usernames, user profiles, or deep 
    personal folder paths) from strings to guarantee zero trace leaks in log files.
    """
    if not path_str:
        return ""
    
    # Replace explicit username with masked representation
    if USERNAME_RAW and USERNAME_RAW in path_str:
        path_str = path_str.replace(USERNAME_RAW, "***")
        
    # Replace user profile root (e.g. C:\Users\user)
    if USER_PROFILE_RAW and USER_PROFILE_RAW in path_str:
        path_str = path_str.replace(USER_PROFILE_RAW, "C:\\Users\\***")

    # Mask specific nested personal roots
    # E.g. replace characters of filenames in Documents/Desktop to maintain structural length but conceal contents
    parts = path_str.split(os.sep)
    for i, part in enumerate(parts):
        # Hash folder elements beyond the main system volumes/structures
        if i > 2 and part and part != "***" and not part.startswith("["):
            # MD5 hash part of the filename/foldername for diagnostic tracking without revealing original text
            hashed = hashlib.md5(part.encode('utf-8', errors='ignore')).hexdigest()[:6]
            parts[i] = f"node_{hashed}"
            
    return os.sep.join(parts)

class PrivacyLogger:
    def __init__(self, app_name="SafeSweep"):
        self.app_name = app_name
        self.log_dir = None
        self.log_file_path = None

    def _initialize_log_dir(self):
        """No longer creates a log directory on disk to keep the PC clean."""
        return None

    def log(self, level, message, details=None):
        """Writes a structured log entry. Personal file paths in details are automatically masked."""
        log_entry = {
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "level": level.upper(),
            "message": str(message),
        }
        
        if details:
            cleaned_details = {}
            for k, v in details.items():
                if isinstance(v, str) and ("\\" in v or "/" in v or USERNAME_RAW in v):
                    cleaned_details[k] = mask_sensitive_paths(v)
                else:
                    cleaned_details[k] = v
            log_entry["details"] = cleaned_details

        try:
            # Print to stderr instead of writing to disk to keep the system clean
            print(f"[{log_entry['level']}] {log_entry['message']}", file=sys.stderr)
        except Exception:
            # Never crash the sidecar because of a logging issue
            pass

    def info(self, message, details=None):
        self.log("INFO", message, details)

    def warn(self, message, details=None):
        self.log("WARN", message, details)

    def error(self, message, details=None):
        self.log("ERROR", message, details)

# Global logger instance
logger = PrivacyLogger()

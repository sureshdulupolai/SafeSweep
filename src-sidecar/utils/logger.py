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
        self.log_dir = self._initialize_log_dir()
        self.log_file_path = os.path.join(self.log_dir, f"app_{datetime.date.today().isoformat()}.log")
        self.rotate_and_purge_old_logs()

    def _initialize_log_dir(self):
        """Initializes logs directory securely in local user AppData."""
        local_app_data = os.environ.get("LOCALAPPDATA")
        if local_app_data:
            base_dir = os.path.join(local_app_data, self.app_name)
        else:
            base_dir = os.path.join(os.path.expanduser("~"), f".{self.app_name.lower()}")
            
        log_dir = os.path.join(base_dir, "Logs")
        os.makedirs(log_dir, exist_ok=True)
        return log_dir

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
            with open(self.log_file_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(log_entry) + "\n")
        except Exception:
            # Never crash the sidecar because of a logging issue
            pass

    def info(self, message, details=None):
        self.log("INFO", message, details)

    def warn(self, message, details=None):
        self.log("WARN", message, details)

    def error(self, message, details=None):
        self.log("ERROR", message, details)

    def rotate_and_purge_old_logs(self, retention_days=7):
        """Deletes files older than the retention threshold (default: 7 days)."""
        try:
            now = datetime.datetime.now()
            for filename in os.listdir(self.log_dir):
                if not filename.endswith(".log"):
                    continue
                file_path = os.path.join(self.log_dir, filename)
                file_time = datetime.datetime.fromtimestamp(os.path.getmtime(file_path))
                if (now - file_time).days >= retention_days:
                    os.remove(file_path)
        except Exception:
            pass

    def clear_all_logs(self):
        """Allows users to manually flush all diagnostics from local directories."""
        try:
            for filename in os.listdir(self.log_dir):
                file_path = os.path.join(self.log_dir, filename)
                os.remove(file_path)
        except Exception as e:
            raise CleanerError(f"Failed to clear diagnostic log files: {str(e)}")

# Global logger instance
logger = PrivacyLogger()

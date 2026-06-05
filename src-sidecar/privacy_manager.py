import os
import glob
import subprocess
import logging
import winreg

logger = logging.getLogger(__name__)

def clear_privacy_traces():
    """
    Clears Clipboard history, Recent Documents, DNS Cache, and Run Dialog history.
    """
    logger.info("[Privacy Sweeper] Starting privacy trace cleanup...")
    
    traces_cleaned = 0
    errors = []
    
    # 1. DNS Cache
    try:
        res = subprocess.run(["ipconfig", "/flushdns"], capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW)
        if res.returncode == 0:
            traces_cleaned += 1
    except Exception as e:
        errors.append(f"DNS Cache: {e}")
        
    # 2. Clipboard History
    try:
        # Echo off pipe to clip clears the clipboard
        res = subprocess.run(["cmd", "/c", "echo off | clip"], capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW)
        if res.returncode == 0:
            traces_cleaned += 1
    except Exception as e:
        errors.append(f"Clipboard: {e}")
        
    # 3. Recent Documents List (File Explorer)
    try:
        recent_path = os.path.join(os.environ['USERPROFILE'], 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Recent')
        if os.path.exists(recent_path):
            count = 0
            for item in glob.glob(os.path.join(recent_path, "*")):
                try:
                    os.remove(item)
                    count += 1
                except Exception:
                    pass
            if count > 0:
                traces_cleaned += count
    except Exception as e:
        errors.append(f"Recent Docs: {e}")
        
    # 4. Run Dialog History (Registry)
    try:
        reg_path = r"Software\Microsoft\Windows\CurrentVersion\Explorer\RunMRU"
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, reg_path, 0, winreg.KEY_ALL_ACCESS)
        
        # Delete all values in this key
        # Windows keeps a, b, c, etc., and MRUList
        # Easiest way is to enumerate and delete values
        try:
            while True:
                name, _, _ = winreg.EnumValue(key, 0)
                winreg.DeleteValue(key, name)
                traces_cleaned += 1
        except OSError:
            # No more values
            pass
        winreg.CloseKey(key)
    except Exception as e:
        # Key might not exist
        pass

    return {
        "status": "completed",
        "traces_cleaned": traces_cleaned,
        "errors": errors
    }

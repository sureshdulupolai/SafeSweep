import winreg
import logging
import os

logger = logging.getLogger(__name__)

def get_startup_apps():
    r"""
    Reads startup applications from the registry.
    We check HKCU\Software\Microsoft\Windows\CurrentVersion\Run
    and HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run
    """
    apps = []
    run_key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
    approved_path = r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"
    
    # 1. First get all defined in Run
    try:
        run_key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, run_key_path, 0, winreg.KEY_READ)
        for i in range(winreg.QueryInfoKey(run_key)[1]):
            try:
                name, value, _ = winreg.EnumValue(run_key, i)
                if name and value and str(name).strip() != "" and str(value).strip() != "":
                    apps.append({
                        "name": str(name).strip(),
                        "command": str(value).strip(),
                        "enabled": True # Default to True
                    })
            except OSError:
                pass
        winreg.CloseKey(run_key)
    except Exception as e:
        logger.error(f"Failed to read Run key: {e}")

    # 2. Check StartupApproved to see if they are disabled by Task Manager
    try:
        appr_key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, approved_path, 0, winreg.KEY_READ)
        for app in apps:
            try:
                # Value is binary. If the first byte is 0x02, it is enabled. 
                # If it's something else (like 0x03, 0x0B), it's disabled.
                # Actually, Windows 10/11:
                # 0x02 0x00 ... = Enabled
                # 0x03 0x00 ... = Disabled
                value, _ = winreg.QueryValueEx(appr_key, app["name"])
                if value and len(value) > 0:
                    if value[0] == 3 or value[0] == 11 or value[0] == 9: # 0x03, 0x0B, 0x09 are typical disabled states
                        app["enabled"] = False
                    else:
                        app["enabled"] = True
            except OSError:
                # If not present in StartupApproved, it usually means it's enabled
                pass
        winreg.CloseKey(appr_key)
    except Exception as e:
        logger.error(f"Failed to read StartupApproved key: {e}")
        
    return apps

def toggle_startup_app(name, enable):
    r"""
    Toggles a startup app by writing to StartupApproved\Run
    """
    approved_path = r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"
    
    try:
        # Open key with write access
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, approved_path, 0, winreg.KEY_ALL_ACCESS)
        
        # Read existing to get the timestamp (last 8 bytes are FILETIME, first 4 are flag)
        try:
            value, type_id = winreg.QueryValueEx(key, name)
            value_list = list(value)
        except OSError:
            # If doesn't exist, create a default byte array (12 bytes)
            value_list = [0] * 12
            type_id = winreg.REG_BINARY
            
        # Update flag
        if enable:
            value_list[0] = 0x02
        else:
            value_list[0] = 0x03 # Disabled
            
        # Convert back to bytes
        new_value = bytes(value_list)
        winreg.SetValueEx(key, name, 0, winreg.REG_BINARY, new_value)
        winreg.CloseKey(key)
        return {"success": True, "enabled": enable}
    except Exception as e:
        return {"success": False, "error": str(e)}

import psutil
import subprocess
import logging
import re
import base64

logger = logging.getLogger(__name__)

# Known safe-to-disable background services (bloat/telemetry)
SAFE_TO_DISABLE = {
    "XboxGipSvc": "Xbox Accessory Management. Disable if not using Xbox controller.",
    "xbgm": "Xbox Game Monitoring.",
    "XblAuthManager": "Xbox Live Auth Manager.",
    "XblGameSave": "Xbox Live Game Save.",
    "XboxNetApiSvc": "Xbox Live Networking Service.",
    "MapsBroker": "Downloaded Maps Manager. Disable if not using offline maps.",
    "RetailDemo": "Retail Demo Service. Completely safe to disable for normal users.",
    "WbioSrvc": "Windows Biometric Service. Disable if not using fingerprint/face login.",
    "PhoneSvc": "Phone Service. Safe to disable if you don't link your phone to PC."
}

def get_services_info():
    services = []
    # Using list conversion is needed if psutil.win_service_iter() behavior varies,
    # but iteration directly is safer in newer psutil versions.
    try:
        iterator = psutil.win_service_iter()
        for svc in iterator:
            try:
                name = svc.name()
                if name in SAFE_TO_DISABLE:
                    status = svc.status()
                    pid = svc.pid()
                    
                    mem_usage = 0
                    cpu_usage = 0.0
                    
                    if pid and status == 'running':
                        try:
                            proc = psutil.Process(pid)
                            mem_usage = proc.memory_info().rss
                        except (psutil.NoSuchProcess, psutil.AccessDenied):
                            pass
                    
                    services.append({
                        "name": name,
                        "display_name": svc.display_name(),
                        "status": status,
                        "pid": pid,
                        "memory_bytes": mem_usage,
                        "cpu_percent": cpu_usage,
                        "reason": SAFE_TO_DISABLE[name]
                    })
            except Exception:
                continue
    except Exception as ex:
        logger.error(f"Failed to iterate windows services: {ex}")

    # Sort services by status (running first) then memory usage
    services.sort(key=lambda x: (x["status"] != "running", -x["memory_bytes"]))
    return services

def change_service_status(name, action):
    """
    Attempts to start or stop a service via sc.
    If it fails due to access denied, it requests UAC elevation.
    """
    if not name or not re.match(r"^[a-zA-Z0-9_\-\s]+$", str(name)):
        return {"success": False, "error": "Invalid service name format. Only alphanumeric characters allowed."}
        
    if action not in ["start", "stop"]:
        return {"success": False, "error": "Invalid action"}
        
    try:
        # We use 'sc' command which works for most services
        # Some services may require admin rights (Access Denied)
        result = subprocess.run(["sc", action, name], capture_output=True, text=True)
        if result.returncode == 0:
            return {"success": True}
        else:
            err_msg = result.stderr.strip() or result.stdout.strip()
            # Clean up the sc output which is often verbose
            if "Access is denied" in err_msg or "5" in err_msg:
                try:
                    elevate_cmd = f"Start-Process sc -ArgumentList '{action}', '{name}' -Verb RunAs -WindowStyle Hidden -Wait"
                    # Base64 encode the PowerShell command to completely eliminate shell injection
                    encoded_cmd = base64.b64encode(elevate_cmd.encode('utf-16le')).decode('utf-8')
                    elevate_res = subprocess.run(["powershell", "-EncodedCommand", encoded_cmd], capture_output=True, text=True)
                    if elevate_res.returncode == 0:
                        return {"success": True}
                    else:
                        return {"success": False, "error": "Administrator privileges were denied or cancelled."}
                except Exception:
                    return {"success": False, "error": "Access Denied. Failed to prompt for Administrator privileges."}
            return {"success": False, "error": err_msg}
    except Exception as e:
        return {"success": False, "error": str(e)}

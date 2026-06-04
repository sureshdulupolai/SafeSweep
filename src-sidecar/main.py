import sys
import os
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn
from rpc import RPCDispatcher
from scanner import ScanningTask
from delete_engine import DeletionSession

from browser import browser_cleaner
from exclusion_engine import exclusion_engine
from crash_recovery import crash_recovery_manager
from safety_middleware import middleware
from utils.recycle_bin import query_recycle_bin, empty_recycle_bin
from utils.database import db
from utils.logger import logger
from error_classification import CleanerError

dispatcher = RPCDispatcher()

# Active Task tracking for cooperative cancellation mechanisms
active_scan_task = None
active_delete_task = None

task_lock = threading.Lock()

def rpc_notify(method, params):
    """Outbound progress status notification helper."""
    packet = {
        "jsonrpc": "2.0",
        "method": str(method),
        "params": params
    }
    sys.stdout.write(json.dumps(packet) + "\n")
    sys.stdout.flush()

# Globals to cache statistics safely to avoid repetitive heavy I/O walks
cached_stats = {
    "temp_size": 0,
    "temp_count": 0,
    "browser_size": 0,
    "browser_count": 0,
    "last_updated": 0
}

is_updating_stats = False
stats_lock = threading.Lock()

def update_cached_stats_thread():
    global cached_stats, is_updating_stats
    import sys
    import math
    with stats_lock:
        if is_updating_stats:
            return
        is_updating_stats = True

    try:
        # Calculate Temp & Waste Files with deep robust detection
        temp_dirs = []
        
        # 1. User Temp (%TEMP%, %TMP%)
        for env in ["TEMP", "TMP"]:
            val = os.environ.get(env)
            if val and os.path.exists(val):
                temp_dirs.append(val)
        
        up = os.environ.get("USERPROFILE") or os.path.expanduser("~")
        if up and os.path.exists(up):
            up_temp = os.path.join(up, "AppData", "Local", "Temp")
            if os.path.exists(up_temp):
                temp_dirs.append(up_temp)
                
        # 2. System Temp (C:\Windows\Temp)
        sys_root = os.environ.get("SystemRoot", "C:\\Windows")
        sys_temp = os.path.join(sys_root, "Temp")
        if os.path.exists(sys_temp):
            temp_dirs.append(sys_temp)
            
        # 3. System Prefetch (C:\Windows\Prefetch)
        sys_prefetch = os.path.join(sys_root, "Prefetch")
        if os.path.exists(sys_prefetch):
            temp_dirs.append(sys_prefetch)
            
        # 4. Windows Update Downloads (C:\Windows\SoftwareDistribution\Download)
        sys_sw_dist = os.path.join(sys_root, "SoftwareDistribution", "Download")
        if os.path.exists(sys_sw_dist):
            temp_dirs.append(sys_sw_dist)
            
        # 5. Crash Dumps
        if up and os.path.exists(up):
            crash_dumps = os.path.join(up, "AppData", "Local", "CrashDumps")
            if os.path.exists(crash_dumps):
                temp_dirs.append(crash_dumps)
                
        # 6. Internet Cache
        if up and os.path.exists(up):
            inet_cache = os.path.join(up, "AppData", "Local", "Microsoft", "Windows", "INetCache")
            if os.path.exists(inet_cache):
                temp_dirs.append(inet_cache)

        # De-duplicate paths preserving order
        seen = set()
        temp_dirs = [x for x in temp_dirs if not (x in seen or seen.add(x))]

        t_size, t_count = 0, 0
        for p in temp_dirs:
            if p and os.path.exists(p):
                try:
                    for root, dirs, files in os.walk(p):
                        for f in files:
                            fp = os.path.join(root, f)
                            try:
                                sz = os.path.getsize(fp)
                                t_size += sz
                                t_count += 1
                            except Exception:
                                pass
                except Exception:
                    pass
        
        # Calculate Browser Cache
        b_size, b_count = 0, 0
        try:
            from browser import browser_cleaner
            caches = browser_cleaner.scan_all_browser_caches()
            b_size = sum(c["size_bytes"] for c in caches)
            b_count = sum(c["files_count"] for c in caches)
        except Exception:
            pass

        cached_stats["temp_size"] = t_size
        cached_stats["temp_count"] = t_count
        cached_stats["browser_size"] = b_size
        cached_stats["browser_count"] = b_count
        cached_stats["last_updated"] = time.time()
        
        def format_size(bytes_count):
            if not bytes_count or bytes_count == 0:
                return "0 B"
            sizes = ["B", "KB", "MB", "GB"]
            i = int(math.floor(math.log(bytes_count) / math.log(1024)))
            return f"{round(bytes_count / math.pow(1024, i), 2)} {sizes[i]}"

        # Print only a single clean unified success message
        print(f"[Sidecar Stats] Analysis completed: Temp Files: {t_count} ({format_size(t_size)}) | Browser Caches: {b_count} ({format_size(b_size)})", file=sys.stderr)
        sys.stderr.flush()

    except Exception as fatal_e:
        print(f"[Sidecar Stats Error] Analysis thread crashed: {fatal_e}", file=sys.stderr)
        sys.stderr.flush()
    finally:
        with stats_lock:
            is_updating_stats = False

# --- METHOD REGISTER BOUNDARIES ---

@dispatcher.register("system.startup")
def handle_startup(params):
    # Run startup integrity and transaction recoveries
    success = crash_recovery_manager.startup_integrity_check()
    
    # Trigger background thread immediately to query real stats asynchronously
    threading.Thread(target=update_cached_stats_thread, daemon=True).start()
    
    # Load basic state values
    exclusions = list(exclusion_engine.custom_exclusions)
    
    # Isolate dynamic user paths to prevent hardcoded user profile bugs
    user_profile = os.environ.get("USERPROFILE", "C:\\")
    if not user_profile or not os.path.exists(user_profile):
        user_profile = os.path.expanduser("~")
    if not user_profile or not os.path.exists(user_profile):
        user_profile = "C:\\"
        
    downloads = os.path.join(user_profile, "Downloads")
    desktop = os.path.join(user_profile, "Desktop")
    
    return {
        "status": "online",
        "integrity_check": "passed" if success else "failed",
        "default_exclusions_loaded": len(exclusion_engine.default_exclusion_names),
        "custom_exclusions": exclusions,
        "user_profile": user_profile,
        "downloads": downloads,
        "desktop": desktop
    }

@dispatcher.register("scanner.start_scan")
def handle_start_scan(params):
    global active_scan_task
    path = params.get("path")
    scan_mode = params.get("scan_mode", "balanced")
    
    if not path:
        raise CleanerError("Missing required parameter 'path' for scanning.")

    with task_lock:
        if active_scan_task and not active_scan_task.cancel_event.is_set():
            raise CleanerError("A scanning operation is already actively running.")
        
        active_scan_task = ScanningTask(path, scan_mode, rpc_notify)

    # Run in a background thread so we do not block sys.stdin loop!
    def run_scan():
        try:
            res = active_scan_task.execute()
            rpc_notify("scanner.completed", res)
        except Exception as e:
            logger.error("Scan worker crashed.", {"error": str(e)})
            rpc_notify("scanner.error", {"message": str(e)})

    threading.Thread(target=run_scan, daemon=True).start()
    return {"status": "scan_started", "path": path}

@dispatcher.register("scanner.cancel_scan")
def handle_cancel_scan(params):
    global active_scan_task
    with task_lock:
        if active_scan_task:
            active_scan_task.cancel()
            logger.info("Signaled active scan task cancellation.")
            return {"status": "scan_cancelled"}
        return {"status": "no_active_scan"}

@dispatcher.register("delete.start_delete")
def handle_start_delete(params):
    global active_delete_task
    targets = params.get("targets", [])
    permanent = params.get("permanent", False)
    scan_path = params.get("scan_path")
    
    if not targets:
        raise CleanerError("Missing parameter 'targets' for deletion.")

    with task_lock:
        if active_delete_task and not active_delete_task.cancelled:
            raise CleanerError("A deletion transaction is already actively running.")
        
        active_delete_task = DeletionSession(targets, permanent, rpc_notify, scan_path)

    # Create session journal before starting
    crash_recovery_manager.create_journal(targets, permanent)

    def run_delete():
        try:
            res = active_delete_task.execute()
            # Deletion successful, purge journal
            crash_recovery_manager.remove_journal()
            
            # Log cleanup run inside database
            db.execute(
                """
                INSERT INTO cleanup_history (mode, files_count, bytes_reclaimed, status)
                VALUES (?, ?, ?, ?);
                """,
                ("PERMANENT" if permanent else "SAFE", len(res.get("deleted", [])), 0, "COMPLETED")
            )
            
            rpc_notify("delete.completed", res)
            # Re-trigger background thread to update cached stats after deletion finishes
            threading.Thread(target=update_cached_stats_thread, daemon=True).start()
        except Exception as e:
            logger.error("Deletion worker crashed.", {"error": str(e)})
            rpc_notify("delete.error", {"message": str(e)})

    threading.Thread(target=run_delete, daemon=True).start()
    return {"status": "delete_started", "targets_count": len(targets)}

@dispatcher.register("delete.cancel_delete")
def handle_cancel_delete(params):
    global active_delete_task
    with task_lock:
        if active_delete_task:
            active_delete_task.cancel()
            logger.info("Signaled active delete transaction cancellation.")
            return {"status": "delete_cancelled"}
        return {"status": "no_active_delete"}



@dispatcher.register("browser.scan_caches")
def handle_browser_scan(params):
    return browser_cleaner.scan_all_browser_caches()

@dispatcher.register("recycle_bin.query")
def handle_recycle_query(params):
    return query_recycle_bin()

@dispatcher.register("recycle_bin.empty")
def handle_recycle_empty(params):
    confirm = params.get("confirm", False)
    success = empty_recycle_bin(confirm=confirm)
    return {"success": success}

@dispatcher.register("exclusions.list")
def handle_exclusions_list(params):
    return {"exclusions": list(exclusion_engine.custom_exclusions)}

@dispatcher.register("exclusions.add")
def handle_exclusions_add(params):
    path = params.get("path")
    if not path:
        raise CleanerError("Missing 'path' parameter.")
    success = exclusion_engine.add_custom_exclusion(path)
    return {"success": success}

@dispatcher.register("exclusions.remove")
def handle_exclusions_remove(params):
    path = params.get("path")
    if not path:
        raise CleanerError("Missing 'path' parameter.")
    success = exclusion_engine.remove_custom_exclusion(path)
    return {"success": success}



@dispatcher.register("system.set_developer_mode")
def handle_developer_mode(params):
    enabled = params.get("enabled", False)
    middleware.set_developer_mode(enabled)
    logger.warn(f"Developer Mode toggled: {enabled}")
    return {"developer_mode": enabled}

import shutil
@dispatcher.register("system.disk_space")
def handle_disk_space(params):
    r"""
    Queries the real total capacity and actual free space of the C:\ drive
    using standard python library fallback. No static defaults allowed.
    """
    try:
        usage = shutil.disk_usage("C:\\")
        return {
            "total": usage.total,
            "free": usage.free
        }
    except Exception as e:
        logger.error("Failed to query disk space.", {"error": str(e)})
        # If absolute failure, return 0 to indicate unknown rather than fake static data
        return {"total": 0, "free": 0}

@dispatcher.register("system.dashboard_stats")
def handle_dashboard_stats(params):
    # Trigger an asynchronous update in the background if it's been more than 30 seconds since last check
    if time.time() - cached_stats["last_updated"] > 30:
        threading.Thread(target=update_cached_stats_thread, daemon=True).start()
    
    return {
        "temp_size_bytes": cached_stats["temp_size"],
        "temp_items_count": cached_stats["temp_count"],
        "browser_size_bytes": cached_stats["browser_size"],
        "browser_items_count": cached_stats["browser_count"]
    }

@dispatcher.register("system.quick_clean")
def handle_quick_clean(params):
    target = params.get("target")
    bytes_freed = 0
    files_deleted = 0
    import shutil

    def safe_delete_folder_contents(folder_path):
        import stat
        import shutil
        if not os.path.exists(folder_path): return 0, 0, 0
        
        # 1. Fast read-only metadata walk BEFORE deletion
        freed_before = 0
        f_count_before = 0
        try:
            for root, dirs, files in os.walk(folder_path):
                for file in files:
                    fp = os.path.join(root, file)
                    try:
                        freed_before += os.path.getsize(fp)
                        f_count_before += 1
                    except Exception:
                        pass
        except Exception:
            pass

        # 2. Lightning-fast bulk directory purge & recreate
        try:
            shutil.rmtree(folder_path, ignore_errors=True)
            os.makedirs(folder_path, exist_ok=True)
        except Exception:
            pass

        # 3. Fallback for locked items (e.g., in %TEMP% folder)
        try:
            if os.path.exists(folder_path):
                for name in os.listdir(folder_path):
                    path = os.path.join(folder_path, name)
                    try:
                        if os.path.isdir(path):
                            shutil.rmtree(path, ignore_errors=True)
                        else:
                            os.remove(path)
                    except Exception:
                        try:
                            os.chmod(path, stat.S_IWRITE)
                            if os.path.isdir(path):
                                shutil.rmtree(path, ignore_errors=True)
                            else:
                                os.remove(path)
                        except Exception:
                            pass
        except Exception:
            pass

        # 4. Fast read-only metadata walk AFTER deletion
        freed_after = 0
        f_count_after = 0
        try:
            if os.path.exists(folder_path):
                for root, dirs, files in os.walk(folder_path):
                    for file in files:
                        fp = os.path.join(root, file)
                        try:
                            freed_after += os.path.getsize(fp)
                            f_count_after += 1
                        except Exception:
                            pass
        except Exception:
            pass

        actual_freed = max(0, freed_before - freed_after)
        actual_count = max(0, f_count_before - f_count_after)

        return actual_freed, actual_count, f_count_after

    files_skipped = 0

    if target == "recycle_bin":
        info = query_recycle_bin()
        bytes_freed = info.get("size_bytes", 0)
        files_deleted = info.get("items_count", 0)
        files_skipped = 0
        success = empty_recycle_bin(confirm=True)
        if not success:
            bytes_freed = 0
            files_deleted = 0
            
    elif target == "temp_files":
        temp_dirs = []
        for env in ["TEMP", "TMP"]:
            val = os.environ.get(env)
            if val and os.path.exists(val): temp_dirs.append(val)
        up = os.environ.get("USERPROFILE") or os.path.expanduser("~")
        if up and os.path.exists(up):
            up_temp = os.path.join(up, "AppData", "Local", "Temp")
            if os.path.exists(up_temp): temp_dirs.append(up_temp)
        sys_root = os.environ.get("SystemRoot", "C:\\Windows")
        for sub in ["Temp", "Prefetch", "SoftwareDistribution\\Download"]:
            sys_path = os.path.join(sys_root, sub)
            if os.path.exists(sys_path): temp_dirs.append(sys_path)
        if up and os.path.exists(up):
            for sub in ["AppData\\Local\\CrashDumps", "AppData\\Local\\Microsoft\\Windows\\INetCache"]:
                up_path = os.path.join(up, sub)
                if os.path.exists(up_path): temp_dirs.append(up_path)
                
        seen = set()
        temp_dirs = [x for x in temp_dirs if not (x in seen or seen.add(x))]
        
        for p in temp_dirs:
            bf, fc, fs = safe_delete_folder_contents(p)
            bytes_freed += bf
            files_deleted += fc
            files_skipped += fs
            
    elif target == "browser_caches":
        try:
            from browser import browser_cleaner
            caches = browser_cleaner.scan_all_browser_caches()
            for c in caches:
                bf, fc, fs = safe_delete_folder_contents(c["path"])
                bytes_freed += bf
                files_deleted += fc
                files_skipped += fs
        except Exception as e:
            logger.error("Failed to clean browser caches.", {"error": str(e)})

    # Re-trigger background thread to update cached stats after quick clean
    threading.Thread(target=update_cached_stats_thread, daemon=True).start()
    
    def format_size(bytes_count):
        import math
        if not bytes_count or bytes_count == 0: return "0 B"
        sizes = ["B", "KB", "MB", "GB"]
        i = int(math.floor(math.log(bytes_count) / math.log(1024)))
        return f"{round(bytes_count / math.pow(1024, i), 2)} {sizes[i]}"

    print(f"[Sidecar Clean] target: {target} -> status: completed | deleted: {files_deleted} | skipped: {files_skipped} | freed: {format_size(bytes_freed)}", file=sys.stderr)
    sys.stderr.flush()
    
    return {"status": "completed", "bytes_freed": bytes_freed, "files_deleted": files_deleted, "files_skipped": files_skipped}

@dispatcher.register("system.scan_empty_folders")
def handle_scan_empty_folders(params):
    import os
    empty_folders = []
    skip_dirs = {"Windows", "Program Files", "Program Files (x86)", "ProgramData", "AppData", "node_modules", ".git", "$Recycle.Bin", "System Volume Information", "Default", "Public", "TEMP", "Intel", "inetpub", "PerfLogs", "Common Files", "Default User", "All Users"}
    
    # Ultra-fast iterative scan using os.scandir
    stack = ["C:\\"]
    while stack:
        current_dir = stack.pop()
        try:
            with os.scandir(current_dir) as it:
                is_empty = True
                for entry in it:
                    is_empty = False
                    if entry.is_dir(follow_symlinks=False):
                        name = entry.name
                        if name not in skip_dirs and not name.startswith('.'):
                            stack.append(entry.path)
                
                if is_empty and current_dir != "C:\\":
                    # Only include folders we likely have permission to delete
                    if os.access(current_dir, os.W_OK):
                        # Final check to avoid hidden windows system sub-paths
                        if not any(x in current_dir.lower() for x in ['\\windows\\', '\\programdata\\', '\\default\\', '\\public\\', '\\intel\\', '\\inetpub\\']):
                            empty_folders.append(current_dir)
        except Exception:
            pass # Skip permission errors silently to maintain speed
            
    return {"empty_folders": empty_folders}

@dispatcher.register("system.delete_empty_folders")
def handle_delete_empty_folders(params):
    import os
    import concurrent.futures
    targets = params.get("targets", [])
    deleted = []
    failed = []
    
    def remove_dir(path):
        try:
            os.rmdir(path)
            return path, True
        except Exception:
            return path, False

    # Parallelize deletion for extreme speed
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        results = executor.map(remove_dir, targets)
        
    for path, success in results:
        if success:
            deleted.append(path)
        else:
            failed.append(path)
            
    return {"deleted": deleted, "failed": failed}

@dispatcher.register("system.scan_old_downloads")
def handle_scan_old_downloads(params):
    import os
    import time
    logger.info("[Old Downloads] Starting scan for abandoned downloads...")
    old_downloads = []
    user_profile = os.environ.get("USERPROFILE", "C:\\")
    downloads_path = os.path.join(user_profile, "Downloads")
    
    if not os.path.exists(downloads_path):
        return {"old_downloads": []}
        
    current_time = time.time()
    try:
        with os.scandir(downloads_path) as it:
            for entry in it:
                if entry.is_file(follow_symlinks=False):
                    stat = entry.stat()
                    age_days = int((current_time - stat.st_mtime) / (24*3600))
                    old_downloads.append({
                        "path": entry.path,
                        "name": entry.name,
                        "size": stat.st_size,
                        "age_days": max(0, age_days)
                    })
    except Exception as e:
        logger.error(f"Error scanning old downloads: {e}")
        
    return {"old_downloads": old_downloads}

@dispatcher.register("system.delete_old_downloads")
def handle_delete_old_downloads(params):
    import os
    import concurrent.futures
    targets = params.get("targets", [])
    deleted = []
    failed = []
    total_freed = 0
    
    def remove_file(path):
        try:
            size = os.path.getsize(path)
            os.remove(path)
            return path, True, size
        except Exception:
            return path, False, 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        results = executor.map(remove_file, targets)
        
    for path, success, size in results:
        if success:
            deleted.append(path)
            total_freed += size
        else:
            failed.append(path)
            
    return {"deleted": deleted, "failed": failed, "total_freed": total_freed}

from services_advisor import get_services_info, change_service_status

@dispatcher.register("system.get_services")
def handle_get_services(params):
    return {"services": get_services_info()}

@dispatcher.register("system.toggle_service")
def handle_toggle_service(params):
    name = params.get("name")
    action = params.get("action")
    return change_service_status(name, action)

from archive_manager import scan_archives, delete_archives

@dispatcher.register("system.scan_archives")
def handle_scan_archives(params):
    return {"archives": scan_archives()}

@dispatcher.register("system.delete_archives")
def handle_delete_archives(params):
    targets = params.get("targets", [])
    return delete_archives(targets)

@dispatcher.register("system.shutdown")
def handle_shutdown(params):
    logger.info("Received sidecar shutdown command. Ending process cleanly.")
    # Exit main loop safely
    sys.exit(0)

# --- LIGHTWEIGHT LOCAL HTTP API BACKEND FOR BROWSER RUNTIMES ---

class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

class LocalCleanerHTTPServer(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Prevent polluting standard output streams which Electron listens to!
        pass

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def write_response(self, data):
        try:
            self.wfile.write(json.dumps(data).encode())
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass
        except Exception:
            pass

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/api/"):
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_cors_headers()
            self.end_headers()
            
            endpoint = self.path[5:]
            try:
                if endpoint == "startup":
                    res = handle_startup({})
                    self.write_response(res)
                elif endpoint == "disk":
                    res = handle_disk_space({})
                    self.write_response(res)
                elif endpoint == "stats":
                    res = handle_dashboard_stats({})
                    self.write_response(res)
                elif endpoint == "recycle":
                    res = handle_recycle_query({})
                    self.write_response(res)
                elif endpoint.startswith("quick_clean"):
                    # Parse target from query params manually: /api/quick_clean?target=xyz
                    target = "temp_files"
                    if "target=" in endpoint:
                        target = endpoint.split("target=")[1].split("&")[0]
                    res = handle_quick_clean({"target": target})
                    self.write_response(res)
                elif endpoint == "browse":
                    try:
                        import tkinter as tk
                        from tkinter import filedialog
                        
                        def pick_folder():
                            root = tk.Tk()
                            root.withdraw()
                            root.attributes('-topmost', True)
                            path = filedialog.askdirectory(parent=root, title="Select Scan Directory")
                            root.destroy()
                            return path
                        
                        selected_path = pick_folder()
                        self.write_response({"path": selected_path})
                    except Exception as err:
                        self.write_response({"error": str(err)})
                elif endpoint.startswith("open"):
                    import urllib.parse
                    open_path = ""
                    if "path=" in endpoint:
                        encoded_path = endpoint.split("path=")[1].split("&")[0]
                        open_path = urllib.parse.unquote(encoded_path)
                    
                    if not open_path:
                        self.write_response({"error": "Missing path parameter"})
                    else:
                        try:
                            # Normalize path separators for Windows
                            if sys.platform == 'win32':
                                open_path = os.path.normpath(open_path)
                                os.startfile(open_path)
                            elif sys.platform == 'darwin':
                                import subprocess
                                subprocess.call(["open", open_path])
                            else:
                                import subprocess
                                subprocess.call(["xdg-open", open_path])
                            self.write_response({"success": True})
                        except Exception as open_err:
                            self.write_response({"error": str(open_err)})
                elif endpoint.startswith("scan"):
                    import urllib.parse
                    scan_path = ""
                    if "path=" in endpoint:
                        encoded_path = endpoint.split("path=")[1].split("&")[0]
                        scan_path = urllib.parse.unquote(encoded_path)
                    
                    if not scan_path:
                        self.write_response({"error": "Missing path parameter"})
                    else:
                        files_list = []
                        def accumulate_files(method, params):
                            if method == "scanner.progress":
                                files_list.extend(params.get("files", []))
                        
                        task = ScanningTask(scan_path, "balanced", rpc_notify_callback=accumulate_files)
                        res = task.execute()
                        res["files"] = files_list
                        self.write_response(res)
                elif endpoint == "empty_folders/scan":
                    res = handle_scan_empty_folders({})
                    self.write_response(res)
                elif endpoint == "old_downloads/scan":
                    res = handle_scan_old_downloads({})
                    self.write_response(res)
                elif endpoint == "services/get":
                    res = handle_get_services({})
                    self.write_response(res)
                elif endpoint == "archives/scan":
                    res = handle_scan_archives({})
                    self.write_response(res)
                else:
                    self.write_response({"error": "endpoint not found"})
            except Exception as e:
                self.write_response({"error": str(e)})
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path.startswith("/api/"):
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_cors_headers()
            self.end_headers()
            
            endpoint = self.path[5:]
            try:
                if endpoint == "delete":
                    targets = data.get("targets", [])
                    permanent = data.get("permanent", False)
                    scan_path = data.get("scan_path")
                    
                    session = DeletionSession(targets, permanent, scan_path=scan_path)
                    res = session.execute()
                    self.write_response(res)
                elif endpoint == "empty_folders/delete":
                    targets = data.get("targets", [])
                    res = handle_delete_empty_folders({"targets": targets})
                    self.write_response(res)
                elif endpoint == "old_downloads/delete":
                    targets = data.get("targets", [])
                    res = handle_delete_old_downloads({"targets": targets})
                    self.write_response(res)
                elif endpoint == "services/toggle":
                    name = data.get("name")
                    action = data.get("action")
                    res = handle_toggle_service({"name": name, "action": action})
                    self.write_response(res)
                elif endpoint == "archives/delete":
                    targets = data.get("targets", [])
                    res = handle_delete_archives({"targets": targets})
                    self.write_response(res)
                else:
                    self.write_response({"error": "endpoint not found"})
            except Exception as e:
                self.write_response({"error": str(e)})
        else:
            self.send_response(404)
            self.end_headers()

def run_http_server():
    try:
        server = ThreadingHTTPServer(("127.0.0.1", 9988), LocalCleanerHTTPServer)
        server.serve_forever()
    except Exception as e:
        logger.error("Failed to start background local HTTP server.", {"error": str(e)})

# --- MAIN LOOP SUBSYSTEM ---

def main():
    logger.info("AI Smart PC Cleaner sidecar initialized successfully.")
    
    # Spawn background HTTP API server to let standard browsers fetch real PC metrics
    threading.Thread(target=run_http_server, daemon=True).start()
    
    # Process commands from stdin sequentially
    try:
        for line in sys.stdin:
            if not line:
                continue
                
            # Handle the request
            response = dispatcher.handle_message(line)
            
            if response:
                sys.stdout.write(json.dumps(response) + "\n")
                sys.stdout.flush()
                
    except (KeyboardInterrupt, SystemExit):
        pass
    except Exception as fatal_e:
        logger.error("Sidecar stdin loop encountered a fatal exception.", {"error": str(fatal_e)})

if __name__ == "__main__":
    main()

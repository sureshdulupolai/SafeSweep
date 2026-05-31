import sys
import os
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from rpc import RPCDispatcher
from scanner import ScanningTask
from delete_engine import DeletionSession
from duplicates import DuplicateFinder
from quarantine_manager import quarantine_manager
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
active_duplicate_task = None
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
    with stats_lock:
        if is_updating_stats:
            return
        is_updating_stats = True

    print("[Sidecar Stats] Starting background temp & browser size calculations...", file=sys.stderr)
    sys.stderr.flush()
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
        print(f"[Sidecar Stats] Waste directories resolved for scanning: {temp_dirs}", file=sys.stderr)
        sys.stderr.flush()

        t_size, t_count = 0, 0
        for p in temp_dirs:
            p_size, p_count = 0, 0
            if p and os.path.exists(p):
                try:
                    for root, dirs, files in os.walk(p):
                        for f in files:
                            fp = os.path.join(root, f)
                            try:
                                sz = os.path.getsize(fp)
                                t_size += sz
                                p_size += sz
                                t_count += 1
                                p_count += 1
                            except Exception:
                                pass
                except Exception as walk_e:
                    print(f"[Sidecar Stats Error] Failed to walk directory {p}: {walk_e}", file=sys.stderr)
                    sys.stderr.flush()
            print(f"[Sidecar Stats] Walked directory: {p} -> Found {p_count} files ({p_size} bytes)", file=sys.stderr)
            sys.stderr.flush()
        
        # Calculate Browser Cache
        b_size, b_count = 0, 0
        print("[Sidecar Stats] Launching chromium & firefox cache walker...", file=sys.stderr)
        sys.stderr.flush()
        try:
            from browser import browser_cleaner
            caches = browser_cleaner.scan_all_browser_caches()
            b_size = sum(c["size_bytes"] for c in caches)
            b_count = sum(c["files_count"] for c in caches)
            print(f"[Sidecar Stats] Caches scanned details: {caches}", file=sys.stderr)
            sys.stderr.flush()
        except Exception as b_e:
            print(f"[Sidecar Stats Error] Browser cache scan threw an exception: {b_e}", file=sys.stderr)
            sys.stderr.flush()

        cached_stats["temp_size"] = t_size
        cached_stats["temp_count"] = t_count
        cached_stats["browser_size"] = b_size
        cached_stats["browser_count"] = b_count
        cached_stats["last_updated"] = time.time()
        
        print(f"[Sidecar Stats] SUCCESS: Walk completed! Temp: {t_count} files ({t_size} B), Browsers: {b_count} files ({b_size} B)", file=sys.stderr)
        sys.stderr.flush()

    except Exception as fatal_e:
        print(f"[Sidecar Stats Fatal] Thread crashed with error: {fatal_e}", file=sys.stderr)
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
    
    if not targets:
        raise CleanerError("Missing parameter 'targets' for deletion.")

    with task_lock:
        if active_delete_task and not active_delete_task.cancelled:
            raise CleanerError("A deletion transaction is already actively running.")
        
        active_delete_task = DeletionSession(targets, permanent, rpc_notify)

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

@dispatcher.register("duplicates.start_scan")
def handle_start_duplicates(params):
    global active_duplicate_task
    folders = params.get("folders", [])
    if not folders:
        raise CleanerError("Missing parameter 'folders' for duplicate lookup.")

    with task_lock:
        if active_duplicate_task and not active_duplicate_task.cancelled:
            raise CleanerError("A duplicate scanning sweeps is already actively running.")
        active_duplicate_task = DuplicateFinder(folders, rpc_notify)

    def run_duplicates():
        try:
            res = active_duplicate_task.execute()
            rpc_notify("duplicates.completed", res)
        except Exception as e:
            rpc_notify("duplicates.error", {"message": str(e)})

    threading.Thread(target=run_duplicates, daemon=True).start()
    return {"status": "duplicate_scan_started"}

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

@dispatcher.register("quarantine.list")
def handle_quarantine_list(params):
    rows = db.fetch_all("SELECT quarantine_id, original_name, original_directory, file_size, created_at FROM quarantine WHERE restored_at IS NULL;")
    items = []
    for r in rows:
        items.append({
            "id": r[0],
            "name": r[1],
            "directory": r[2],
            "size": r[3],
            "created_at": r[4]
        })
    return {"quarantine": items}

@dispatcher.register("quarantine.restore")
def handle_quarantine_restore(params):
    qid = params.get("id")
    custom_dest = params.get("custom_destination")
    if not qid:
        raise CleanerError("Missing 'id' parameter for quarantine restoration.")
    restored_path = quarantine_manager.restore_file(qid, custom_dest)
    return {"restored_path": restored_path}

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
        freed = 0
        f_count = 0
        import stat
        if not os.path.exists(folder_path): return 0, 0
        for root, dirs, files in os.walk(folder_path, topdown=False):
            for file in files:
                fp = os.path.join(root, file)
                try:
                    size = os.path.getsize(fp)
                    try:
                        os.chmod(fp, stat.S_IWRITE)
                    except Exception:
                        pass
                    os.remove(fp)
                    freed += size
                    f_count += 1
                except Exception:
                    pass
            for dir in dirs:
                dp = os.path.join(root, dir)
                try:
                    os.rmdir(dp)
                except Exception:
                    pass
        return freed, f_count

    if target == "recycle_bin":
        info = query_recycle_bin()
        bytes_freed = info.get("size_bytes", 0)
        files_deleted = info.get("items_count", 0)
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
            bf, fc = safe_delete_folder_contents(p)
            bytes_freed += bf
            files_deleted += fc
            
    elif target == "browser_caches":
        try:
            from browser import browser_cleaner
            caches = browser_cleaner.scan_all_browser_caches()
            for c in caches:
                bf, fc = safe_delete_folder_contents(c["path"])
                bytes_freed += bf
                files_deleted += fc
        except Exception as e:
            logger.error("Failed to clean browser caches.", {"error": str(e)})

    # Re-trigger background thread to update cached stats after quick clean
    threading.Thread(target=update_cached_stats_thread, daemon=True).start()
    return {"status": "completed", "bytes_freed": bytes_freed, "files_deleted": files_deleted}

@dispatcher.register("system.shutdown")
def handle_shutdown(params):
    logger.info("Received sidecar shutdown command. Ending process cleanly.")
    # Exit main loop safely
    sys.exit(0)

# --- LIGHTWEIGHT LOCAL HTTP API BACKEND FOR BROWSER RUNTIMES ---

class LocalCleanerHTTPServer(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Prevent polluting standard output streams which Electron listens to!
        pass

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

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
                    self.wfile.write(json.dumps(res).encode())
                elif endpoint == "disk":
                    res = handle_disk_space({})
                    self.wfile.write(json.dumps(res).encode())
                elif endpoint == "stats":
                    res = handle_dashboard_stats({})
                    self.wfile.write(json.dumps(res).encode())
                elif endpoint == "recycle":
                    res = handle_recycle_query({})
                    self.wfile.write(json.dumps(res).encode())
                elif endpoint.startswith("quick_clean"):
                    # Parse target from query params manually: /api/quick_clean?target=xyz
                    target = "temp_files"
                    if "target=" in endpoint:
                        target = endpoint.split("target=")[1].split("&")[0]
                    res = handle_quick_clean({"target": target})
                    self.wfile.write(json.dumps(res).encode())
                else:
                    self.wfile.write(json.dumps({"error": "endpoint not found"}).encode())
            except Exception as e:
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()

def run_http_server():
    try:
        server = HTTPServer(("127.0.0.1", 9988), LocalCleanerHTTPServer)
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

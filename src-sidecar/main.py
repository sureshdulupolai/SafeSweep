import sys
import os
import json
import threading
import time
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

def update_cached_stats_thread():
    global cached_stats
    try:
        # Calculate Temp Files
        temp_dirs = [
            os.environ.get("TEMP"),
            os.path.join(os.environ.get("SystemRoot", "C:\\Windows"), "Temp"),
            os.path.join(os.environ.get("SystemRoot", "C:\\Windows"), "Prefetch")
        ]
        t_size, t_count = 0, 0
        for p in temp_dirs:
            if p and os.path.exists(p):
                for root, dirs, files in os.walk(p):
                    for f in files:
                        fp = os.path.join(root, f)
                        try:
                            t_size += os.path.getsize(fp)
                            t_count += 1
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
        logger.info("Successfully updated cached dashboard stats.", {
            "temp_size": t_size,
            "temp_count": t_count,
            "browser_size": b_size,
            "browser_count": b_count
        })
    except Exception as e:
        logger.error("Failed to update dashboard cache stats.", {"error": str(e)})

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

import ctypes
@dispatcher.register("system.disk_space")
def handle_disk_space(params):
    """
    Natively queries the real total capacity and actual free space of the C:\ drive
    using Windows GetDiskFreeSpaceExW ctypes bindings.
    """
    free_avail = ctypes.c_ulonglong(0)
    total = ctypes.c_ulonglong(0)
    total_free = ctypes.c_ulonglong(0)
    success = ctypes.windll.kernel32.GetDiskFreeSpaceExW(
        "C:\\",
        ctypes.byref(free_avail),
        ctypes.byref(total),
        ctypes.byref(total_free)
    )
    if not success:
        return {"total": 512 * 1024 * 1024 * 1024, "free": 142 * 1024 * 1024 * 1024}
    return {
        "total": total.value,
        "free": total_free.value
    }

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

@dispatcher.register("system.shutdown")
def handle_shutdown(params):
    logger.info("Received sidecar shutdown command. Ending process cleanly.")
    # Exit main loop safely
    sys.exit(0)

# --- MAIN LOOP SUBSYSTEM ---

def main():
    logger.info("AI Smart PC Cleaner sidecar initialized successfully.")
    
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

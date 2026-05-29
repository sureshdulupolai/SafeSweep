import sys
import os
import json
import threading
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

# --- METHOD REGISTER BOUNDARIES ---

@dispatcher.register("system.startup")
def handle_startup(params):
    # Run startup integrity and transaction recoveries
    success = crash_recovery_manager.startup_integrity_check()
    
    # Load basic state values
    exclusions = list(exclusion_engine.custom_exclusions)
    
    return {
        "status": "online",
        "integrity_check": "passed" if success else "failed",
        "default_exclusions_loaded": len(exclusion_engine.default_exclusion_names),
        "custom_exclusions": exclusions
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
    return list(exclusion_engine.custom_exclusions)

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
    return items

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

import os
import concurrent.futures
import logging

logger = logging.getLogger(__name__)

ARCHIVE_EXTENSIONS = {'.zip', '.rar', '.7z', '.iso', '.tar', '.gz'}

import string
from ctypes import windll

def scan_archives():
    logger.info("[Archive Manager] Starting scan for heavy archives...")
    archives = []
    
    # Get all drives
    target_dirs = []
    try:
        bitmask = windll.kernel32.GetLogicalDrives()
        for letter in string.ascii_uppercase:
            if bitmask & 1:
                target_dirs.append(f"{letter}:\\")
            bitmask >>= 1
    except Exception:
        # Fallback to C: if windll fails
        target_dirs = ["C:\\"]
    
    SKIP_DIRS = {'windows', 'program files', 'program files (x86)', 'programdata', '$recycle.bin', 'system volume information', 'appdata', 'node_modules', '.git', 'pkg', '.cargo', 'go'}

    def scan_dir_recursive(path, local_archives):
        try:
            with os.scandir(path) as it:
                for entry in it:
                    try:
                        if entry.is_symlink():
                            continue
                        if entry.is_dir():
                            if entry.name.lower() not in SKIP_DIRS:
                                scan_dir_recursive(entry.path, local_archives)
                        elif entry.is_file():
                            ext = os.path.splitext(entry.name)[1].lower()
                            if ext in ARCHIVE_EXTENSIONS:
                                stat = entry.stat()
                                local_archives.append({
                                    "path": entry.path,
                                    "name": entry.name,
                                    "size": stat.st_size,
                                    "type": ext[1:].upper()
                                })
                    except Exception:
                        pass
        except Exception:
            pass

    import threading
    archives_lock = threading.Lock()
    
    def process_top_level(path):
        local_archives = []
        scan_dir_recursive(path, local_archives)
        if local_archives:
            with archives_lock:
                archives.extend(local_archives)

    top_level_dirs = []
    for d in target_dirs:
        try:
            with os.scandir(d) as it:
                for entry in it:
                    if entry.is_dir() and not entry.is_symlink():
                        if entry.name.lower() not in SKIP_DIRS:
                            top_level_dirs.append(entry.path)
                    elif entry.is_file():
                        ext = os.path.splitext(entry.name)[1].lower()
                        if ext in ARCHIVE_EXTENSIONS:
                            stat = entry.stat()
                            archives.append({
                                "path": entry.path,
                                "name": entry.name,
                                "size": stat.st_size,
                                "type": ext[1:].upper()
                            })
        except Exception:
            pass

    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as executor:
        executor.map(process_top_level, top_level_dirs)
            
    # Sort by size descending
    archives.sort(key=lambda x: x["size"], reverse=True)
    return archives

def delete_archives(targets):
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

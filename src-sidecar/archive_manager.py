import os
import concurrent.futures
import logging

logger = logging.getLogger(__name__)

ARCHIVE_EXTENSIONS = {'.zip', '.rar', '.7z', '.iso', '.tar', '.gz'}

def scan_archives():
    archives = []
    user_profile = os.environ.get("USERPROFILE", "C:\\")
    
    # Target specific user folders to avoid system/app files
    target_dirs = [
        os.path.join(user_profile, "Downloads"),
        os.path.join(user_profile, "Documents"),
        os.path.join(user_profile, "Desktop")
    ]
    
    def scan_dir_recursive(path):
        try:
            with os.scandir(path) as it:
                for entry in it:
                    try:
                        if entry.is_symlink():
                            continue
                        if entry.is_dir():
                            scan_dir_recursive(entry.path)
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
        except Exception:
            pass

    for d in target_dirs:
        if os.path.exists(d):
            scan_dir_recursive(d)
            
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

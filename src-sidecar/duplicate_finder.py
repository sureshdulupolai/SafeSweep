import os
import hashlib
import concurrent.futures
import threading
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)

# Only scan common user data folders to avoid deleting critical system files or program files
TARGET_FOLDERS = [
    os.path.join(os.environ['USERPROFILE'], "Downloads"),
    os.path.join(os.environ['USERPROFILE'], "Documents"),
    os.path.join(os.environ['USERPROFILE'], "Pictures"),
    os.path.join(os.environ['USERPROFILE'], "Videos"),
    os.path.join(os.environ['USERPROFILE'], "Music"),
    os.path.join(os.environ['USERPROFILE'], "Desktop")
]

def scan_duplicates(progress_callback=None):
    """
    Returns a list of duplicate file groups.
    Format: [
      { "hash": "...", "size": 1024, "files": [ {"path": "...", "name": "...", "modified": 123}, ... ] },
      ...
    ]
    """
    logger.info("[Duplicate Finder] Starting duplicate scan...")
    
    # Stage 1: Collect files by size
    size_dict = defaultdict(list)
    
    def scan_dir(root_dir):
        stack = [root_dir]
        local_files = []
        while stack:
            current_dir = stack.pop()
            try:
                with os.scandir(current_dir) as it:
                    for entry in it:
                        try:
                            if entry.is_symlink():
                                continue
                            if entry.is_dir():
                                stack.append(entry.path)
                            elif entry.is_file():
                                stat = entry.stat()
                                # Ignore files smaller than 10KB to avoid noise
                                if stat.st_size > 10240:
                                    local_files.append((entry.path, entry.name, stat.st_size, stat.st_mtime))
                        except Exception:
                            pass
            except Exception:
                pass
        return local_files

    if progress_callback: progress_callback("Scanning directories...", 10)
    
    all_files = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(scan_dir, d): d for d in TARGET_FOLDERS if os.path.exists(d)}
        for future in concurrent.futures.as_completed(futures):
            all_files.extend(future.result())
            
    for f in all_files:
        size_dict[f[2]].append(f)
        
    # Filter only sizes that have more than 1 file
    potential_dupes = [files for size, files in size_dict.items() if len(files) > 1]
    
    if progress_callback: progress_callback(f"Found {len(potential_dupes)} potential duplicate groups. Hashing...", 40)

    # Stage 2: Fast Hash (First 4KB)
    def fast_hash(filepath):
        try:
            hasher = hashlib.md5()
            with open(filepath, 'rb') as f:
                hasher.update(f.read(4096))
            return filepath, hasher.hexdigest()
        except Exception:
            return filepath, None

    fast_hash_groups = defaultdict(list)
    
    files_to_fast_hash = [f for group in potential_dupes for f in group]
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as executor:
        for filepath, h in executor.map(fast_hash, [f[0] for f in files_to_fast_hash]):
            if h is not None:
                # Find the original file tuple
                file_tuple = next(f for f in files_to_fast_hash if f[0] == filepath)
                fast_hash_groups[(file_tuple[2], h)].append(file_tuple)
                
    # Filter groups again
    potential_dupes_stage2 = [files for key, files in fast_hash_groups.items() if len(files) > 1]
    
    if progress_callback: progress_callback(f"Running deep hash on {len(potential_dupes_stage2)} groups...", 70)

    # Stage 3: Full SHA-256 Hash
    def full_hash(filepath):
        try:
            hasher = hashlib.sha256()
            with open(filepath, 'rb') as f:
                for chunk in iter(lambda: f.read(65536), b""):
                    hasher.update(chunk)
            return filepath, hasher.hexdigest()
        except Exception:
            return filepath, None
            
    files_to_full_hash = [f for group in potential_dupes_stage2 for f in group]
    final_groups = defaultdict(list)
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        for filepath, h in executor.map(full_hash, [f[0] for f in files_to_full_hash]):
            if h is not None:
                file_tuple = next(f for f in files_to_full_hash if f[0] == filepath)
                final_groups[h].append(file_tuple)
                
    result = []
    for h, files in final_groups.items():
        if len(files) > 1:
            result.append({
                "hash": h,
                "size": files[0][2],
                "files": [{"path": f[0], "name": f[1], "modified": f[3]} for f in files]
            })
            
    # Sort by size descending
    result.sort(key=lambda x: x["size"] * len(x["files"]), reverse=True)
    
    if progress_callback: progress_callback("Complete", 100)
    return result

def delete_duplicates(targets):
    deleted = []
    failed = []
    total_freed = 0
    
    for path in targets:
        try:
            size = os.path.getsize(path)
            os.remove(path)
            deleted.append(path)
            total_freed += size
        except Exception as e:
            failed.append({"path": path, "error": str(e)})
            
    return {"deleted": deleted, "failed": failed, "bytes_freed": total_freed}

import os
import hashlib
import threading
from collections import defaultdict
from safety import normalize_windows_path, is_reparse_point
from safety_middleware import middleware
from exclusion_engine import exclusion_engine
from error_classification import CleanerError
from utils.logger import logger

class DuplicateFinder:
    def __init__(self, target_folders, rpc_notify_callback=None):
        self.target_folders = [normalize_windows_path(f) for f in target_folders]
        self.rpc_notify_callback = rpc_notify_callback
        self.cancelled = False
        self.lock = threading.Lock()

    def cancel(self):
        self.cancelled = True

    def execute(self):
        """Runs the triple-pass hashing flow to locate duplicates safely."""
        logger.info("Initializing duplicate finder scan sweep.", {"targets": self.target_folders})
        
        # Pass 1: Build list of all files grouped by size
        size_groups = defaultdict(list)
        for folder in self.target_folders:
            if self.cancelled:
                break
            self._collect_file_sizes(folder, size_groups)

        if self.cancelled:
            return {"status": "cancelled", "duplicates": []}

        # Filter out unique sizes (only keep sizes with >= 2 files)
        candidate_groups = {size: paths for size, paths in size_groups.items() if len(paths) >= 2}
        
        # Pass 2 & 3: Group candidates dynamically by headers and full hashes
        duplicate_results = []
        
        total_candidates = sum(len(paths) for paths in candidate_groups.values())
        processed_candidates = 0

        for size, paths in candidate_groups.items():
            if self.cancelled:
                break

            # Pass 2: MD5 hash of first 8 KB
            header_groups = defaultdict(list)
            for path in paths:
                if self.cancelled:
                    break
                h_hash = self._get_header_hash(path)
                if h_hash:
                    header_groups[h_hash].append(path)
                processed_candidates += 1

            # Keep only groups with >= 2 matching headers
            matching_headers = {h: p for h, p in header_groups.items() if len(p) >= 2}

            # Pass 3: Full SHA-256 for matching size+header groups
            for h_hash, candidate_paths in matching_headers.items():
                if self.cancelled:
                    break

                full_hash_groups = defaultdict(list)
                for path in candidate_paths:
                    if self.cancelled:
                        break
                    f_hash = self._get_full_hash(path)
                    if f_hash:
                        full_hash_groups[f_hash].append(path)

                # Collect verified duplicates
                for f_hash, dup_paths in full_hash_groups.items():
                    if len(dup_paths) >= 2:
                        duplicate_results.append({
                            "sha256": f_hash,
                            "size": size,
                            "files": dup_paths
                        })

            # Stream progress updates periodically
            if self.rpc_notify_callback and processed_candidates % 100 == 0:
                self.rpc_notify_callback("duplicates.progress", {
                    "processed_count": processed_candidates,
                    "total_count": total_candidates
                })

        logger.info("Finished duplicate finder sweep.", {"duplicates_found_groups": len(duplicate_results)})
        return {
            "status": "completed",
            "duplicates": duplicate_results
        }

    def _collect_file_sizes(self, current_dir, size_groups):
        """Recursively walks directories and indexes file sizes."""
        if self.cancelled:
            return

        if exclusion_engine.is_excluded(current_dir):
            return

        try:
            with os.scandir(current_dir) as it:
                for entry in it:
                    if self.cancelled:
                        return

                    if entry.is_symlink() or is_reparse_point(entry.path):
                        continue

                    if entry.is_dir(follow_symlinks=False):
                        self._collect_file_sizes(entry.path, size_groups)
                    elif entry.is_file(follow_symlinks=False):
                        # Filter out critical system directories or system configurations
                        _, ext = os.path.splitext(entry.path)
                        if ext.lower() in {".sys", ".dll", ".efi", ".boot"}:
                            continue
                        
                        try:
                            size = entry.stat(follow_symlinks=False).st_size
                            if size > 0:  # Skip zero-byte files as duplicates
                                size_groups[size].append(entry.path)
                        except Exception:
                            pass
        except Exception:
            pass

    def _get_header_hash(self, file_path):
        """Computes MD5 hash of first 8 KB block to filter out unique matches rapidly."""
        try:
            with open(file_path, "rb") as f:
                header = f.read(8192)
                return hashlib.md5(header).hexdigest()
        except Exception:
            return None

    def _get_full_hash(self, file_path):
        """Computes sequential SHA-256 for verified size+header matches in 64 KB blocks."""
        try:
            sha256 = hashlib.sha256()
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(65536), b""):
                    if self.cancelled:
                        return None
                    sha256.update(chunk)
            return sha256.hexdigest()
        except Exception:
            return None

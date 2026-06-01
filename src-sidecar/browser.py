import os
import glob
from safety import normalize_windows_path
from utils.logger import logger

class BrowserCleaner:
    def __init__(self):
        self.local_appdata = self._resolve_local_appdata()
        self.appdata = self._resolve_appdata()

    def _resolve_local_appdata(self):
        val = os.environ.get("LOCALAPPDATA", "")
        if val and os.path.exists(val):
            return val
        val = os.path.expandvars(r"%USERPROFILE%\AppData\Local")
        if val and os.path.exists(val):
            return val
        up = os.environ.get("USERPROFILE") or os.path.expanduser("~")
        val = os.path.join(up, "AppData", "Local")
        if os.path.exists(val):
            return val
        try:
            users_dir = r"C:\Users"
            if os.path.exists(users_dir):
                for name in os.listdir(users_dir):
                    p = os.path.join(users_dir, name, "AppData", "Local")
                    if os.path.exists(p) and name.lower() not in ["public", "default", "all users"]:
                        return p
        except Exception:
            pass
        return ""

    def _resolve_appdata(self):
        val = os.environ.get("APPDATA", "")
        if val and os.path.exists(val):
            return val
        val = os.path.expandvars(r"%USERPROFILE%\AppData\Roaming")
        if val and os.path.exists(val):
            return val
        up = os.environ.get("USERPROFILE") or os.path.expanduser("~")
        val = os.path.join(up, "AppData", "Roaming")
        if os.path.exists(val):
            return val
        try:
            users_dir = r"C:\Users"
            if os.path.exists(users_dir):
                for name in os.listdir(users_dir):
                    p = os.path.join(users_dir, name, "AppData", "Roaming")
                    if os.path.exists(p) and name.lower() not in ["public", "default", "all users"]:
                        return p
        except Exception:
            pass
        return ""

    def get_chrome_cache_dirs(self):
        """Locates safe Google Chrome temp cache directories."""
        dirs = []
        if self.local_appdata:
            base_path = os.path.join(self.local_appdata, r"Google\Chrome\User Data")
            dirs.extend(self._find_chromium_caches(base_path))
        
        # Robust fallback: Search C:\Users for active chrome caches
        try:
            for entry in os.scandir(r"C:\Users"):
                if entry.is_dir() and entry.name.lower() not in ["public", "default", "all users"]:
                    base_path = os.path.join(entry.path, r"AppData\Local\Google\Chrome\User Data")
                    dirs.extend(self._find_chromium_caches(base_path))
        except Exception:
            pass
        return list(set(dirs))

    def get_edge_cache_dirs(self):
        """Locates safe Microsoft Edge temp cache directories."""
        dirs = []
        if self.local_appdata:
            base_path = os.path.join(self.local_appdata, r"Microsoft\Edge\User Data")
            dirs.extend(self._find_chromium_caches(base_path))
            
        # Robust fallback: Search C:\Users for active Edge caches
        try:
            for entry in os.scandir(r"C:\Users"):
                if entry.is_dir() and entry.name.lower() not in ["public", "default", "all users"]:
                    base_path = os.path.join(entry.path, r"AppData\Local\Microsoft\Edge\User Data")
                    dirs.extend(self._find_chromium_caches(base_path))
        except Exception:
            pass
        return list(set(dirs))

    def get_brave_cache_dirs(self):
        """Locates safe Brave Browser temp cache directories."""
        dirs = []
        if self.local_appdata:
            base_path = os.path.join(self.local_appdata, r"BraveSoftware\Brave-Browser\User Data")
            dirs.extend(self._find_chromium_caches(base_path))
            
        # Robust fallback: Search C:\Users for active Brave caches
        try:
            for entry in os.scandir(r"C:\Users"):
                if entry.is_dir() and entry.name.lower() not in ["public", "default", "all users"]:
                    base_path = os.path.join(entry.path, r"AppData\Local\BraveSoftware\Brave-Browser\User Data")
                    dirs.extend(self._find_chromium_caches(base_path))
        except Exception:
            pass
        return list(set(dirs))

    def get_firefox_cache_dirs(self):
        """Locates safe Mozilla Firefox cache directories."""
        dirs = []
        
        # Roaming profile check
        if self.local_appdata:
            firefox_local = os.path.join(self.local_appdata, r"Mozilla\Firefox\Profiles")
            if os.path.exists(firefox_local):
                dirs.extend(self._find_firefox_caches(firefox_local))
                
        # Robust fallback: Search C:\Users for active Firefox caches
        try:
            for entry in os.scandir(r"C:\Users"):
                if entry.is_dir() and entry.name.lower() not in ["public", "default", "all users"]:
                    firefox_local = os.path.join(entry.path, r"AppData\Local\Mozilla\Firefox\Profiles")
                    if os.path.exists(firefox_local):
                        dirs.extend(self._find_firefox_caches(firefox_local))
        except Exception:
            pass
            
        return list(set(dirs))

    def _find_firefox_caches(self, firefox_local):
        cache_dirs = []
        try:
            for entry in os.scandir(firefox_local):
                if entry.is_dir():
                    cache2 = os.path.join(entry.path, "cache2")
                    if os.path.exists(cache2):
                        cache_dirs.append(normalize_windows_path(cache2))
                    thumbnail = os.path.join(entry.path, "thumbnails")
                    if os.path.exists(thumbnail):
                        cache_dirs.append(normalize_windows_path(thumbnail))
        except Exception:
            pass
        return cache_dirs

    def _find_chromium_caches(self, user_data_path):
        """
        Walks a Chromium user profile path to isolate safe cache structures
        like Cache, GPUCache, and Code Cache, strictly shielding Login Data.
        """
        if not os.path.exists(user_data_path):
            return []
            
        caches = []
        search_patterns = [
            os.path.join(user_data_path, "Default"),
            os.path.join(user_data_path, "Profile *")
        ]
        
        for pattern in search_patterns:
            for profile_dir in glob.glob(pattern):
                if not os.path.isdir(profile_dir):
                    continue
                
                temp_subdirs = [
                    "Cache", "GPUCache", "Code Cache", 
                    "Service Worker/CacheStorage", "Service Worker/ScriptCache"
                ]
                
                for subdir in temp_subdirs:
                    target_path = os.path.join(profile_dir, subdir)
                    if os.path.exists(target_path):
                        caches.append(normalize_windows_path(target_path))
                        
        return caches

    def scan_all_browser_caches(self):
        """Aggregates all browser caches for UI reporting."""
        import sys
        all_dirs = []
        all_dirs.extend(self.get_chrome_cache_dirs())
        all_dirs.extend(self.get_edge_cache_dirs())
        all_dirs.extend(self.get_brave_cache_dirs())
        all_dirs.extend(self.get_firefox_cache_dirs())
        
        logger.info(f"Browser directories located for walking: {all_dirs}")
        
        results = []
        for directory in all_dirs:
            try:
                size = 0
                count = 0
                for root, dirs, files in os.walk(directory):
                    for file in files:
                        fp = os.path.join(root, file)
                        try:
                            size += os.path.getsize(fp)
                            count += 1
                        except Exception:
                            pass
                logger.info(f"Scanned: {directory} -> Found {count} files ({size} bytes)")
                if count > 0:
                    results.append({
                        "browser": self._detect_browser_name(directory),
                        "path": directory,
                        "files_count": count,
                        "size_bytes": size
                    })
            except Exception as e:
                logger.error(f"Failed scanning directory {directory}: {e}")
                
        return results

    def _detect_browser_name(self, path):
        low = path.lower()
        if "chrome" in low:
            return "Google Chrome"
        elif "edge" in low:
            return "Microsoft Edge"
        elif "brave" in low:
            return "Brave Browser"
        elif "mozilla" in low or "firefox" in low:
            return "Mozilla Firefox"
        return "Web Browser"

# Global browser cleaner instance
browser_cleaner = BrowserCleaner()


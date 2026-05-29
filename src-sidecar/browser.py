import os
import glob
from safety import normalize_windows_path
from utils.logger import logger

class BrowserCleaner:
    def __init__(self):
        self.local_appdata = os.environ.get("LOCALAPPDATA", "")
        self.appdata = os.environ.get("APPDATA", "")

    def get_chrome_cache_dirs(self):
        """Locates safe Google Chrome temp cache directories."""
        if not self.local_appdata:
            return []
        
        base_path = os.path.join(self.local_appdata, r"Google\Chrome\User Data")
        return self._find_chromium_caches(base_path)

    def get_edge_cache_dirs(self):
        """Locates safe Microsoft Edge temp cache directories."""
        if not self.local_appdata:
            return []
            
        base_path = os.path.join(self.local_appdata, r"Microsoft\Edge\User Data")
        return self._find_chromium_caches(base_path)

    def get_brave_cache_dirs(self):
        """Locates safe Brave Browser temp cache directories."""
        if not self.local_appdata:
            return []
            
        base_path = os.path.join(self.local_appdata, r"BraveSoftware\Brave-Browser\User Data")
        return self._find_chromium_caches(base_path)

    def get_firefox_cache_dirs(self):
        """Locates safe Mozilla Firefox cache directories."""
        if not self.local_appdata or not self.appdata:
            return []
            
        # Firefox cache is stored in Local AppData, profiles are in Roaming AppData
        firefox_local = os.path.join(self.local_appdata, r"Mozilla\Firefox\Profiles")
        if not os.path.exists(firefox_local):
            return []
            
        cache_dirs = []
        try:
            for entry in os.scandir(firefox_local):
                if entry.is_dir():
                    # Firefox cache2 directory inside profiles holds temporary files
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
        # Search profiles (Default, Profile 1, Profile 2, etc.)
        search_patterns = [
            os.path.join(user_data_path, "Default"),
            os.path.join(user_data_path, "Profile *")
        ]
        
        for pattern in search_patterns:
            for profile_dir in glob.glob(pattern):
                if not os.path.isdir(profile_dir):
                    continue
                
                # Pre-defined Chromium temporary cache folders
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
        all_dirs = []
        all_dirs.extend(self.get_chrome_cache_dirs())
        all_dirs.extend(self.get_edge_cache_dirs())
        all_dirs.extend(self.get_brave_cache_dirs())
        all_dirs.extend(self.get_firefox_cache_dirs())
        
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
                if count > 0:
                    results.append({
                        "browser": self._detect_browser_name(directory),
                        "path": directory,
                        "files_count": count,
                        "size_bytes": size
                    })
            except Exception:
                pass
                
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

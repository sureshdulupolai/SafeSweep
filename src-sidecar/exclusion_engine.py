import os
from utils.database import db
from utils.logger import logger
import safety

class ExclusionEngine:
    def __init__(self):
        self.default_exclusion_names = {
            # Development/Folder names
            "node_modules", ".git", ".venv", "venv", ".idea", ".vscode", 
            "__pycache__", ".docker", ".wsl", "docker-volumes",
            # VM & Database components
            "ext4.vhdx", ".vmdk", ".vdi", "app_config.json"
        }
        self.default_exclusion_roots = [
            # Steam / Games folders
            r"SteamLibrary",
            r"Epic Games",
            # Cloud sync metadata
            r".onedrive", r".dropbox", r".googledrive",
            # Active database paths
            r"Microsoft SQL Server", r"PostgreSQL", r"MySQL"
        ]
        self._load_custom_exclusions()

    def _load_custom_exclusions(self):
        """Loads custom user exclusions from the local WAL-enabled database."""
        self.custom_exclusions = set()
        try:
            rows = db.fetch_all("SELECT path FROM exclusions;")
            for row in rows:
                self.custom_exclusions.add(os.path.normpath(row[0]).lower())
        except Exception as e:
            logger.error("Failed to load custom exclusions from database.", {"error": str(e)})

    def add_custom_exclusion(self, path_str):
        """Persists a new path inside the exclusion database."""
        normalized = safety.normalize_windows_path(path_str)
        norm_low = os.path.normpath(normalized).lower()
        
        try:
            db.execute("INSERT OR IGNORE INTO exclusions (path) VALUES (?);", (normalized,))
            self.custom_exclusions.add(norm_low)
            logger.info("Successfully registered custom directory exclusion path.", {"path": normalized})
            return True
        except Exception as e:
            logger.error("Failed to add custom exclusion to database.", {"path": path_str, "error": str(e)})
            return False

    def remove_custom_exclusion(self, path_str):
        """Removes a registered path from the exclusion database."""
        normalized = safety.normalize_windows_path(path_str)
        norm_low = os.path.normpath(normalized).lower()
        
        try:
            db.execute("DELETE FROM exclusions WHERE path = ?;", (normalized,))
            if norm_low in self.custom_exclusions:
                self.custom_exclusions.remove(norm_low)
            logger.info("Successfully removed custom directory exclusion path.", {"path": normalized})
            return True
        except Exception as e:
            logger.error("Failed to remove custom exclusion from database.", {"path": path_str, "error": str(e)})
            return False

    def is_excluded(self, path_str):
        """
        Validates if a target path matches any standard or custom exclusion filters.
        Used to prevent high I/O latency, heavy RAM utilization, and damage to user configurations.
        """
        normalized = safety.normalize_windows_path(path_str)
        norm_low = os.path.normpath(normalized).lower()
        
        # 1. Check custom user exclusions first
        for exclusion_path in self.custom_exclusions:
            if norm_low == exclusion_path or norm_low.startswith(exclusion_path + os.sep):
                return True

        # 2. Check individual directory name elements (.git, node_modules, etc.)
        parts = norm_low.split(os.sep)
        for part in parts:
            if part in self.default_exclusion_names:
                return True

        # 3. Check for default system or library roots (Steam, cloud caches, DBs)
        for block_root in self.default_exclusion_roots:
            if os.path.normpath(block_root).lower() in norm_low:
                return True

        return False

# Global exclusion engine instance
exclusion_engine = ExclusionEngine()

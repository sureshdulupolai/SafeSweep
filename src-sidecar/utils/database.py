import os
import sqlite3
import shutil
import datetime
from utils.logger import logger
from error_classification import CleanerError

class DatabaseManager:
    def __init__(self, db_name="cleaner_settings.db", app_name="SafeSweep"):
        self.db_name = db_name
        self.app_name = app_name
        self.db_dir = self._initialize_db_dir()
        self.db_path = os.path.join(self.db_dir, self.db_name)
        self.conn = None
        self._connect_and_validate()

    def _initialize_db_dir(self):
        """Locates the secure local directory inside User AppData."""
        local_app_data = os.environ.get("LOCALAPPDATA")
        if local_app_data:
            base_dir = os.path.join(local_app_data, self.app_name)
        else:
            base_dir = os.path.join(os.path.expanduser("~"), f".{self.app_name.lower()}")
            
        db_dir = os.path.join(base_dir, "Database")
        os.makedirs(db_dir, exist_ok=True)
        return db_dir

    def _connect_and_validate(self):
        """Establishes connections, configures WAL mode, and validates file integrity."""
        db_existed = os.path.exists(self.db_path)
        
        try:
            # Perform a quick backup rotation of metadata on startup if DB exists
            if db_existed:
                self._rotate_backups()

            self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
            
            # Enable WAL mode for crash safety and locking improvements
            self.conn.execute("PRAGMA journal_mode=WAL;")
            self.conn.execute("PRAGMA synchronous=NORMAL;")
            
            # Run integrity checks
            cursor = self.conn.execute("PRAGMA integrity_check;")
            status = cursor.fetchone()[0]
            if status != "ok":
                raise sqlite3.DatabaseError(f"Integrity check failed: {status}")

            self._create_schema()
            
        except (sqlite3.DatabaseError, sqlite3.OperationalError) as e:
            logger.error("Database validation or integrity failure. Attempting corruption recovery...", {"error": str(e)})
            self._handle_corruption()

    def _rotate_backups(self):
        """Creates a rolling safety copy of the metadata store before active sessions start."""
        backup_path = self.db_path + ".bak"
        try:
            if os.path.exists(self.db_path):
                shutil.copy2(self.db_path, backup_path)
        except Exception as e:
            logger.warn("Failed to create pre-session database backup copy.", {"error": str(e)})

    def _handle_corruption(self):
        """Recovers from corruption by closing connections, restoring from backup, or recreating from scratch."""
        try:
            if self.conn:
                self.conn.close()
        except Exception:
            pass

        backup_path = self.db_path + ".bak"
        if os.path.exists(backup_path):
            try:
                logger.info("Restoring database structure from local backup file...")
                shutil.copy2(backup_path, self.db_path)
                self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
                self.conn.execute("PRAGMA journal_mode=WAL;")
                return
            except Exception as backup_err:
                logger.error("Failed to restore database from backup.", {"error": str(backup_err)})

        # Hard reset: Delete corrupted file and recreate empty instance
        try:
            logger.warn("Performing hard reset of settings database structure...")
            if os.path.exists(self.db_path):
                os.remove(self.db_path)
            # Remove associated WAL files as well
            for ext in [".db-wal", ".db-shm"]:
                wal_file = self.db_path + ext
                if os.path.exists(wal_file):
                    os.remove(wal_file)
            
            self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
            self.conn.execute("PRAGMA journal_mode=WAL;")
            self._create_schema()
        except Exception as reset_err:
            raise CleanerError(f"Fatal database initialization failure: {str(reset_err)}")

    def _create_schema(self):
        """Sets up tables for user settings, exclusions, anonymized histories, and quarantine logs."""
        with self.conn:
            # Table for settings KV
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                );
            """)
            
            # Table for custom exclusions (folders or files)
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS exclusions (
                    path TEXT PRIMARY KEY,
                    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # Table for Quarantine Metadata. Stores key parameters to locate
            # and restore files, WITHOUT indexing sensitive data contents.
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS quarantine (
                    quarantine_id TEXT PRIMARY KEY,
                    original_name TEXT,
                    original_directory TEXT,
                    file_size INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    restored_at TIMESTAMP,
                    sha256_hash TEXT
                );
            """)

            # Table for anonymized cleanup history logs
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS cleanup_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    mode TEXT,
                    files_count INTEGER,
                    bytes_reclaimed INTEGER,
                    status TEXT
                );
            """)

    def execute(self, query, params=()):
        """Helper to run non-yielding queries safely."""
        try:
            with self.conn:
                return self.conn.execute(query, params)
        except Exception as e:
            logger.error("Query execution error.", {"query": query, "error": str(e)})
            raise CleanerError(f"Database query failure: {str(e)}")

    def fetch_all(self, query, params=()):
        """Helper to yield result sets safely."""
        try:
            cursor = self.conn.execute(query, params)
            return cursor.fetchall()
        except Exception as e:
            logger.error("Query fetch error.", {"query": query, "error": str(e)})
            raise CleanerError(f"Database read failure: {str(e)}")

# Global DB manager instance
db = DatabaseManager()

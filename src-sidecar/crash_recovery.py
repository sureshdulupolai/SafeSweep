import os
import glob
import json
import datetime
from utils.database import db
from utils.logger import logger
from safety import normalize_windows_path
from error_classification import CleanerError

class CrashRecoveryManager:
    def __init__(self, app_name="AICleaner"):
        self.app_name = app_name
        self.recovery_dir = self._initialize_recovery_dir()
        self.journal_file_path = os.path.join(self.recovery_dir, "active_delete.journal")

    def _initialize_recovery_dir(self):
        """Locates the secure local directory inside User AppData."""
        local_app_data = os.environ.get("LOCALAPPDATA")
        if local_app_data:
            base_dir = os.path.join(local_app_data, self.app_name)
        else:
            base_dir = os.path.join(os.path.expanduser("~"), f".{self.app_name.lower()}")
            
        recovery_dir = os.path.join(base_dir, "Recovery")
        os.makedirs(recovery_dir, exist_ok=True)
        return recovery_dir

    def startup_integrity_check(self):
        """
        Executes diagnostic audits during startup to resolve interrupted sessions, 
        purge orphaned assets, and guarantee system stability.
        """
        logger.info("Initializing startup integrity and recovery verification.")
        
        try:
            self._recover_interrupted_transaction()
            self._purge_orphaned_quarantine_temp_files()
            logger.info("Startup integrity check completed successfully.")
            return True
        except Exception as e:
            logger.error("Error occurred during startup integrity check.", {"error": str(e)})
            return False

    def create_journal(self, targets_list, permanent=False):
        """Creates a crash-resilient session journal prior to active deletions."""
        journal_data = {
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "permanent": permanent,
            "targets": targets_list
        }
        
        try:
            with open(self.journal_file_path, "w", encoding="utf-8") as f:
                json.dump(journal_data, f)
            return True
        except Exception as e:
            logger.error("Failed to serialize transaction session journal.", {"error": str(e)})
            return False

    def remove_journal(self):
        """Deletes the session journal file after a transaction completes cleanly."""
        try:
            if os.path.exists(self.journal_file_path):
                os.remove(self.journal_file_path)
            return True
        except Exception as e:
            logger.error("Failed to clear session journal file.", {"error": str(e)})
            return False

    def _recover_interrupted_transaction(self):
        """
        Verifies if an active journal remains from a crashed or interrupted deletion run,
        and logs stats or reverts temporary states as needed.
        """
        if not os.path.exists(self.journal_file_path):
            return

        try:
            logger.warn("Interrupted deletion session detected on startup! Beginning safe recovery.")
            
            with open(self.journal_file_path, "r", encoding="utf-8") as f:
                journal_data = json.load(f)
                
            targets = journal_data.get("targets", [])
            permanent = journal_data.get("permanent", False)
            
            # Since the operation was interrupted mid-way, some files might still exist
            # others might be partially shredded. To ensure consistency, we record the 
            # interrupted run inside history as interrupted
            db.execute(
                """
                INSERT INTO cleanup_history (mode, files_count, bytes_reclaimed, status)
                VALUES (?, ?, ?, ?);
                """,
                ("PERMANENT" if permanent else "SAFE", len(targets), 0, "INTERRUPTED_RECOVERED")
            )
            
            # Remove the journal now to mark it resolved
            os.remove(self.journal_file_path)
            logger.info("Successfully recovered interrupted transaction journal.")
            
        except Exception as e:
            logger.error("Failed to parse or recover active journal state.", {"error": str(e)})

    def _purge_orphaned_quarantine_temp_files(self):
        """
        Cleans orphaned files in local quarantine caches that aren't indexed
        in the WAL database.
        """
        local_app_data = os.environ.get("LOCALAPPDATA")
        if not local_app_data:
            return
            
        quarantine_dir = os.path.join(local_app_data, self.app_name, "Quarantine")
        if not os.path.exists(quarantine_dir):
            return

        try:
            # Get list of registered quarantine IDs in DB
            rows = db.fetch_all("SELECT quarantine_id FROM quarantine;")
            registered_ids = {row[0] for row in rows}

            # Scan the physical directory for orphaned files
            for filename in os.listdir(quarantine_dir):
                # If a file is not in database, it's orphaned, so we wipe it
                if filename not in registered_ids:
                    orphan_path = os.path.join(quarantine_dir, filename)
                    try:
                        os.remove(orphan_path)
                        logger.info("Cleaned orphaned quarantine cache file on startup.", {"id": filename})
                    except Exception:
                        pass
        except Exception as e:
            logger.error("Failed to complete orphaned quarantine cleanup.", {"error": str(e)})

# Global crash recovery manager
crash_recovery_manager = CrashRecoveryManager()

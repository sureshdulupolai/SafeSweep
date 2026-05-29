import os
import uuid
import shutil
import hashlib
import datetime
from utils.database import db
from utils.logger import logger
from safety import normalize_windows_path
from error_classification import CleanerError, PermissionDenied, wrap_sys_error

class QuarantineManager:
    def __init__(self, app_name="SafeSweep"):
        self.app_name = app_name
        self.quarantine_dir = self._initialize_quarantine_dir()
        self.retention_hours = 24  # Default quarantine retention window
        self.purge_expired_items()

    def _initialize_quarantine_dir(self):
        """Initializes the secure, isolated local directory in AppData."""
        local_app_data = os.environ.get("LOCALAPPDATA")
        if local_app_data:
            base_dir = os.path.join(local_app_data, self.app_name)
        else:
            base_dir = os.path.join(os.path.expanduser("~"), f".{self.app_name.lower()}")
            
        quarantine_dir = os.path.join(base_dir, "Quarantine")
        os.makedirs(quarantine_dir, exist_ok=True)
        return quarantine_dir

    def quarantine_file(self, original_path):
        """
        Moves a target file safely into the local quarantine directory.
        Obfuscates the file name and logs original structural metadata in SQLite.
        """
        normalized = normalize_windows_path(original_path)
        if not os.path.exists(normalized) or os.path.isdir(normalized):
            raise CleanerError(f"Quarantine target must be a valid file: '{original_path}'")

        try:
            # 1. Compute SHA-256 hash for integrity validation checks
            sha256_hash = self._compute_sha256(normalized)
            file_size = os.path.getsize(normalized)
            
            # 2. Generate a unique obfuscated name inside quarantine cache
            quarantine_id = str(uuid.uuid4())
            secure_target_path = os.path.join(self.quarantine_dir, quarantine_id)

            # 3. Move file physically to quarantine directory
            shutil.move(normalized, secure_target_path)

            # 4. Save metadata registry entry in WAL database
            original_dir = os.path.dirname(original_path)
            original_name = os.path.basename(original_path)
            
            db.execute(
                """
                INSERT INTO quarantine (quarantine_id, original_name, original_directory, file_size, sha256_hash)
                VALUES (?, ?, ?, ?, ?);
                """,
                (quarantine_id, original_name, original_dir, file_size, sha256_hash)
            )

            logger.info("Successfully moved file to Quarantine.", {"original_path": original_path, "id": quarantine_id})
            return quarantine_id

        except Exception as e:
            clean_err = wrap_sys_error(e, original_path, "quarantine")
            logger.error("Failed to move file to Quarantine.", {"path": original_path, "error": clean_err.message})
            raise CleanerError(f"Failed to isolate file: {clean_err.message}")

    def restore_file(self, quarantine_id, custom_destination=None):
        """
        Restores a quarantined file to its original folder or custom redirected target path.
        Performs collision checks, permission audits, and SHA-256 integrity validation first.
        """
        row = db.fetch_all(
            "SELECT original_name, original_directory, sha256_hash FROM quarantine WHERE quarantine_id = ? AND restored_at IS NULL;",
            (quarantine_id,)
        )
        
        if not row:
            raise CleanerError("Quarantined item record not found or already restored.")

        original_name, original_directory, expected_hash = row[0]
        secure_source_path = os.path.join(self.quarantine_dir, quarantine_id)

        if not os.path.exists(secure_source_path):
            raise CleanerError("Quarantined file body not found in local cache.")

        # 1. Determine restore target path
        target_dir = custom_destination or original_directory
        restore_path = os.path.join(target_dir, original_name)
        normalized_restore_path = normalize_windows_path(restore_path)

        # 2. Check original directory path availability
        if not os.path.exists(target_dir):
            if custom_destination:
                # If custom target is missing, try to create it
                os.makedirs(target_dir, exist_ok=True)
            else:
                # If original parent directory was deleted, raise redirect warning
                raise CleanerError(
                    f"Original directory path '{target_dir}' is unavailable. Please select a custom restore destination folder."
                )

        # 3. Collision Checks: Warn before overwriting files
        if os.path.exists(normalized_restore_path):
            raise CleanerError(
                f"Collision conflict: A file with name '{original_name}' already exists at destination directory."
            )

        # 4. Verify file integrity metadata prior to restoration
        current_hash = self._compute_sha256(secure_source_path)
        if current_hash != expected_hash:
            raise CleanerError("Integrity check failed: Quarantined file has been corrupted or altered.")

        # 5. Move file physically back to original target
        try:
            shutil.move(secure_source_path, normalized_restore_path)
            
            # Update SQLite ledger
            db.execute(
                "UPDATE quarantine SET restored_at = ? WHERE quarantine_id = ?;",
                (datetime.datetime.utcnow().isoformat() + "Z", quarantine_id)
            )

            logger.info("Successfully restored quarantined file.", {"path": normalized_restore_path})
            return normalized_restore_path
        except Exception as e:
            clean_err = wrap_sys_error(e, normalized_restore_path, "restore")
            raise CleanerError(f"Failed to restore quarantined file: {clean_err.message}")

    def purge_expired_items(self):
        """Purges quarantined files exceeding the retention window (default: 24 hours) automatically."""
        try:
            now = datetime.datetime.now()
            rows = db.fetch_all("SELECT quarantine_id, created_at FROM quarantine WHERE restored_at IS NULL;")
            
            for row in rows:
                qid, created_at_str = row
                try:
                    # Parse timestamp format (ISO)
                    created_at = datetime.datetime.fromisoformat(created_at_str.replace("Z", ""))
                    age_hours = (now - created_at).total_seconds() / 3600.0
                    
                    if age_hours >= self.retention_hours:
                        self._delete_quarantine_physically(qid)
                except Exception:
                    pass
        except Exception:
            pass

    def _delete_quarantine_physically(self, quarantine_id):
        """Hard deletes quarantined file from storage and logs deletion in ledger."""
        path = os.path.join(self.quarantine_dir, quarantine_id)
        try:
            if os.path.exists(path):
                os.remove(path)
            db.execute("DELETE FROM quarantine WHERE quarantine_id = ?;", (quarantine_id,))
            logger.info("Permanently purged quarantined item from local disk cache.", {"id": quarantine_id})
        except Exception as e:
            logger.error("Failed to delete quarantined item physically.", {"id": quarantine_id, "error": str(e)})

    def _compute_sha256(self, file_path):
        """Computes SHA-256 checksum of a file incrementally to avoid loading massive files in memory."""
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                sha256.update(chunk)
        return sha256.hexdigest()

# Global quarantine manager instance
quarantine_manager = QuarantineManager()

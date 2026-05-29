import sys
import traceback

# Standardized Error Types
class CleanerError(Exception):
    """Base error for all AI Smart PC Cleaner sidecar exceptions."""
    def __init__(self, message, error_type="GenericError", data=None):
        super().__init__(message)
        self.message = message
        self.error_type = error_type
        self.data = data or {}

    def to_rpc_format(self, request_id=None):
        return {
            "jsonrpc": "2.0",
            "error": {
                "code": -32001,  # Custom server error code range
                "message": str(self.message),
                "data": {
                    "type": self.error_type,
                    "details": self.data
                }
            },
            "id": request_id
        }

class PermissionDenied(CleanerError):
    def __init__(self, message="Insufficient privileges to access this target path.", data=None):
        super().__init__(message, "PermissionDenied", data)

class FileLocked(CleanerError):
    def __init__(self, message="Target file is currently locked or in use by another active Windows process.", data=None):
        super().__init__(message, "FileLocked", data)

class PathTooLong(CleanerError):
    def __init__(self, message="Target file path exceeds Windows MAX_PATH limits. Requires extended \\\\?\\ normalization.", data=None):
        super().__init__(message, "PathTooLong", data)

class JunctionBlocked(CleanerError):
    def __init__(self, message="Recursive sweep intercepted an NTFS directory junction or reparse loop.", data=None):
        super().__init__(message, "JunctionBlocked", data)

class InvalidEncoding(CleanerError):
    def __init__(self, message="File name has invalid Unicode surrogates or unsupported filesystem encoding.", data=None):
        super().__init__(message, "InvalidEncoding", data)

class DiskUnavailable(CleanerError):
    def __init__(self, message="Target physical drive volume has been disconnected or is currently offline.", data=None):
        super().__init__(message, "DiskUnavailable", data)

class ReadOnlyFilesystem(CleanerError):
    def __init__(self, message="Target directory resides on a write-protected drive volume or optical media.", data=None):
        super().__init__(message, "ReadOnlyFilesystem", data)

class QuarantineFailure(CleanerError):
    def __init__(self, message="Failed to move target files to local quarantine directory due to storage limitations or file locks.", data=None):
        super().__init__(message, "QuarantineFailure", data)

class RollbackFailure(CleanerError):
    def __init__(self, message="Failed to safely roll back filesystem transaction structure from active journal logs.", data=None):
        super().__init__(message, "RollbackFailure", data)

class IntegrityValidationFailure(CleanerError):
    def __init__(self, message="Cryptographic or metadata hash mismatch detected on target files.", data=None):
        super().__init__(message, "IntegrityValidationFailure", data)


def wrap_sys_error(exception, path="", action=""):
    """
    Translates raw Python system errors into structured CleanerError exceptions,
    preventing arbitrary stack trace leaks to the user interface.
    """
    err_data = {"path": str(path), "action": str(action)}
    
    if isinstance(exception, PermissionError):
        return PermissionDenied(f"Permission denied: cannot perform '{action}' on '{path}'", err_data)
    elif isinstance(exception, FileNotFoundError):
        return CleanerError(f"Target not found: '{path}'", "FileNotFound", err_data)
    elif isinstance(exception, OSError):
        # Check specific Windows Error Codes if possible
        winerror = getattr(exception, "winerror", None)
        if winerror == 32:  # ERROR_SHARING_VIOLATION
            return FileLocked(f"File locked: '{path}' is in active use.", err_data)
        elif winerror == 206:  # ERROR_FILENAME_EXCED_RANGE
            return PathTooLong(f"Path exceeds character limits: '{path}'", err_data)
        
        # General OS errors
        return CleanerError(str(exception), "OSError", err_data)
    
    return CleanerError(str(exception), "GenericError", err_data)

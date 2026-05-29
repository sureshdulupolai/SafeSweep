import os
import sys
import ctypes
from error_classification import CleanerError

# Define windows API constants
FILE_ATTRIBUTE_REPARSE_POINT = 0x400
INVALID_FILE_ATTRIBUTES = -1

# Protected Folder Lists (case-insensitive checks on normalized paths)
PROTECTED_SYSTEM_ROOTS = [
    r"C:\Windows",
    r"C:\Windows\System32",
    r"C:\Boot",
    r"C:\EFI",
    r"C:\System Volume Information",
    r"C:\Recovery",
]

PROTECTED_PROGRAM_ROOTS = [
    r"C:\Program Files",
    r"C:\Program Files (x86)",
    r"C:\ProgramData\Microsoft",
    r"C:\ProgramData\Windows",
]

PROTECTED_USER_ROOTS = [
    r"AppData\Local\Microsoft\Windows",
    r"AppData\Roaming\Microsoft\Protect",
    r"AppData\Roaming\Microsoft\Signatures",
]

# Sensitive User Profiles to protect aggressively (must never auto-select)
PROTECTED_CRITICAL_USER_DATA = [
    r"\.ssh",
    r"\.gnupg",
    r"\.vscode",
    r"\.idea",
    r"Documents\My Games",
    r"AppData\Local\Google\Chrome\User Data",
    r"AppData\Local\Microsoft\Edge\User Data",
    r"AppData\Roaming\Mozilla\Firefox\Profiles",
    r"AppData\Roaming\Electrum",       # Crypto Wallet
    r"AppData\Roaming\MetaMask",       # Crypto Wallet
    r"\\wsl$",                         # WSL mounts
]

# Highly dangerous file extensions (Critical System Elements)
PROTECTED_EXTENSIONS = {
    ".sys", ".dll", ".ocx", ".inf", ".efi", ".boot", 
    ".msi", ".msp", ".reg", ".ps1", ".cmd", ".bat", 
    ".vhd", ".vhdx", ".lnk", ".url"
}

def normalize_windows_path(path_str):
    """
    Normalizes paths for Windows filesystem traversal.
    Translates relative routes to absolute structures. Prefixes 
    long paths with \\\\?\\ ONLY if the length exceeds 240 characters
    to bypass MAX_PATH limits without breaking standard os.scandir calls.
    """
    if not path_str:
        return ""
    
    # Remove surrounding quotes if user manually pasted
    path_str = path_str.strip('\'" ')
    
    # Convert to absolute path
    abs_path = os.path.abspath(path_str)
    
    # Only apply extended-length namespace prefix if path actually exceeds MAX_PATH limits.
    # Prepending \\?\ by default on short paths breaks os.scandir/os.walk in standard Python environments.
    if len(abs_path) > 240:
        if abs_path.startswith("\\\\"):
            # If it's a UNC share
            if not abs_path.startswith("\\\\?\\UNC\\") and not abs_path.startswith("\\\\?\\"):
                if abs_path.upper().startswith(r"\\WSL$"):
                    # Avoid prefixing WSL paths
                    return abs_path
                return "\\\\?\\UNC\\" + abs_path[2:]
        elif not abs_path.startswith("\\\\?\\"):
            return "\\\\?\\" + abs_path
        
    return abs_path

def is_reparse_point(path_str):
    """
    Checks if a target path is an NTFS directory junction, symbolic link, or mount
    using standard Windows GetFileAttributes ctypes bindings to prevent escape traversal.
    """
    # Normalize and strip \\?\ prefix if passing to ctypes on older kernels, 
    # but modern kernel accepts GetFileAttributesW with \\?\ cleanly.
    normalized = normalize_windows_path(path_str)
    
    # Ctypes API check
    attrs = ctypes.windll.kernel32.GetFileAttributesW(normalized)
    if attrs == INVALID_FILE_ATTRIBUTES:
        return False
        
    return bool(attrs & FILE_ATTRIBUTE_REPARSE_POINT)

def check_path_matches_list(path_str, patterns):
    """Checks if normalized path contains any pattern from target list (case-insensitive)."""
    norm_path = os.path.normpath(path_str).lower()
    for pattern in patterns:
        norm_pattern = os.path.normpath(pattern).lower()
        # Direct parent matching or substring checks
        if norm_pattern in norm_path:
            return True
    return False

def verify_safe_mode_needed(path_str):
    """
    Determines if a target folder or action matches a highly sensitive 
    system directory, which immediately forces the app into READ-ONLY SAFE MODE.
    """
    norm_path = os.path.normpath(path_str).lower()
    
    # Remove extended windows prefix for string matching
    if norm_path.startswith(r"\\?\unc\\"):
        match_str = norm_path[8:]
    elif norm_path.startswith(r"\\?\\"):
        match_str = norm_path[4:]
    else:
        match_str = norm_path
        
    # Check main system locations
    for system_root in PROTECTED_SYSTEM_ROOTS + PROTECTED_PROGRAM_ROOTS:
        norm_root = os.path.normpath(system_root).lower()
        if match_str.startswith(norm_root) or norm_root.startswith(match_str):
            return True

    # Check AppData critical sectors
    for app_root in PROTECTED_USER_ROOTS:
        if os.path.normpath(app_root).lower() in match_str:
            return True

    # Active mounts or cloud links check
    # OneDrive typically resides inside the user profile under "OneDrive"
    if "onedrive" in match_str or "googledrive" in match_str or "gdrive" in match_str:
        return True

    return False

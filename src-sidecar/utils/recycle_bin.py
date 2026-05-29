import ctypes
from ctypes import wintypes
from utils.logger import logger

class SHQUERYRBINFO(ctypes.Structure):
    _fields_ = [
        ("cbSize", wintypes.DWORD),
        ("i64Size", ctypes.c_int64),
        ("i64NumItems", ctypes.c_int64)
    ]

# Explicitly declare ctypes prototypes for 64-bit safe registry execution
try:
    ctypes.windll.shell32.SHQueryRecycleBinW.argtypes = [ctypes.c_wchar_p, ctypes.POINTER(SHQUERYRBINFO)]
    ctypes.windll.shell32.SHQueryRecycleBinW.restype = ctypes.c_long

    ctypes.windll.shell32.SHEmptyRecycleBinW.argtypes = [wintypes.HWND, ctypes.c_wchar_p, wintypes.DWORD]
    ctypes.windll.shell32.SHEmptyRecycleBinW.restype = ctypes.c_long
except Exception as e:
    logger.error("Failed to map Recycle Bin ctypes", {"error": str(e)})

def query_recycle_bin():
    """
    Natively queries the total file count and size (in bytes) of the active Windows
    Recycle Bin using native SHQueryRecycleBinW ctypes bindings.
    """
    info = SHQUERYRBINFO()
    info.cbSize = ctypes.sizeof(SHQUERYRBINFO)

    try:
        # Query the main system C drive explicitly
        # Passing None (or empty string) queries all drives' recycle bins.
        result = ctypes.windll.shell32.SHQueryRecycleBinW(None, ctypes.byref(info))
        if result != 0:
            logger.warn("Native SHQueryRecycleBinW query returned non-zero system flag.", {"result": result})
            return {"size_bytes": 0, "items_count": 0}
            
        return {
            "size_bytes": int(info.i64Size),
            "items_count": int(info.i64NumItems)
        }
    except Exception as e:
        logger.error("Failed to natively query Windows Recycle Bin.", {"error": str(e)})
        return {"size_bytes": 0, "items_count": 0}

def empty_recycle_bin(show_progress=False, confirm=False):
    """
    Natively purges the Windows Recycle Bin using SHEmptyRecycleBinW ctypes bindings.
    """
    SHERB_NOCONFIRMATION = 0x00000001
    SHERB_NOPROGRESSUI = 0x00000002
    SHERB_NOSOUND = 0x00000004

    flags = 0
    if not confirm:
        flags |= SHERB_NOCONFIRMATION
    if not show_progress:
        flags |= SHERB_NOPROGRESSUI
    flags |= SHERB_NOSOUND

    try:
        result = ctypes.windll.shell32.SHEmptyRecycleBinW(None, None, flags)
        if result != 0:
            logger.warn("Native SHEmptyRecycleBinW returned non-zero code.", {"result": result})
            return False
        return True
    except Exception as e:
        logger.error("Failed to natively empty Windows Recycle Bin.", {"error": str(e)})
        return False

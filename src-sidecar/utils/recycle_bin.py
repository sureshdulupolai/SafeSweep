import ctypes
from ctypes import wintypes
from utils.logger import logger

class SHQUERYRBINFO(ctypes.Structure):
    _fields_ = [
        ("cbSize", wintypes.DWORD),
        ("i64Size", ctypes.c_int64),
        ("i64NumItems", ctypes.c_int64)
    ]

def query_recycle_bin():
    """
    Natively queries the total file count and size (in bytes) of the active Windows
    Recycle Bin using native SHQueryRecycleBinW ctypes bindings.
    """
    info = SHQUERYRBINFO()
    info.cbSize = ctypes.sizeof(SHQUERYRBINFO)

    try:
        # SHQueryRecycleBinW can take None/NULL to query the default system recycle bin
        result = ctypes.windll.shell32.SHQueryRecycleBinW(None, ctypes.byref(info))
        if result != 0:
            logger.warn("Native SHQueryRecycleBinW query returned non-zero system flag.", {"result": result})
            return {"size_bytes": 0, "items_count": 0}
            
        return {
            "size_bytes": info.i64Size,
            "items_count": info.i64NumItems
        }
    except Exception as e:
        logger.error("Failed to natively query Windows Recycle Bin.", {"error": str(e)})
        return {"size_bytes": 0, "items_count": 0}

def empty_recycle_bin(show_progress=False, confirm=False):
    """
    Natively purges the Windows Recycle Bin using SHEmptyRecycleBinW ctypes bindings.
    
    Flags:
        SHERB_NOCONFIRMATION = 0x00000001
        SHERB_NOPROGRESSUI   = 0x00000002
        SHERB_NOSOUND        = 0x00000004
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
        # SHEmptyRecycleBinW(hwnd, pszRootPath, dwFlags)
        result = ctypes.windll.shell32.SHEmptyRecycleBinW(None, None, flags)
        if result != 0:
            # S_OK is 0. If it fails (e.g. user cancelled), returns HRESULT
            logger.warn("Native SHEmptyRecycleBinW returned non-zero code.", {"result": result})
            return False
        return True
    except Exception as e:
        logger.error("Failed to natively empty Windows Recycle Bin.", {"error": str(e)})
        return False

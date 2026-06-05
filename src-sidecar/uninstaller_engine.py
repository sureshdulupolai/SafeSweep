import winreg
import os
import glob
import subprocess
import logging
import urllib.request
import urllib.parse
import json

logger = logging.getLogger(__name__)

def get_installed_apps():
    """
    Fetches installed apps from the Windows Registry.
    """
    apps = []
    registry_paths = [
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
        (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall")
    ]
    
    for hkey, path in registry_paths:
        try:
            key = winreg.OpenKey(hkey, path)
            for i in range(0, winreg.QueryInfoKey(key)[0]):
                try:
                    subkey_name = winreg.EnumKey(key, i)
                    subkey = winreg.OpenKey(key, subkey_name)
                    
                    try:
                        display_name = winreg.QueryValueEx(subkey, "DisplayName")[0]
                    except OSError:
                        continue
                        
                    try:
                        uninstall_string = winreg.QueryValueEx(subkey, "UninstallString")[0]
                    except OSError:
                        continue
                        
                    try:
                        display_icon = winreg.QueryValueEx(subkey, "DisplayIcon")[0]
                    except OSError:
                        display_icon = ""
                        
                    try:
                        publisher = winreg.QueryValueEx(subkey, "Publisher")[0]
                    except OSError:
                        publisher = "Unknown"
                        
                    try:
                        estimated_size = winreg.QueryValueEx(subkey, "EstimatedSize")[0]
                    except OSError:
                        estimated_size = 0
                        
                    try:
                        system_component = winreg.QueryValueEx(subkey, "SystemComponent")[0]
                    except OSError:
                        system_component = 0
                        
                    if system_component == 1:
                        continue
                        
                    publisher_lower = publisher.lower()
                    name_lower = display_name.lower()
                    
                    # Safety: Hide critical system/hardware apps and PWAs
                    if "microsoft" in publisher_lower:
                        continue
                    if "google\\chrome" in publisher_lower or "google inc" in publisher_lower:
                        continue
                        
                    # Comprehensive blacklist for critical vendors (Hardware/Drivers)
                    critical_vendors = [
                        "intel", "amd", "advanced micro devices", "nvidia", 
                        "realtek", "qualcomm", "broadcom", "synaptics", 
                        "conexant", "dolby", "waves audio"
                    ]
                    if any(vendor in publisher_lower for vendor in critical_vendors):
                        continue
                        
                    # Comprehensive blacklist for critical system keywords
                    critical_keywords = [
                        "driver", "redistributable", "sdk", "update", "framework", 
                        "runtime", "webview2", "installer", "bootstrapper", "antivirus",
                        "security", "defender"
                    ]
                    if any(keyword in name_lower for keyword in critical_keywords):
                        continue
                            
                    if display_name and uninstall_string:
                        # Avoid duplicates
                        if not any(a['name'] == display_name for a in apps):
                            apps.append({
                                "id": subkey_name,
                                "name": display_name,
                                "publisher": publisher,
                                "uninstall_string": uninstall_string,
                                "estimated_size_kb": estimated_size,
                                "icon": display_icon
                            })
                except Exception as e:
                    pass
            winreg.CloseKey(key)
        except OSError:
            pass
            
    # Sort apps alphabetically
    apps.sort(key=lambda x: x["name"].lower())
    return apps

def uninstall_app(uninstall_string):
    """
    Attempts to run the uninstall string.
    """
    try:
        # Many uninstall strings have arguments, so we run via cmd
        # To make it silent, we could append /S or /quiet but it's risky if the uninstaller doesn't support it
        # We will just run the command normally and let the user interact with the uninstaller UI
        subprocess.Popen(uninstall_string, shell=True)
        return {"success": True, "message": "Uninstaller launched"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def clean_leftovers(app_name):
    """
    Searches for AppData and Registry keys containing the app_name and deletes them.
    This is a simplistic leftover cleaner.
    """
    logger.info(f"Scanning for leftovers for {app_name}")
    cleaned_paths = []
    cleaned_registry = []
    
    # Skip if app_name is too generic to avoid catastrophic deletions
    if not app_name or len(app_name) < 4:
        return {"status": "error", "error": "App name too short or generic for safe leftover cleaning."}
        
    safe_name = app_name.split()[0] if ' ' in app_name else app_name
    
    if len(safe_name) < 4:
         return {"status": "error", "error": "App name base too short for safe leftover cleaning."}
    
    # 1. Clean AppData
    appdata_paths = [
        os.path.join(os.environ.get('APPDATA', ''), safe_name),
        os.path.join(os.environ.get('LOCALAPPDATA', ''), safe_name),
        os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Programs', safe_name)
    ]
    
    import shutil
    for path in appdata_paths:
        if path and os.path.exists(path) and os.path.isdir(path):
            try:
                shutil.rmtree(path)
                cleaned_paths.append(path)
            except Exception:
                pass
                
    # 2. Clean Registry (HKCU\Software)
    try:
        hkcu_software = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"SOFTWARE", 0, winreg.KEY_ALL_ACCESS)
        for i in range(0, winreg.QueryInfoKey(hkcu_software)[0]):
            try:
                key_name = winreg.EnumKey(hkcu_software, i)
                if safe_name.lower() in key_name.lower():
                    # Delete the key
                    winreg.DeleteKey(hkcu_software, key_name)
                    cleaned_registry.append(rf"HKCU\SOFTWARE\{key_name}")
            except OSError:
                pass
        winreg.CloseKey(hkcu_software)
    except Exception:
        pass
        
    return {
        "status": "completed",
        "cleaned_paths": cleaned_paths,
        "cleaned_registry": cleaned_registry
    }

def research_app(app_name):
    """
    Attempts to fetch a summary of the app from Wikipedia using a two-step search approach.
    """
    import re
    try:
        # Aggressive cleanup of app names
        # 1. Remove anything in parentheses like "(x64)", "(64-bit)", "(Beta)"
        clean_name = re.sub(r'\(.*?\)', '', app_name)
        # 2. Split words and remove version-like strings or common suffixes
        words = clean_name.split()
        final_words = []
        for w in words:
            # Skip if it looks like a version (e.g., 21.0.8+9, v1.2, 2024.1)
            if re.match(r'^v?\d+[\.\d\+\-]*$', w, re.IGNORECASE):
                continue
            # Skip noise words
            if w.lower() in ['with', 'hotspot', 'for', 'windows', 'update', 'driver', 'software', 'edition']:
                continue
            final_words.append(w)
            
        if not final_words:
            final_words = [words[0] if words else app_name.split()[0]]
            
        search_query = ' '.join(final_words).strip()
        
        # Step 1: Use Wikipedia Search API to find the best matching page title
        safe_query = urllib.parse.quote(search_query + " software")
        search_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={safe_query}&utf8=&format=json&srlimit=1"
        search_req = urllib.request.Request(search_url, headers={'User-Agent': 'SafeSweep/1.0'})
        
        best_title = None
        with urllib.request.urlopen(search_req, timeout=5) as response:
            search_data = json.loads(response.read().decode('utf-8'))
            results = search_data.get('query', {}).get('search', [])
            if results:
                best_title = results[0]['title']
                
        # If the specific 'software' query fails, try without it
        if not best_title:
            safe_query_fallback = urllib.parse.quote(search_query)
            fallback_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={safe_query_fallback}&utf8=&format=json&srlimit=1"
            fallback_req = urllib.request.Request(fallback_url, headers={'User-Agent': 'SafeSweep/1.0'})
            with urllib.request.urlopen(fallback_req, timeout=5) as response:
                fallback_data = json.loads(response.read().decode('utf-8'))
                fallback_results = fallback_data.get('query', {}).get('search', [])
                if fallback_results:
                    best_title = fallback_results[0]['title']
                    
        # Step 2: Fetch the extract for the found title
        if best_title:
            safe_title = urllib.parse.quote(best_title)
            extract_url = f"https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&titles={safe_title}"
            extract_req = urllib.request.Request(extract_url, headers={'User-Agent': 'SafeSweep/1.0'})
            
            with urllib.request.urlopen(extract_req, timeout=5) as response:
                data = json.loads(response.read().decode('utf-8'))
                pages = data.get('query', {}).get('pages', {})
                page_id = list(pages.keys())[0]
                
                if str(page_id) != '-1':
                    extract = pages[page_id].get('extract', '').strip()
                    if extract:
                        # Return only the first 2-3 sentences to keep it concise
                        sentences = extract.split('. ')
                        short_desc = '. '.join(sentences[:3]) + ('.' if len(sentences) > 3 else '')
                        return {
                            "found": True, 
                            "description": short_desc,
                            "source": f"Wikipedia ({best_title})"
                        }
                        
        return {
            "found": False, 
            "description": f"Could not automatically fetch a summary for '{search_query}'. You can perform a direct Google Search to see if it's safe to remove."
        }
    except Exception as e:
        logger.error(f"Research failed: {e}")
        return {
            "found": False, 
            "description": "Network error while fetching research data. Please check your connection or search manually."
        }

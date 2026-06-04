import os
import time
import subprocess
import shutil
import threading
from utils.logger import logger

class DevScanningTask:
    def __init__(self, start_path, language, dev_targets, skip_dirs, custom_targets=None, rpc_notify_callback=None):
        self.start_path = start_path
        self.language = language
        self.dev_targets = dev_targets
        self.skip_dirs = skip_dirs
        self.custom_targets = set(custom_targets) if custom_targets else set()
        self.rpc_notify_callback = rpc_notify_callback
        self.cancel_event = threading.Event()
        self.found_caches = []
        self.batch = []

    def get_folder_size(self, path):
        total_size = 0
        try:
            for dirpath, dirnames, filenames in os.walk(path):
                if self.cancel_event.is_set():
                    return total_size
                for f in filenames:
                    fp = os.path.join(dirpath, f)
                    if not os.path.islink(fp):
                        total_size += os.path.getsize(fp)
        except Exception:
            pass
        return total_size

    def _flush(self):
        if self.batch and self.rpc_notify_callback:
            self.rpc_notify_callback("dev_scanner.progress", {"caches": self.batch})
            self.found_caches.extend(self.batch)
            self.batch = []

    def execute(self):
        lang_targets = {
            "python": {"venv", ".env", "virtualenv", "anaconda3", "miniconda3", "__pycache__", ".pytest_cache", ".mypy_cache", "ruff_cache", "*.pyc"},
            "node": {"node_modules", "npm-cache", "yarn-cache", "pnpm-store"},
            "java": {".gradle", ".m2", "target"},
            "rust": {"cargo", "target"}
        }
        
        active_targets = self.dev_targets.copy()
        if self.language in lang_targets:
            active_targets = lang_targets[self.language].copy()
            
        active_targets.update(self.custom_targets)

        try:
            last_emit_time = 0
            for root, dirs, files in os.walk(self.start_path):
                if self.cancel_event.is_set():
                    break
                    
                current_time = time.time()
                if current_time - last_emit_time > 0.1 and self.rpc_notify_callback:
                    self.rpc_notify_callback("dev_scanner.current_path", {"path": root})
                    last_emit_time = current_time

                dirs[:] = [d for d in dirs if d not in self.skip_dirs]
                
                for d in list(dirs):
                    if d in active_targets:
                        full_path = os.path.join(root, d)
                        dirs.remove(d)
                        
                        is_python_env = False
                        if d in ["venv", ".env", "virtualenv", "anaconda3", "miniconda3"]:
                            if os.path.exists(os.path.join(full_path, "Scripts", "python.exe")):
                                is_python_env = True
                                
                        size = self.get_folder_size(full_path)
                        item = {
                            "id": full_path,
                            "name": d,
                            "path": full_path,
                            "size": size,
                            "is_python_env": is_python_env
                        }
                        self.batch.append(item)
                        
                        if len(self.batch) >= 5:
                            self._flush()
        except Exception as e:
            logger.error("Scan error", {"error": str(e)})
            
        self._flush()
        return {"success": True, "caches": self.found_caches}

class DevCleanerService:
    def __init__(self, dispatcher, rpc_notify_callback=None):
        self.dispatcher = dispatcher
        self.rpc_notify_callback = rpc_notify_callback
        
        # Register handlers
        self.dispatcher.methods["dev.scan"] = self.handle_scan
        self.dispatcher.methods["dev.analyze_envs"] = self.handle_analyze_envs
        self.dispatcher.methods["dev.create_env"] = self.handle_create_env
        self.dispatcher.methods["dev.delete_envs"] = self.handle_delete_envs

        self.DEV_TARGETS = {
            "node_modules", "venv", ".env", "virtualenv", "__pycache__", 
            "dist", "build", "target", "vendor", ".gradle", ".m2", 
            "cargo", "npm-cache", "pnpm-store", "yarn-cache", 
            "anaconda3", "miniconda3", ".pytest_cache", ".mypy_cache", 
            "ruff_cache", "logs", "refs"  # For git logs/refs
        }
        self.SKIP_DIRS = {"AppData", "Windows", "Program Files", "Program Files (x86)"}

    def get_folder_size(self, path):
        total_size = 0
        try:
            for dirpath, _, filenames in os.walk(path):
                for f in filenames:
                    fp = os.path.join(dirpath, f)
                    if not os.path.islink(fp):
                        total_size += os.path.getsize(fp)
        except Exception:
            pass
        return total_size

    def handle_scan(self, params):
        start_path = params.get("path")
        language = params.get("language", "all")
        sync_mode = params.get("sync", False)
        custom_targets = params.get("custom_targets", [])
        
        if not start_path or start_path == "C:\\":
            start_path = os.path.expanduser("~")
            
        if sync_mode:
            all_caches = []
            def aggregate_caches(method, params):
                if method == "dev_scanner.progress":
                    all_caches.extend(params.get("caches", []))
            
            task = DevScanningTask(
                start_path, 
                language, 
                self.DEV_TARGETS, 
                self.SKIP_DIRS, 
                custom_targets,
                aggregate_caches
            )
            try:
                res = task.execute()
                res["caches"] = all_caches
                return res
            except Exception as e:
                logger.error("Sync DevScan crashed.", {"error": str(e)})
                return {"success": False, "error": str(e), "caches": []}
                
        task = DevScanningTask(
            start_path, 
            language, 
            self.DEV_TARGETS, 
            self.SKIP_DIRS, 
            custom_targets,
            self.rpc_notify_callback
        )
        def run_scan():
            try:
                res = task.execute()
                if self.rpc_notify_callback:
                    self.rpc_notify_callback("dev_scanner.completed", res)
            except Exception as e:
                logger.error("DevScan crashed.", {"error": str(e)})
                if self.rpc_notify_callback:
                    self.rpc_notify_callback("dev_scanner.error", {"message": str(e)})

        threading.Thread(target=run_scan, daemon=True).start()
        return {"status": "scan_started", "path": start_path}

    def handle_analyze_envs(self, params):
        env_paths = params.get("env_paths", [])
        master_list = {} # format: { package_name: { version: set(paths) } }
        
        for path in env_paths:
            # Fast parse site-packages
            site_packages = os.path.join(path, "Lib", "site-packages")
            if not os.path.exists(site_packages):
                # Try unix-style for compatibility if running in WSL or something
                lib_path = os.path.join(path, "lib")
                if os.path.exists(lib_path):
                    try:
                        for item in os.listdir(lib_path):
                            if item.startswith("python"):
                                site_packages = os.path.join(lib_path, item, "site-packages")
                                break
                    except:
                        pass
                        
            if os.path.exists(site_packages):
                try:
                    for item in os.listdir(site_packages):
                        if item.endswith(".dist-info"):
                            # item format: Django-4.2.0.dist-info
                            parts = item[:-10].split("-")
                            if len(parts) >= 2:
                                # version is usually the last part
                                ver = parts[-1]
                                pkg = "-".join(parts[:-1]).lower()
                                
                                if pkg not in master_list:
                                    master_list[pkg] = {}
                                if ver not in master_list[pkg]:
                                    master_list[pkg][ver] = set()
                                master_list[pkg][ver].add(path)
                except Exception as e:
                    logger.error(f"Failed to read site-packages in {path}", {"error": str(e)})
                    
        # Convert sets to lists for JSON serialization
        final_list = []
        for pkg, versions_map in master_list.items():
            versions_list = list(versions_map.keys())
            versions_list.sort()
            
            occurrences = []
            for v, paths in versions_map.items():
                for p in paths:
                    occurrences.append({"version": v, "path": p})
                    
            final_list.append({
                "name": pkg,
                "versions": versions_list,
                "selected_version": versions_list[-1] if versions_list else "",
                "occurrences": occurrences
            })
            
        return {"success": True, "master_list": final_list}

    def handle_create_env(self, params):
        target_dir = params.get("target_dir")
        packages = params.get("packages", []) # [{"name": "django", "version": "4.2"}]
        
        if not target_dir:
            return {"success": False, "error": "No target directory specified"}
            
        try:
            os.makedirs(target_dir, exist_ok=True)
            
            # Create venv
            subprocess.check_call(["python", "-m", "venv", "."], cwd=target_dir)
            
            # Prepare requirements
            pip_path = os.path.join(target_dir, "Scripts", "pip.exe")
            reqs = []
            for p in packages:
                if p.get("version"):
                    reqs.append(f"{p['name']}=={p['version']}")
                else:
                    reqs.append(p['name'])
                    
            if not reqs:
                return {"success": True, "message": "Environment created. No packages to install.", "failed": []}
                
            # Install packages
            failed = []
            for req in reqs:
                try:
                    subprocess.check_call([pip_path, "install", req], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                except subprocess.CalledProcessError:
                    failed.append(req)
                    
            return {
                "success": True, 
                "message": "Environment successfully built.",
                "failed": failed
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def handle_delete_envs(self, params):
        env_paths = params.get("env_paths", [])
        results = []
        
        for path in env_paths:
            try:
                # Fast bottom-up delete
                for root, dirs, files in os.walk(path, topdown=False):
                    for name in files:
                        try: os.remove(os.path.join(root, name))
                        except Exception: pass
                    for name in dirs:
                        try: os.rmdir(os.path.join(root, name))
                        except Exception: pass
                
                try: os.rmdir(path)
                except Exception: pass
                
                results.append({"path": path, "deleted": not os.path.exists(path)})
            except Exception as e:
                results.append({"path": path, "deleted": False, "error": str(e)})
                
        return {"success": True, "results": results}

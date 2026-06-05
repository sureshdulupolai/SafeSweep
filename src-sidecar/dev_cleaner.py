import os
import time
import subprocess
import shutil
import threading
import concurrent.futures
from utils.logger import logger
import queue
import sys

class DevScanningTask:
    def __init__(self, start_paths, language, dev_targets, skip_dirs, custom_targets=None, rpc_notify_callback=None):
        self.start_paths = start_paths if isinstance(start_paths, list) else [start_paths]
        self.language = language
        self.dev_targets = dev_targets
        self.skip_dirs = skip_dirs
        self.custom_targets = custom_targets or []
        self.rpc_notify_callback = rpc_notify_callback
        self.cancel_event = threading.Event()
        self.found_caches = []
        self.batch = []
        self._lock = threading.RLock()
        
    def _flush(self):
        with self._lock:
            if not self.batch:
                return
            if self.rpc_notify_callback:
                self.rpc_notify_callback("dev_scanner.progress", {"caches": self.batch})
            self.found_caches.extend(self.batch)
            self.batch = []

    def get_folder_size(self, path):
        total_size = 0
        try:
            for dirpath, _, filenames in os.walk(path):
                if self.cancel_event.is_set():
                    break
                for f in filenames:
                    fp = os.path.join(dirpath, f)
                    if not os.path.islink(fp):
                        total_size += os.path.getsize(fp)
        except Exception:
            pass
        return total_size

    def execute(self):
        logger.info(f"Starting true parallel DevScan on {len(self.start_paths)} paths")
        sys.stderr.write(f"[{time.strftime('%H:%M:%S')}] Starting true parallel DevScan on {self.start_paths}\n")
        sys.stderr.flush()
        
        active_targets = set()
        if self.language == 'python':
            active_targets = {"venv", "env", ".env", "virtualenv", "anaconda3", "miniconda3"}
        elif self.language == 'node':
            active_targets = {"node_modules"}
        elif self.language == 'java':
            active_targets = {".gradle", ".m2", "target"}
        elif self.language == 'rust':
            active_targets = {"target"}
        else:
            active_targets = self.dev_targets.copy()
            
        for ct in self.custom_targets:
            active_targets.add(ct)

        path_queue = queue.Queue()
        for p in self.start_paths:
            if os.path.exists(p):
                path_queue.put(p)
        
        # We will use ThreadPoolExecutor for calculating folder sizes in parallel,
        # so it doesn't block the fast filesystem traversal.
        size_executor = concurrent.futures.ThreadPoolExecutor(max_workers=16)
        active_workers = 0
        workers_lock = threading.Lock()
        
        last_log_time = time.time()
        
        def process_target(full_path, folder_name, is_python_env):
            # Calculate size in this worker thread
            size = self.get_folder_size(full_path)
            if self.cancel_event.is_set():
                return
                
            item = {
                "id": full_path,
                "name": folder_name,
                "path": full_path,
                "size": size,
                "is_python_env": is_python_env
            }
            with self._lock:
                self.batch.append(item)
                if len(self.batch) >= 5:
                    self._flush()

        def scan_worker():
            nonlocal active_workers, last_log_time
            while not self.cancel_event.is_set():
                try:
                    path = path_queue.get(timeout=0.1)
                except queue.Empty:
                    with workers_lock:
                        if active_workers == 0:
                            break  # Queue empty and no one is working, we are done
                    continue
                
                with workers_lock:
                    active_workers += 1

                try:
                    current_time = time.time()
                    if current_time - last_log_time > 1.0:
                        last_log_time = current_time
                        sys.stderr.write(f"[{time.strftime('%H:%M:%S')}] Scanning -> {path}\n")
                        sys.stderr.flush()
                        if self.rpc_notify_callback:
                            self.rpc_notify_callback("dev_scanner.current_path", {"path": path})

                    # Fast scandir
                    with os.scandir(path) as it:
                        for entry in it:
                            if self.cancel_event.is_set():
                                break
                            if entry.is_dir(follow_symlinks=False):
                                if entry.name in self.skip_dirs:
                                    continue
                                    
                                if entry.name in active_targets:
                                    full_path = entry.path
                                    is_python_env = False
                                    is_valid = True
                                    
                                    # If language is 'all', determine the context based on the folder name
                                    check_lang = self.language
                                    if check_lang == 'all':
                                        if entry.name in ["venv", "env", ".env", "virtualenv", "anaconda3", "miniconda3"]:
                                            check_lang = 'python'
                                        elif entry.name == 'node_modules':
                                            check_lang = 'node'
                                        elif entry.name == 'target':
                                            check_lang = 'rust'
                                        elif entry.name in [".gradle", ".m2"]:
                                            check_lang = 'java'
                                    
                                    if check_lang == 'python':
                                        is_valid = False
                                        # Strict check for Python environments
                                        if os.path.exists(os.path.join(full_path, "pyvenv.cfg")) or \
                                           os.path.exists(os.path.join(full_path, "Scripts", "python.exe")) or \
                                           os.path.exists(os.path.join(full_path, "bin", "python")):
                                            is_valid = True
                                            is_python_env = True
                                            
                                    elif check_lang == 'node':
                                        if entry.name == 'node_modules':
                                            is_valid = False
                                            # Strict check for Node.js environments
                                            parent_dir = os.path.dirname(full_path)
                                            if os.path.exists(os.path.join(parent_dir, "package.json")):
                                                is_valid = True
                                                
                                    elif check_lang == 'rust':
                                        if entry.name == 'target':
                                            is_valid = False
                                            # Strict check for Rust environments
                                            parent_dir = os.path.dirname(full_path)
                                            if os.path.exists(os.path.join(parent_dir, "Cargo.toml")):
                                                is_valid = True
                                                
                                    elif check_lang == 'java':
                                        if entry.name in ['.gradle', '.m2']:
                                            # Usually global caches, just accept them or check if it's really a java cache
                                            pass
                                        elif entry.name == 'target':
                                            is_valid = False
                                            parent_dir = os.path.dirname(full_path)
                                            if os.path.exists(os.path.join(parent_dir, "pom.xml")):
                                                is_valid = True

                                    if is_valid:
                                        # Submit size calculation to executor to avoid blocking traversal
                                        size_executor.submit(process_target, full_path, entry.name, is_python_env)
                                        # DO NOT add valid environments to the path_queue, this prevents listing sub-caches
                                        # inside an environment, and stops redundant scanning.
                                    else:
                                        # If it matched the name but isn't valid, keep traversing!
                                        path_queue.put(entry.path)
                                else:
                                    # Regular folder, add to queue for traversal
                                    path_queue.put(entry.path)
                except Exception:
                    # Ignore permission errors, etc.
                    pass
                finally:
                    path_queue.task_done()
                    with workers_lock:
                        active_workers -= 1

        try:
            # Launch multiple fast traversal workers
            num_traversal_workers = 16
            threads = []
            for _ in range(num_traversal_workers):
                t = threading.Thread(target=scan_worker, daemon=True)
                t.start()
                threads.append(t)
                
            for t in threads:
                t.join()
                
            # Wait for size calculations to finish
            sys.stderr.write(f"[{time.strftime('%H:%M:%S')}] Filesystem traversal complete. Waiting for size calculations...\n")
            sys.stderr.flush()
            size_executor.shutdown(wait=True)
            
            sys.stderr.write(f"[{time.strftime('%H:%M:%S')}] Scan fully completed!\n")
            sys.stderr.flush()

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
        self.dispatcher.methods["dev.cancel_scan"] = self.handle_cancel_scan
        self.dispatcher.methods["dev.analyze_envs"] = self.handle_analyze_envs
        self.dispatcher.methods["dev.create_env"] = self.handle_create_env
        self.dispatcher.methods["dev.delete_envs"] = self.handle_delete_envs
        self.dispatcher.methods["dev.cancel_delete_envs"] = self.handle_cancel_delete_envs
        
        self.active_scanner = None
        self.cancel_delete_event = threading.Event()

        self.DEV_TARGETS = {
            "node_modules", "venv", "env", ".env", "virtualenv", 
            "target", ".gradle", ".m2", 
            "anaconda3", "miniconda3"
        }
        self.SKIP_DIRS = {"Windows", "Program Files", "Program Files (x86)", "$Recycle.Bin", "System Volume Information"}

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

    def handle_cancel_scan(self, params):
        if hasattr(self, 'active_task') and self.active_task:
            self.active_task.cancel_event.set()
        return {"success": True, "message": "Cancellation requested"}

    def handle_scan(self, params):
        start_paths = params.get("paths", [])
        if not start_paths:
            legacy_path = params.get("path")
            if legacy_path:
                start_paths = [legacy_path]
            else:
                start_paths = ["C:\\"]
                
        language = params.get("language", "all")
        sync_mode = params.get("sync", False)
        custom_targets = params.get("custom_targets", [])
        
        if sync_mode:
            all_caches = []
            def aggregate_caches(method, params):
                if method == "dev_scanner.progress":
                    all_caches.extend(params.get("caches", []))
            
            task = DevScanningTask(
                start_paths, 
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
            start_paths, 
            language, 
            self.DEV_TARGETS, 
            self.SKIP_DIRS, 
            custom_targets,
            self.rpc_notify_callback
        )
        self.active_task = task
        
        def run_scan():
            try:
                res = task.execute()
                if self.rpc_notify_callback:
                    self.rpc_notify_callback("dev_scanner.completed", res)
            except Exception as e:
                logger.error("DevScan crashed.", {"error": str(e)})
                if self.rpc_notify_callback:
                    self.rpc_notify_callback("dev_scanner.error", {"message": str(e)})
            finally:
                self.active_task = None

        threading.Thread(target=run_scan, daemon=True).start()
        return {"status": "scan_started", "paths": start_paths}

    def handle_analyze_envs(self, params):
        env_paths = params.get("env_paths", [])
        language = params.get("language", "python")
        master_list = {} # format: { package_name: { version: set(paths) } }
        master_list_lock = threading.Lock()
        
        def analyze_single_env(path):
            # Determine actual language context if 'all' is selected
            actual_lang = language
            if language == 'all':
                if path.endswith('node_modules'):
                    actual_lang = 'node'
                elif path.endswith('target') and os.path.exists(os.path.join(os.path.dirname(path), 'Cargo.toml')):
                    actual_lang = 'rust'
                elif path.endswith('.gradle') or path.endswith('.m2') or (path.endswith('target') and os.path.exists(os.path.join(os.path.dirname(path), 'pom.xml'))):
                    actual_lang = 'java'
                else:
                    actual_lang = 'python'

            if actual_lang == "node":
                # For node, look for package.json in the parent directory of node_modules
                # path is like C:\app\node_modules, so parent is C:\app
                parent_dir = os.path.dirname(path)
                pkg_json_path = os.path.join(parent_dir, "package.json")
                if os.path.exists(pkg_json_path):
                    try:
                        import json
                        with open(pkg_json_path, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            deps = data.get("dependencies", {})
                            dev_deps = data.get("devDependencies", {})
                            all_deps = {**deps, **dev_deps}
                            
                            for pkg, ver in all_deps.items():
                                with master_list_lock:
                                    if pkg not in master_list:
                                        master_list[pkg] = {}
                                    # Strip leading ^ or ~
                                    clean_ver = ver.lstrip('^~')
                                    if clean_ver not in master_list[pkg]:
                                        master_list[pkg][clean_ver] = set()
                                    master_list[pkg][clean_ver].add(path)
                    except Exception as e:
                        logger.error(f"Error parsing {pkg_json_path}", {"error": str(e)})
            elif language == "rust":
                # For rust, look for Cargo.toml in the parent directory of target
                parent_dir = os.path.dirname(path)
                cargo_toml_path = os.path.join(parent_dir, "Cargo.toml")
                if os.path.exists(cargo_toml_path):
                    try:
                        with open(cargo_toml_path, 'r', encoding='utf-8') as f:
                            in_deps = False
                            for line in f:
                                line = line.strip()
                                if line.startswith('[dependencies]') or line.startswith('[dev-dependencies]'):
                                    in_deps = True
                                    continue
                                elif line.startswith('['):
                                    in_deps = False
                                    continue
                                    
                                if in_deps and '=' in line:
                                    parts = line.split('=', 1)
                                    pkg = parts[0].strip()
                                    ver_str = parts[1].strip()
                                    # Very basic parsing, ignore objects like { version = "1.0" } for now
                                    ver = ver_str.strip('"\'').split(',')[0].strip('{}').replace('version=', '').replace('version =', '').strip(' "\'')
                                    
                                    with master_list_lock:
                                        if pkg not in master_list:
                                            master_list[pkg] = {}
                                        if ver not in master_list[pkg]:
                                            master_list[pkg][ver] = set()
                                        master_list[pkg][ver].add(path)
                    except Exception as e:
                        logger.error(f"Error parsing {cargo_toml_path}", {"error": str(e)})
            elif actual_lang == "java":
                # Java dependencies are deeply nested in .gradle or .m2, or pom.xml
                # A simple scan would be too heavy. We can just append the project name itself 
                # as a placeholder for now, or just leave it empty if we don't have a fast parser.
                pass
            else:
                # Default python logic
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
                                    
                                    with master_list_lock:
                                        if pkg not in master_list:
                                            master_list[pkg] = {}
                                        if ver not in master_list[pkg]:
                                            master_list[pkg][ver] = set()
                                        master_list[pkg][ver].add(path)
                    except Exception as e:
                        logger.error(f"Error parsing {site_packages}", {"error": str(e)})

        # Parse environments concurrently for massive speed up
        with concurrent.futures.ThreadPoolExecutor(max_workers=16) as executor:
            executor.map(analyze_single_env, env_paths)

        # Convert sets to lists before returning JSON serialization
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

    def handle_cancel_delete_envs(self, params):
        self.cancel_delete_event.set()
        return {"success": True}

    def handle_delete_envs(self, params):
        self.cancel_delete_event.clear()
        env_paths = params.get("env_paths", [])
        results = []
        results_lock = threading.Lock()
        
        def delete_single_env(path):
            if self.cancel_delete_event.is_set():
                print(f"[{time.strftime('%H:%M:%S')}] CANCELLED BEFORE STARTING -> {path}", file=sys.stderr, flush=True)
                return
                
            print(f"[{time.strftime('%H:%M:%S')}] DELETING ENTIRE ENVIRONMENT -> {path}", file=sys.stderr, flush=True)
            try:
                # Fast optimized delete using shutil
                import shutil
                shutil.rmtree(path, ignore_errors=True)
                
                # Double check if any stubborn files remained
                if os.path.exists(path):
                    try:
                        # Fallback for read-only files
                        for root, dirs, files in os.walk(path, topdown=False):
                            if self.cancel_delete_event.is_set():
                                break
                            for name in files:
                                if self.cancel_delete_event.is_set():
                                    break
                                try:
                                    file_path = os.path.join(root, name)
                                    os.chmod(file_path, 0o777)
                                    os.remove(file_path)
                                except Exception: pass
                            for name in dirs:
                                if self.cancel_delete_event.is_set():
                                    break
                                try: os.rmdir(os.path.join(root, name))
                                except Exception: pass
                        os.rmdir(path)
                    except Exception: pass
                
                success = not os.path.exists(path)
                with results_lock:
                    results.append({"path": path, "deleted": success})
                
                if success:
                    print(f"\n=======================================================", file=sys.stderr, flush=True)
                    print(f"[{time.strftime('%H:%M:%S')}] ✅ SUCCESSFULLY DELETED: {path}", file=sys.stderr, flush=True)
                    print(f"=======================================================\n", file=sys.stderr, flush=True)
                else:
                    if self.cancel_delete_event.is_set():
                        print(f"[{time.strftime('%H:%M:%S')}] 🛑 CANCELLED DURING DELETE -> {path}", file=sys.stderr, flush=True)
                    else:
                        print(f"[{time.strftime('%H:%M:%S')}] ⚠️ PARTIAL DELETE -> {path}", file=sys.stderr, flush=True)
            except Exception as e:
                with results_lock:
                    results.append({"path": path, "deleted": False, "error": str(e)})
                print(f"[{time.strftime('%H:%M:%S')}] ERROR DELETING -> {path} ({str(e)})", file=sys.stderr, flush=True)
                
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
            executor.map(delete_single_env, env_paths)
                
        return {"success": True, "results": results}

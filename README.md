# SafeSweep 🧹

> A premium, desktop-first, and security-focused Windows desktop utility for intelligent system cleaning, background performance optimization, and developer environment management.

> [!WARNING]
> **Windows Exclusive:** SafeSweep deeply integrates with the Windows OS kernel, NTFS filesystem, and Windows Management Instrumentation (WMI). It is **NOT** supported on macOS, Linux, Android, or iOS.

SafeSweep is built with a dual-engine architecture, combining the fluid UI capabilities of React/Electron with the raw performance and low-level system access of a Python sidecar backend. It is designed to clean junk files safely, optimize battery life, and provide military-grade protection against local hacking vectors while managing your system environments.

---

## 🛠️ Technology Stack

**Frontend UI:**
- **React 18 & Vite** (High-performance UI Framework)
- **Zustand** (Lightweight State Management)
- **Tailwind CSS & Framer Motion** (Glassmorphism & Smooth Micro-animations)
- **React Router & Lucide React** (Client-side Routing & Iconography)

**Desktop Host & Backend:**
- **Electron** (Cross-platform Desktop Host with strict Context Isolation)
- **Python 3** (Sidecar Backend for heavy lifting and OS operations)
- **PyInstaller** (Compiles Python sidecar into a standalone executable)
- **psutil / ctypes / subprocess** (Hardware telemetry, NTFS locking, and secure IPC)

**Communication Protocol:**
- Bi-directional **JSON-RPC** over `stdin`/`stdout` between Electron and the Python sidecar.
- Hardened Local HTTP Fallback Server with **Strict CORS & DNS Rebinding Protection**.

---

## 🛡️ 100% Security & Privacy Architecture

SafeSweep has undergone rigorous security audits to ensure that it cannot be exploited by malicious scripts or local malware:

- **Anti-RCE (Remote Code Execution) Engine:** The Uninstaller module uses `shlex` parsing and strict executable validation, entirely removing `shell=True` vulnerabilities to prevent command injection.
- **Anti-LPE (Local Privilege Escalation) Shield:** Services are modified via Base64-encoded UAC (Administrator) prompts (`-EncodedCommand`) to strictly prevent PowerShell payload injection.
- **Strict Prototype & Object Filtering:** The Electron Preload Bridge natively filters all incoming IPC data to block Prototype Pollution attacks.
- **Path Traversal Guards:** File explorers are restricted via `os.path.normpath` and `explorer /select` to prevent arbitrary execution of untrusted files.
- **Anti-Battery Drain Cooldowns:** Disk telemetry threads are debounced and rate-limited. Scanning loops are rigorously bound to prevent CPU resource starvation and infinite loops.
- **Zero Log Garbage & Offline By Default:** SafeSweep operates transparently in memory without generating `.log` files in your `AppData`. It makes zero network calls to external servers.

---

## 🚀 Key Features

### 1. 📊 Smart Telemetry Dashboard (`/dashboard`)
Provides a smart, zero-drain system telemetry dashboard.
- **Event-Driven Architecture:** Fetch data only on demand. It features a strict 5-minute background cooldown ensuring **0% background battery drain** and no CPU overhead when idle.
- **System Snapshot:** Real-time RAM, CPU, and Disk capacity visualization.

### 2. 🗑️ Interactive System Cleaner (`/cleaner`)
A safe, deep-cleaning utility for general Windows bloatware.
- **Smart Scanners:** Safely clears `%TEMP%`, `C:\Windows\Temp`, Windows Prefetch, Crash Dumps, and Browser Caches.
- **Empty Folders & Duplicates:** Specialized modules to identify zero-byte folders and storage-hogging duplicate files.
- **Archive Manager:** Quickly locates massive forgotten `.zip` or `.iso` archives.

### 3. 💻 Developer Cleaner (`/dev-cleaner`)
The flagship feature of SafeSweep. Intelligently hunts down forgotten, gigabyte-heavy developer environments.
- **Targeted Deletion:** Specifically tracks down `.venv`, `node_modules`, `target` (Rust), and `build` folders.
- **Parallel Deletion Engine:** Multi-threaded, highly parallelized OS deletion engine capable of instantly wiping hundreds of thousands of tiny text files.
- **Safety Middleware:** Validates paths to ensure you never accidentally delete critical system source code or protected directories.

### 4. 🚀 Performance & Services Advisor
- **Ghost Buster 👻:** Triggers immediately on startup. It automatically detects and forcefully terminates orphaned, stuck, or older background instances of SafeSweep from previous sessions, keeping your PC clean and preventing memory leaks or battery drain.
- **Background Service Advisor:** Safely identifies legacy or telemetry Windows bloatware services (like MapsBroker, Xbox Live Svc). You can securely stop/start them to free up background RAM.
- **Game Booster:** Suspends background resource-heavy services and flushes RAM Standby lists for maximum frame-rates (FPS) before launching a game.
- **Startup Manager:** Inspects Windows startup vectors to optimize PC boot times.

### 5. 🗑️ Smart Application Uninstaller
- **Orphan Leftover Cleaning:** Automatically tracks down forgotten AppData folders and Windows Registry `SOFTWARE\` keys associated with uninstalled apps.
- **In-App Web Search:** Don't recognize an app? The built-in research tool safely opens a direct browser lookup to identify unknown bloatware.
- **Silent Operations:** Executes uninstallation tasks securely without triggering background vulnerability loops.

---

## 📂 Project Structure

```text
C:\Users\user\Desktop\Cleaner\
├── src-ui/                  # Frontend React App (Vite)
│   ├── store/               # Zustand Global State Management
│   └── views/               # Main Pages (Dashboard, Cleaner, Settings, Uninstaller)
├── src-sidecar/             # Python Backend Engine
│   ├── main.py              # Sidecar entrypoint, security validation, & RPC logic
│   ├── delete_engine.py     # Parallelized safe deletion engine
│   ├── uninstaller_engine.py# Registry parsing & protected uninstallation execution
│   ├── services_advisor.py  # Encoded LPE-protected service manager
│   └── safety_middleware.py # Prevents dangerous OS deletions
├── src/main/                # Electron Host processes
│   ├── security.js          # Electron Window hardening & CSP
│   └── sidecar.js           # Spawns and manages the Python sidecar process
└── package.json             # NPM dependencies & scripts
```

---

## 💻 Developer Setup

1. **Install Node Dependencies**
   ```bash
   npm install
   ```

2. **Setup Python Environment**
   ```bash
   python -m venv env
   env\Scripts\activate
   pip install psutil
   ```

3. **Run in Development Mode**
   ```bash
   npm run electron:dev
   ```
   *This concurrently runs the Vite dev server and the Electron wrapper, automatically spawning the protected Python sidecar.*

4. **Build for Production**
   ```bash
   npm run build
   ```
   *This compiles the Vite frontend and the Python sidecar into a standalone `.exe` using PyInstaller, then packages a zero-dependency setup via Electron Builder.*

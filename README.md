# SafeSweep 🧹

> A premium, desktop-first, and safety-focused Windows desktop utility for intelligent system cleaning and developer environment management.

> [!WARNING]
> **Windows Exclusive:** SafeSweep deeply integrates with the Windows OS kernel, NTFS filesystem, and Windows Management Instrumentation (WMI). It is **NOT** supported on macOS, Linux, Android, or iOS.

SafeSweep is built with a dual-engine architecture, combining the fluid UI capabilities of React/Electron with the raw performance and low-level system access of a Python sidecar backend. It is designed to clean junk files safely and specifically tackle the massive disk bloat caused by scattered developer environments (`node_modules`, `venv`, `target`, etc.).

---

## 🛠️ Technology Stack

**Frontend UI:**
- **React 18** (UI Framework)
- **Vite** (Build Tool)
- **Zustand** (Lightweight State Management)
- **Tailwind CSS** (Utility-first Styling & Glassmorphism)
- **Framer Motion** (Smooth Micro-animations)
- **Lucide React** (Consistent Iconography)
- **React Router** (Client-side Routing)
- **React Window** (Virtualization for large lists)

**Desktop Host & Backend:**
- **Electron** (Cross-platform Desktop Host)
- **Node.js** (IPC and Process Management)
- **Python 3** (Sidecar Backend for heavy lifting and OS operations)
- **PyInstaller** (Compiles Python sidecar into a standalone executable)
- **psutil / subprocess / powercfg** (Hardware telemetry, battery health, and disk I/O)

**Communication Protocol:**
- Bi-directional **JSON-RPC** over `stdin`/`stdout` between Electron and the Python sidecar.
- Custom **Watchdog** for auto-recovering crashed sidecar processes.

---

## 🚀 Key Features & Architecture

### 1. 📊 Live System Dashboard (`/dashboard`)
Provides real-time, zero-latency system telemetry without relying on bloated third-party tools.
- **Hardware Telemetry:** Live CPU Load, RAM Usage, Disk Read/Write speeds, and Network traffic.
- **Advanced Battery Health:** Uses `powercfg` and WMI telemetry to calculate actual physical hardware degradation (Design Capacity vs Full Charge Capacity).
- **Storage Analysis:** Visual breakdown of Used Space, Free Space, and Total Capacity.

### 2. 🗑️ Interactive System Cleaner (`/cleaner`)
A safe, deep-cleaning utility for general Windows bloatware.
- **Smart Scanners:** Targets Windows `%TEMP%`, `AppData\Local\Temp`, System Temp, and Browser Caches (Chrome, Edge, Firefox, Brave).
- **Safe Exclusions:** Excludes currently running applications and critical system files using a custom exclusion engine.
- **Additional Targets:** Old Downloads, Recycle Bin, Invalid Shortcuts, and legacy log files.

### 3. 💻 Developer Cleaner (`/dev-cleaner`)
The flagship feature of SafeSweep. Developers often lose hundreds of gigabytes to forgotten environments. This tool intelligently hunts them down.
- **Target Setup (`DevCleanerScanSetup.jsx`)**: Choose between a blazing-fast specific folder scan or a deep Full PC Scan. Filter by specific languages:
  - Python (`venv`, `env`, `.env`, `__pycache__`)
  - Node.js (`node_modules`)
  - Rust (`target`)
  - Java (`.gradle`, `.m2`)
  - Or scan for everything at once with dynamic context validation.
- **Smart Validation**: It doesn't just look for folder names. It validates the environment (e.g., checks for `package.json` in Node, `pyvenv.cfg` in Python, or `Cargo.toml` in Rust) to prevent false positive deletions.
- **Dependency Master List (`MasterList.jsx`)**: Before you delete environments, SafeSweep parses `package.json`, `Cargo.toml`, and Python's `site-packages` to generate a consolidated, deduplicated list of every package/library installed inside those environments.
- **Parallel Deletion (`AwsDeleteConfirm.jsx`)**: Multi-threaded, highly parallelized deletion engine for instantly wiping thousands of tiny files, accompanied by a live streaming terminal log.

### 4. ⚙️ Settings & Privacy (`/settings`)
- **Theme & UI:** Customize animations and developer mode toggles.
- **Safety Middleware:** Manage exclusion paths and protected directories to ensure you never accidentally delete critical source code.

---

## 📂 Project Structure

```text
C:\Users\user\Desktop\Cleaner\
├── src-ui/                  # Frontend React App (Vite)
│   ├── components/          # Reusable UI (Sidebar, Buttons)
│   ├── store/               # Zustand Global State
│   │   └── useDevCleanerStore.js
│   ├── views/               # Main Pages
│   │   ├── Dashboard.jsx
│   │   ├── Cleaner.jsx
│   │   ├── Settings.jsx
│   │   └── dev-cleaner/     # Developer Cleaner sub-components
│   └── main.jsx & App.jsx
├── src-sidecar/             # Python Backend Engine
│   ├── main.py              # Sidecar entrypoint & Telemetry logic
│   ├── dev_cleaner.py       # Heavy scanning, parsing, & deletion logic
│   ├── rpc.py               # JSON-RPC Dispatcher
│   └── safety_middleware.py # Prevents dangerous OS deletions
├── src/main/                # Electron Host processes
│   └── sidecar.js           # Spawns and manages the Python sidecar
├── package.json             # NPM dependencies & scripts
└── tailwind.config.js       # Styling configuration
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
   *This concurrently runs the Vite dev server and the Electron wrapper, automatically spawning the Python sidecar.*

4. **Build for Production**
   ```bash
   npm run build
   ```
   *This builds the Vite frontend and compiles the Python sidecar into a standalone binary using PyInstaller, then packages everything via Electron Builder.*

---

## 🔒 Privacy First
SafeSweep operates **locally on your machine**. Telemetry is strictly local. No network calls are made to external servers. What happens on your machine, stays on your machine.

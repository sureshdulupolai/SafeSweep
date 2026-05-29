# AI Smart PC Cleaner 🛡️

A premium, production-grade, **100% offline, privacy-first, and zero-telemetry** Windows desktop utility designed for system maintenance, temporary cache scanning, and secure file shredding. 

The application is engineered like a premium utility (modeled after Raycast, Linear, and Notion) focusing on **user safety, reversibility, and absolute predictability** rather than automated "one-click optimization."

---

## Key Features

### 🛡️ Safety Middleware & Protection Engine
* **Non-Bypassable Gateway:** Central safety module verifies all scanned paths, locks, extensions, and junctions before any filesystem calls are processed.
* **Protected Path Engine:** Immediate read-only enforcement on sensitive Windows folders (`C:\Windows`, `System32`), cloud folders (`OneDrive`), Program Files, and AppData directories.
* **WSL & Subsystem Shields:** Explicit exclusions mapping to bypass virtual machine drives (`ext4.vhdx`) and active WSL mounts (`\\wsl$`).

### 📦 Controlled and Reversible Cleaning
* **Safe Delete (Default):** Integrates with native Windows Shell `SHFileOperationW` bindings, sending items securely to the Recycle Bin with native OS safety and full recovery support.
* **Quarantine Recovery System:** Fully offline local cache that isolated files temporarily with a 24-hour expiration window. Allows cryptographically validated restorations back to original paths.
* **Smart Delete Simulation:** Dry-run simulations summarize exact file counts, sizes, and skipped items for user review before writing modifications to disk.

### ⚡ Professional Utility Aesthetics
* **High-Performance Scanning:** Traverses millions of files at 60 FPS utilizing `os.scandir` thread pools and `react-window` flattened virtualized lists.
* **Double-Pass Duplicate Finder:** RAPID matching of identical copies based on matching sizes, header chunk hashes, and final SHA-256 signatures (avoids reading huge files entirely).
* **Auto-Backoff Throttle:** Dynamically restricts execution threads and pauses scan intervals when CPU, I/O, or WMI Battery Saver alerts are triggered.

---

## System Architecture

```
                    [React Frontend] (Zustand State Store)
                           │
                           ▼
                    [Electron Shell] (Isolated Preload Bridge)
                           │ (stdin / stdout newline JSON-RPC 2.0)
                           ▼
                 [Python Sidecar Backend]
                           │
                           ▼
               [Safety Middleware Gate]
               /           │          \
              ▼            ▼           ▼
       [Safe Mode]   [Recycle Bin]  [Secure Shredder]
```

* **Zero telemetry / Cloud Sync / Account systems:** All operations occur purely inside local runtime memory. 
* **WAL SQLite & Hashed Logging:** Local databases operate in Write-Ahead Logging (WAL) mode for crash safety. Diagnostic logs automatically mask user profiles and expire after 7 days.

---

## Getting Started

### Prerequisites
* **Node.js:** v18+
* **Python:** v3.11+
* **PyInstaller:** for sidecar compilation

### Install Dependencies
```bash
# Install frontend and Electron packages
npm install

# Install optional Python utilities
pip install send2trash pyinstaller
```

### Run in Development
```bash
# Launches Vite dev server and spawns Electron in hot-reload DEV mode
npm run electron:dev
```

### Production Packaging Pipeline
The project compiles into a standalone, zero-dependency Windows executable and custom NSIS installer.

```bash
# 1. Compile UI and Python Sidecar
npm run build

# 2. Package into NSIS Installer (outputs to dist-app/)
npm run dist
```

---

## License & Safety Disclaimers

### Legal & Safety Language
**Designed with multiple protection layers to minimize accidental system damage.**

* **SSD Shredding Clause:** For SSDs, the application performs a best-effort overwrite strategy before deletion. Due to SSD wear-leveling, TRIM behavior, and controller-level remapping, secure erase guarantees cannot be fully assured.
* **Subsystem Safety:** This software does not perform automated, silent background cleanups or fake RAM optimizations.

This software is released under the **Proprietary License**. Redistributing compiled components is prohibited.

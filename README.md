# SafeSweep 🛡️

A premium, production-grade, **100% offline, privacy-first, and zero-telemetry** Windows desktop utility designed for system maintenance, temporary cache scanning, duplicate sweeps, and secure file unlinking. 

The application is engineered like a premium utility (modeled after Raycast, Linear, and Notion) focusing on **user safety, reversibility, and absolute predictability** rather than automated "one-click optimization."

---

## Key Features

### 🛡️ Safety Middleware & Protection Engine
* **Non-Bypassable Gateway:** Central safety module verifies all scanned paths, locks, extensions, and junctions before any filesystem calls are processed.
- **Protected Path Engine**: Immediate read-only enforcement on sensitive Windows folders (`C:\Windows`, `System32`), cloud folders (`OneDrive`), Program Files, and AppData directories.
* **WSL & Subsystem Shields:** Explicit exclusions mapping to bypass virtual machine drives (`ext4.vhdx`) and active WSL mounts (`\\wsl$`).

### 💿 Real-Time Dynamic Dashboard Analytics
- **Natively Polled C:\ Drive**: Shows the real physical NTFS disk capacity and free space dynamically using native Win32 `GetDiskFreeSpaceExW` bindings.
- **Asynchronous Stats Caching**: Runs deep directory walks for **Temporary Files** and **Browser Caches** in a background daemon thread on startup. No mocked placeholder gigabytes are used.
- **Dynamic Size & Count Reporting**: Displays real computed sizes and total file counts for the Recycle Bin, temporary folders (`%TEMP%`, `C:\Windows\Temp`, `Prefetch`), and web browsers (Chrome, Edge, Brave, Firefox).

### 📦 Target Directory presets & Scanner
- **Dynamic Defaults**: Initializes target paths dynamically to the user's active Windows Downloads folder on startup.
- **Quick-Preset Chips**: Allows one-click switching of target scan directories:
  - 📂 Downloads Folder
  - 🖥️ Desktop Folder
  - 💿 C:\ System Drive
- **Drag-and-Drop Traversal**: Simply drag folder shortcuts from Windows Explorer directly into the application panel to trigger safe sweeps.

### ⚠️ Unified Typed Confirmation Modals
- **Irreversible Actions Protection**: Standardizes typed verification across both the Cleaner tree selection and Duplicate Finder. The user must type `"delete"` (case-insensitive) to authorize execution.
- **Double-Pass Duplicate Finder**: RAPID matching of identical copies based on matching sizes, header chunk hashes, and final SHA-256 signatures, with professional confirmation modals replacing standard browser alerts.
- **Safe Shell Delete (Default)**: Natively interfaces with Windows `SHFileOperationW` shell bindings to relocate items safely to the Recycle Bin.

---

## System Architecture

```
                    [React Frontend - Vite + Tailwind]
                             │ (Safe Preload Bridge Guards)
                             ▼
                     [Electron Shell] (Isolated IPC Preload)
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
- **WAL SQLite & Hashed Logging**: SQLite database runs in WAL (Write-Ahead Logging) mode. Local exclusions and quarantine tables refresh instantly in the UI.

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

# SafeSweep 🛡️

A premium, production-grade, **100% offline, privacy-first, and zero-telemetry** Windows desktop utility designed for system maintenance, temporary cache scanning, duplicate sweeps, and secure file unlinking. 

The application is engineered like a premium utility focusing on **user safety, reversibility, and absolute predictability** rather than automated "one-click optimization."

---

## 🏗️ System Architecture & Codebase Structure

The project follows a robust, multi-layered architecture utilizing web technologies for the interface and Python for native system operations.

### 1. Frontend (`src-ui/`) - React + Vite + TailwindCSS
The user interface is built using modern React, styled with TailwindCSS, animated with Framer Motion, and state-managed by Zustand (`src-ui/store/useAppStore.js`).

#### Key Pages & Features:
* **Dashboard (`src-ui/views/Dashboard.jsx`)**: 
  - **Dynamic SVG Disk Visualizer**: Real-time visualization of the C:\ drive's capacity and free space.
  - **Quick Clean Actions**: Instantly clear Recycle Bin, Temporary Files, and Browser Caches.
  - **Typed Confirmation Modals**: To prevent accidental deletion, users must type `"delete"` to execute a quick clean.
  - **Real-Time Polling**: Natively queries the sidecar every 3 seconds to keep metrics updated without blocking the UI.

* **Cleaner / Scanner (`src-ui/views/Cleaner.jsx`)**:
  - **Target Directory Scanner**: Accepts custom paths, Drag-and-Drop, or quick presets (Downloads, Desktop, C:\).
  - **Scan Modes**: Quick, Balanced, and Deep scans.
  - **File Type Filtering**: Easily filter scanned results by Images, Videos, Audio, PDFs, and Text files.
  - **Execution Strategies**: Allows users to choose between **Safe Delete** (moves to Recycle Bin) and **Permanent Shred** (cryptographic unlinking).
  - **Batch Reloading**: Safely paginates large directory scans (e.g., 20,000+ files) to maintain blazingly fast UI performance.

* **Settings & Transparency (`src-ui/views/Settings.jsx`)**:
  - **Exclusion Manager**: Allows users to add custom directory paths that the scanner should ignore (e.g., development folders, game drives).
  - **Privacy Transparency**: Educational panels reinforcing the zero-telemetry, offline-only nature of the app.
  - **Developer Mode Override**: A heavily guarded feature requiring the user to type `"ENABLE DEVELOPER MODE"` to unlock destructive operations on critical system components.

### 2. Backend Sidecar (`src-sidecar/`) - Python
The heavy lifting (filesystem operations, safety checks, OS-level API calls) is handled by a local Python daemon.

* **`main.py`**: The central entry point. It runs a dual-interface server:
  - **JSON-RPC 2.0**: Communicates with the Electron shell via standard input/output streams.
  - **Lightweight HTTP Server (Port 9988)**: Serves as a local API backend for standard browsers when running outside of the Electron sandbox.
* **`safety_middleware.py`**: The Non-Bypassable Gateway. Protects critical Windows folders (`System32`, `Windows`, `OneDrive`) from accidental deletion.
* **`delete_engine.py`**: Handles transactional file deletion, including safe-shell deletions and SSD-aware file shredding.
* **`scanner.py`**: A high-performance, cooperative directory walker that streams results back to the UI in chunks.
* **`crash_recovery.py`**: Maintains a WAL SQLite journal for active transactions, ensuring that mid-deletion crashes can be recovered gracefully on next startup.

### 3. Electron Shell (`src/main/`)
The native wrapper that bridges the React UI and the Python sidecar.
* **`main.js`**: Bootstraps the application window and manages lifecycle events.
* **`sidecar.js`**: Manages the Python process lifecycle, spawning it on startup and killing it on exit.
* **`security.js`**: Enforces content security policies (CSP) and IPC constraints to harden the app against XSS or arbitrary code execution.

---

## ✨ Core Features & Safety Philosophy

* **100% Offline & Private**: No cloud accounts, no sync uploads, no background services. Everything operates in local RAM. SQLite is used purely for local exclusions and quarantine rules.
* **Typed Confirmations**: Critical destructive actions require manual typing (e.g., `"delete"`) rather than simple button clicks, drastically reducing accidental wipes.
* **Hardware-Level Analytics**: Does not use mock data. Uses native Win32 `GetDiskFreeSpaceExW` and deep recursive folder walks to provide real-time bytes tracking for temporary items and caches.

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: v18+
* **Python**: v3.11+
* **PyInstaller**: (for compiling the Python sidecar)

### Development Setup
1. **Install JavaScript dependencies:**
   ```bash
   npm install
   ```
2. **Install Python dependencies:**
   ```bash
   pip install send2trash pyinstaller
   ```
3. **Run the Application:**
   ```bash
   npm run electron:dev
   ```
   *This launches the Vite dev server and spawns Electron in hot-reload DEV mode.*

### Production Build
To package the application into a standalone Windows executable (NSIS Installer):
```bash
npm run build
npm run dist
```
The installer will be generated in the `dist-app/` directory.

---

## ⚖️ License & Disclaimers

**Proprietary License.** Redistributing compiled components is prohibited.

**Safety Disclaimer**: 
- Designed with multiple protection layers to minimize accidental system damage.
- **SSD Shredding Clause**: For SSDs, the application performs a best-effort overwrite strategy. Due to SSD wear-leveling, TRIM, and controller-level remapping, secure erase guarantees cannot be fully assured. 
- This software does not perform automated, silent background cleanups or fake RAM optimizations.

const { app, BrowserWindow, ipcMain, nativeTheme, dialog } = require('electron');
const path = require('path');
const SidecarManager = require('./sidecar');
const { applySecurityHeaders, enforceWindowHarden, validateIPCMessage } = require('./security');

let mainWindow = null;
let sidecarManager = null;

// Unique transaction ID counter for matching JSON-RPC requests
let transactionCounter = 0;
const activeRequests = new Map(); // Maps transaction_id -> original IPC sender channel

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: true,  // native title bar and system frame controls
    titleBarStyle: 'default',
    backgroundColor: '#070A13', // Matches dashboard dark backgrounds
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true, // Crucial for security
      nodeIntegration: false, // Prevents Node.js injections
      sandbox: true,          // Restricts renderer access boundaries
      enableRemoteModule: false,
      devTools: true
    }
  });

  // Apply Security Hardening (CSP & Navigation overrides)
  applySecurityHeaders();
  enforceWindowHarden(mainWindow);

  // Load target resource
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist-ui/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Initialize and spawn Python sidecar process
  sidecarManager = new SidecarManager(mainWindow);
  sidecarManager.start();

  // On boot, send system startup diagnostics
  setTimeout(() => {
    sidecarManager.send('system.startup', {}, ++transactionCounter);
  }, 1000);
}

// --- IPC BRIDGE HANDLER RULES ---

ipcMain.on('ipc:request', (event, packet) => {
  const { channel, data } = packet;

  try {
    // 1. Enforce strict IPC validation checks first
    validateIPCMessage(channel, data);

    // 2. Map channel paths to Python JSON-RPC commands
    const rpcId = ++transactionCounter;
    activeRequests.set(rpcId, { event, channel });

    let rpcMethod = '';
    let rpcParams = { ...data };

    switch (channel) {
      case 'system:startup':
        rpcMethod = 'system.startup';
        break;
      case 'system:disk':
        rpcMethod = 'system.disk_space';
        break;
      case 'system:dashboard_stats':
        rpcMethod = 'system.dashboard_stats';
        break;
      case 'scanner:start':
        rpcMethod = 'scanner.start_scan';
        rpcParams = { path: data.path, scan_mode: data.scanMode };
        break;
      case 'scanner:cancel':
        rpcMethod = 'scanner.cancel_scan';
        break;
      case 'delete:start':
        rpcMethod = 'delete.start_delete';
        rpcParams = { targets: data.targets, permanent: data.permanent, scan_path: data.scanPath };
        break;
      case 'delete:cancel':
        rpcMethod = 'delete.cancel_delete';
        break;
      case 'duplicates:start':
        rpcMethod = 'duplicates.start_scan';
        rpcParams = { folders: data.folders };
        break;
      case 'browser:scan':
        rpcMethod = 'browser.scan_caches';
        break;
      case 'recycle:query':
        rpcMethod = 'recycle_bin.query';
        break;
      case 'recycle:empty':
        rpcMethod = 'recycle_bin.empty';
        rpcParams = { confirm: data.confirm };
        break;
      case 'exclusions:list':
        rpcMethod = 'exclusions.list';
        break;
      case 'exclusions:add':
        rpcMethod = 'exclusions.add';
        rpcParams = { path: data.path };
        break;
      case 'exclusions:remove':
        rpcMethod = 'exclusions.remove';
        rpcParams = { path: data.path };
        break;
      case 'quarantine:list':
        rpcMethod = 'quarantine.list';
        break;
      case 'quarantine:restore':
        rpcMethod = 'quarantine.restore';
        rpcParams = { id: data.id, custom_destination: data.customDestination };
        break;
      case 'system:quick_clean':
        rpcMethod = 'system.quick_clean';
        rpcParams = { target: data.target };
        break;
      case 'developer:setMode':
        rpcMethod = 'system.set_developer_mode';
        rpcParams = { enabled: data.enabled };
        break;
      case 'empty_folders:scan':
        rpcMethod = 'system.scan_empty_folders';
        break;
      case 'empty_folders:delete':
        rpcMethod = 'system.delete_empty_folders';
        rpcParams = { targets: data.targets };
        break;
    }

    if (rpcMethod) {
      sidecarManager.send(rpcMethod, rpcParams, rpcId);
    }

  } catch (err) {
    console.error('IPC request rejected by Main security manager:', err.message);
    event.reply('sidecar:response', {
      jsonrpc: '2.0',
      error: {
        code: -32600,
        message: err.message
      },
      id: null
    });
  }
});

// Update Native taskbar progress during scans
ipcMain.on('taskbar:progress', (event, ratio) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setProgressBar(ratio); // Value between 0 and 1. Set to -1 to clear.
  }
});

// Open Native Directory Dialog
ipcMain.handle('dialog:openDirectory', async () => {
  if (!mainWindow) return { canceled: true };
  return await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Scan Target Directory',
    buttonLabel: 'Select Folder'
  });
});

// Open Directory in File Explorer
ipcMain.handle('shell:openDirectory', async (event, dirPath) => {
  if (typeof dirPath !== 'string') return 'Invalid path';
  const path = require('path');
  if (!path.isAbsolute(dirPath)) {
    return 'Path must be absolute';
  }
  const { shell } = require('electron');
  return await shell.openPath(dirPath);
});

// --- LIFECYCLE CONTROLS ---

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async (event) => {
  if (sidecarManager) {
    event.preventDefault();
    // Safely shutdown sidecar before closing main loop
    await sidecarManager.shutdown();
    sidecarManager = null;
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

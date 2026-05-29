const { session } = require('electron');

/**
 * Hardens Electron session instance with strict Content Security Policies (CSP).
 * Blocks external scripting, dynamic evaluation, and external frames.
 */
function applySecurityHeaders() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://localhost:5173; font-src 'self'; object-src 'none'; frame-ancestors 'none';"
        ]
      }
    });
  });
}

/**
 * Blocks external navigation attempt and forces the application window to
 * remain contained within local packaged assets.
 */
function enforceWindowHarden(mainWindow) {
  // Prevent external link clicks or dynamic navigation relocations
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  // Block popup creation or sub-window creation
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
}

/**
 * Validates incoming IPC methods and arguments using strict schema checking.
 * Prevents arbitrary injection of commands through the Preload bridge.
 */
const APPROVED_IPC_METHODS = new Set([
  'system:startup',
  'scanner:start',
  'scanner:cancel',
  'delete:start',
  'delete:cancel',
  'duplicates:start',
  'browser:scan',
  'recycle:query',
  'recycle:empty',
  'exclusions:list',
  'exclusions:add',
  'exclusions:remove',
  'quarantine:list',
  'quarantine:restore',
  'developer:setMode'
]);

function validateIPCMessage(channel, data) {
  if (!APPROVED_IPC_METHODS.has(channel)) {
    throw new Error(`Security Exception: Unapproved IPC channel '${channel}' requested.`);
  }

  // Schema-level type audits based on target channels
  if (channel === 'scanner:start') {
    if (typeof data.path !== 'string') {
      throw new Error(`IPC Schema Failure: 'scanner:start' requires path string.`);
    }
  }

  if (channel === 'delete:start') {
    if (!Array.isArray(data.targets)) {
      throw new Error(`IPC Schema Failure: 'delete:start' requires targets array.`);
    }
  }

  if (channel === 'exclusions:add' || channel === 'exclusions:remove') {
    if (typeof data.path !== 'string') {
      throw new Error(`IPC Schema Failure: Exclusion channels require a target path string.`);
    }
  }

  if (channel === 'quarantine:restore') {
    if (typeof data.id !== 'string') {
      throw new Error(`IPC Schema Failure: 'quarantine:restore' requires an item ID.`);
    }
  }

  return true;
}

module.exports = {
  applySecurityHeaders,
  enforceWindowHarden,
  validateIPCMessage
};

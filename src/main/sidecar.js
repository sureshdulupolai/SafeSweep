const { spawn } = require('child_process');
const path = require('path');
const { app } = require('electron');

class SidecarManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.process = null;
    this.crashCounter = 0;
    this.watchdogTimer = null;
    this.stdoutBuffer = '';
    this.isShuttingDown = false;
  }

  start() {
    this.isShuttingDown = false;
    
    // Check if running in development or packaged production mode
    const isDev = !app.isPackaged;
    
    let executable = 'python';
    let args = [];

    if (isDev) {
      // In development, spawn Python with our main script target
      executable = 'python';
      args = [path.join(app.getAppPath(), 'src-sidecar/main.py')];
    } else {
      // In production, execute the packaged binary compiled by PyInstaller
      executable = path.join(process.resourcesPath, 'sidecar-dist', 'main.exe');
      args = [];
    }

    console.log(`Spawning sidecar process: ${executable} ${args.join(' ')}`);

    try {
      this.process = spawn(executable, args, {
        cwd: isDev ? app.getAppPath() : path.dirname(executable),
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      });

      this._setupStreams();
      this._resetWatchdogInterval();
      
    } catch (err) {
      console.error('Fatal: Failed to spawn sidecar backend process.', err);
      this._handleCrash();
    }
  }

  send(method, params = {}, id = null) {
    if (!this.process || this.process.killed) {
      console.error('Cannot send RPC packet: sidecar process is currently offline.');
      return false;
    }

    const payload = {
      jsonrpc: '2.0',
      method,
      params,
      id
    };

    try {
      this.process.stdin.write(JSON.stringify(payload) + '\n');
      return true;
    } catch (err) {
      console.error('Failed to write packet to sidecar stdin stream.', err);
      return false;
    }
  }

  shutdown() {
    if (!this.process || this.isShuttingDown) return Promise.resolve();

    this.isShuttingDown = true;
    console.log('Sending graceful shutdown command to sidecar...');

    return new Promise((resolve) => {
      // Send shutdown notification
      this.send('system.shutdown', {}, null);

      const killTimeout = setTimeout(() => {
        if (this.process && !this.process.killed) {
          console.warn('Sidecar failed to exit cleanly within 2 seconds. Terminating forcefully.');
          this.process.kill('SIGKILL');
        }
        resolve();
      }, 2000);

      this.process.once('exit', () => {
        clearTimeout(killTimeout);
        console.log('Sidecar exited cleanly.');
        resolve();
      });
    });
  }

  _setupStreams() {
    // 1. Process stdout reader with line buffering
    this.process.stdout.on('data', (data) => {
      this.stdoutBuffer += data.toString();
      let lineIndex = this.stdoutBuffer.indexOf('\n');
      
      while (lineIndex >= 0) {
        const line = this.stdoutBuffer.substring(0, lineIndex).trim();
        this.stdoutBuffer = this.stdoutBuffer.substring(lineIndex + 1);
        
        if (line) {
          this._handleLine(line);
        }
        
        lineIndex = this.stdoutBuffer.indexOf('\n');
      }
    });

    // 2. Process stderr reader
    this.process.stderr.on('data', (data) => {
      console.error(`[Sidecar Stderr] ${data.toString().trim()}`);
    });

    // 3. Process close handlers
    this.process.on('close', (code) => {
      if (!this.isShuttingDown) {
        console.warn(`Sidecar backend exited unexpectedly with code ${code}.`);
        this._handleCrash();
      }
    });
  }

  _handleLine(line) {
    try {
      const packet = JSON.parse(line);
      
      // Route message back to the Electron window
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        if (packet.method) {
          // It's an incremental progress notification (e.g. scanner.progress)
          this.mainWindow.webContents.send('sidecar:notification', packet);
        } else {
          // It's a standard method response
          this.mainWindow.webContents.send('sidecar:response', packet);
        }
      }
    } catch (err) {
      console.error('Failed to parse incoming line from sidecar stdout:', err);
    }
  }

  _handleCrash() {
    this.crashCounter++;
    console.error(`Watchdog registered sidecar crash. (Crash Count: ${this.crashCounter}/3)`);

    if (this.crashCounter < 3) {
      // Auto-restart sidecar and notify UI
      console.log('Attempting automatic watchdog sidecar recovery...');
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('system:warning', {
          message: 'System service restarted. Redoing search...'
        });
      }
      
      setTimeout(() => this.start(), 1000);
    } else {
      console.error('Fatal: Watchdog sidecar crash limit exceeded. Halting restarts.');
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('system:error', {
          message: 'Local background service failed to start. Please restart the application.'
        });
      }
    }
  }

  _resetWatchdogInterval() {
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
    
    // Clear the crash counter every 5 minutes if stable
    this.watchdogTimer = setTimeout(() => {
      if (this.crashCounter > 0) {
        console.log('Sidecar has been stable. Resetting watchdog crash counters.');
        this.crashCounter = 0;
      }
      this._resetWatchdogInterval();
    }, 5 * 60 * 1000);
  }
}

module.exports = SidecarManager;

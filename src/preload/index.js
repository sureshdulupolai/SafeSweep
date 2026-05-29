const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload Script establishing a secure, context-isolated bridge.
 * Node.js modules are kept strictly inaccessible from the React renderer,
 * and we only expose validated, schema-aligned event routes.
 */
contextBridge.exposeInMainWorld('api', {
  /**
   * Dispatches a validated request to the Electron Main process.
   */
  sendRequest: (channel, data = {}) => {
    // Basic structural checks before emitting
    if (typeof channel !== 'string') {
      console.error('API Bridge rejected call: invalid event channel format.');
      return;
    }
    ipcRenderer.send('ipc:request', { channel, data });
  },

  /**
   * Registers a listener for background sidecar notification streams
   * (such as scanner or deletion incremental progresses).
   */
  onNotification: (callback) => {
    const subscription = (event, packet) => callback(packet);
    ipcRenderer.on('sidecar:notification', subscription);
    return () => ipcRenderer.removeListener('sidecar:notification', subscription);
  },

  /**
   * Registers a listener for standard method responses from the sidecar.
   */
  onResponse: (callback) => {
    const subscription = (event, packet) => callback(packet);
    ipcRenderer.on('sidecar:response', subscription);
    return () => ipcRenderer.removeListener('sidecar:response', subscription);
  },

  /**
   * Registers a listener for watchdog warnings (such as service crash recovery warnings).
   */
  onWarning: (callback) => {
    const subscription = (event, packet) => callback(packet);
    ipcRenderer.on('system:warning', subscription);
    return () => ipcRenderer.removeListener('system:warning', subscription);
  },

  /**
   * Registers a listener for fatal watchdog crash exceptions.
   */
  onError: (callback) => {
    const subscription = (event, packet) => callback(packet);
    ipcRenderer.on('system:error', subscription);
    return () => ipcRenderer.removeListener('system:error', subscription);
  }
});

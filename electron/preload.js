const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setWindowSize: (width, height) =>
    ipcRenderer.invoke('set-window-size', { width, height }),
});

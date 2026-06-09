const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setWindowSize:  (width, height) => ipcRenderer.invoke('set-window-size', { width, height }),
  getSaveFolder:  ()              => ipcRenderer.invoke('get-save-folder'),
  selectFolder:   ()              => ipcRenderer.invoke('select-folder'),
  onRequestSave:  (callback)      => ipcRenderer.on('request-save', callback),
  readyToClose:   (todos)         => ipcRenderer.send('ready-to-close', todos),
});

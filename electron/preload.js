const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 창 크기/위치
  setWindowSize:     (width, height) => ipcRenderer.invoke('set-window-size', { width, height }),
  getWindowPosition: ()              => ipcRenderer.invoke('get-window-position'),
  startDrag:         (offset)        => ipcRenderer.send('start-drag', offset),
  endDrag:           ()              => ipcRenderer.send('end-drag'),

  // 설정
  getKeyColor:      () => ipcRenderer.invoke('get-key-color'),
  setKeyColor:      (color) => ipcRenderer.invoke('set-key-color', color),

  // 저장
  getSaveFolder:    () => ipcRenderer.invoke('get-save-folder'),
  selectFolder:     () => ipcRenderer.invoke('select-folder'),
  onRequestSave:    (cb) => ipcRenderer.on('request-save', cb),
  readyToClose:     (data) => ipcRenderer.send('ready-to-close', data),
  onRequestAutoSave:(cb) => ipcRenderer.on('request-auto-save', cb),
  autoSaveData:     (data) => ipcRenderer.send('auto-save-data', data),
});

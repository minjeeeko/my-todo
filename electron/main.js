const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV !== 'production';

const COLLAPSED = { width: 200, height: 200 };
const EXPANDED  = { width: 320, height: 480 };

function getPosition(width, height) {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  return { x: sw - width - 20, y: sh - height - 20 };
}

function createWindow() {
  const { x, y } = getPosition(COLLAPSED.width, COLLAPSED.height);

  const win = new BrowserWindow({
    width: COLLAPSED.width,
    height: COLLAPSED.height,
    x,
    y,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, '../build/index.html'));
  }

  ipcMain.handle('set-window-size', (event, { width, height }) => {
    const { x: nx, y: ny } = getPosition(width, height);
    win.setSize(width, height);
    win.setPosition(nx, ny);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

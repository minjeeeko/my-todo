const { app, BrowserWindow, screen, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const fs   = require('fs');

// Electron 20+: must register custom schemes before app.whenReady()
protocol.registerSchemesAsPrivileged([
  { scheme: 'asset', privileges: { secure: true, standard: true, supportFetchAPI: true } }
]);

// 단일 인스턴스 강제: 이미 실행 중이면 기존 창을 포커스하고 종료
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

const isDev = !app.isPackaged;

const COLLAPSED = { width: 200, height: 200 };

// ── 설정 파일 ────────────────────────────────────────────────────────
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')); }
  catch { return {}; }
}

function saveSettings(data) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ── 저장 파일 내용 생성 ───────────────────────────────────────────────
function buildFileContent(todos, retro) {
  const now    = new Date();
  const year   = now.getFullYear();
  const month  = String(now.getMonth() + 1).padStart(2, '0');
  const day    = String(now.getDate()).padStart(2, '0');
  const lines  = todos.map(t => `[${t.done ? 'v' : ' '}] ${t.text}`);
  const done   = todos.filter(t => t.done).length;

  const parts = [
    `=== ${year}년 ${month}월 ${day}일 할 일 기록 ===`,
    '',
    ...lines,
    '',
    `완료: ${done}개 / 전체: ${todos.length}개`,
  ];

  if (retro && retro.trim()) {
    parts.push('', '─────────────────', '📝 오늘의 회고', '', retro.trim());
  }

  return {
    fileName: `${year}-${month}-${day}.txt`,
    content: parts.join('\n'),
  };
}

// ── 창 위치 계산 (기본: 우측 하단) ───────────────────────────────────
function getDefaultPosition(width, height) {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  return { x: sw - width - 20, y: sh - height - 20 };
}

// ── 메인 윈도우 ───────────────────────────────────────────────────────
function createWindow() {
  const { x, y } = getDefaultPosition(COLLAPSED.width, COLLAPSED.height);

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
      webSecurity: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, '../build/index.html'));
  }

  // ── 드래그: main에서 커서 폴링 ───────────────────────────────────────
  let dragInterval = null;
  let dragOffset   = { x: 0, y: 0 };

  ipcMain.on('start-drag', (_, offset) => {
    dragOffset = offset;
    dragInterval = setInterval(() => {
      const cursor = screen.getCursorScreenPoint();
      win.setPosition(
        Math.round(cursor.x - dragOffset.x),
        Math.round(cursor.y - dragOffset.y)
      );
    }, 16);
  });

  ipcMain.on('end-drag', () => {
    if (dragInterval) { clearInterval(dragInterval); dragInterval = null; }
  });

  ipcMain.handle('get-window-position', () => win.getPosition());

  // ── 창 크기 조절: setBounds로 한 번에 처리 (두 번 호출 시 렌더링 깜빡임 방지) ──
  ipcMain.handle('set-window-size', (_, { width, height }) => {
    const [cx, cy] = win.getPosition();
    const [cw, ch] = win.getSize();
    const newX = cx + cw - width;
    const newY = cy + ch - height;
    win.setBounds({ x: newX, y: newY, width, height });
  });

  // ── 키컬러 ───────────────────────────────────────────────────────
  ipcMain.handle('get-key-color', () => loadSettings().keyColor || null);

  ipcMain.handle('set-key-color', (_, color) => {
    const s = loadSettings();
    s.keyColor = color;
    saveSettings(s);
  });

  // ── 저장 폴더 ────────────────────────────────────────────────────
  ipcMain.handle('get-save-folder', () => loadSettings().saveFolder || null);

  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(win, {
      title: '매일 기록을 저장할 폴더를 선택해주세요',
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const folder = result.filePaths[0];
    const s = loadSettings();
    s.saveFolder = folder;
    saveSettings(s);
    return folder;
  });

  // ── 매일 오후 9시 자동 저장 ───────────────────────────────────────
  let lastAutoSaveDate = null;
  const autoSaveInterval = setInterval(() => {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    if (now.getHours() === 21 && lastAutoSaveDate !== dateKey) {
      lastAutoSaveDate = dateKey;
      win.webContents.send('request-auto-save');
    }
  }, 30 * 1000);

  ipcMain.on('auto-save-data', (_, { todos, retro }) => {
    const settings = loadSettings();
    if (!settings.saveFolder || (todos.length === 0 && !retro)) return;
    try {
      const { fileName, content } = buildFileContent(todos, retro);
      fs.writeFileSync(path.join(settings.saveFolder, fileName), content, 'utf8');
    } catch (e) {
      console.error('자동 저장 실패:', e);
    }
  });

  // ── 종료 시 저장 ──────────────────────────────────────────────────
  let isClosing = false;
  win.on('close', (event) => {
    if (isClosing) return;
    event.preventDefault();
    isClosing = true;
    win.webContents.send('request-save');
  });

  ipcMain.once('ready-to-close', (_, { todos, retro }) => {
    const settings = loadSettings();
    if (settings.saveFolder && (todos.length > 0 || retro)) {
      try {
        const { fileName, content } = buildFileContent(todos, retro);
        fs.writeFileSync(path.join(settings.saveFolder, fileName), content, 'utf8');
      } catch (e) {
        console.error('저장 실패:', e);
      }
    }
    // IPC 핸들러 정리 후 종료
    ipcMain.removeHandler('get-window-position');
    ipcMain.removeHandler('set-window-size');
    ipcMain.removeHandler('get-save-folder');
    ipcMain.removeHandler('select-folder');
    if (dragInterval) clearInterval(dragInterval);
    clearInterval(autoSaveInterval);
    app.quit();
  });

  // 두 번째 인스턴스 실행 시 기존 창을 앞으로 가져옴
  app.on('second-instance', () => {
    if (win.isMinimized()) win.restore();
    win.focus();
  });
}

app.whenReady().then(() => {
  protocol.registerFileProtocol('asset', (request, callback) => {
    const relative = decodeURIComponent(request.url.replace('asset://', ''));
    const base = isDev
      ? path.join(__dirname, '../public')
      : process.resourcesPath;
    callback({ path: path.join(base, relative) });
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

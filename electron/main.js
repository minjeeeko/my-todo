const { app, BrowserWindow, screen, ipcMain, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');

const isDev = process.env.NODE_ENV !== 'production';

const COLLAPSED = { width: 200, height: 200 };
const EXPANDED  = { width: 320, height: 480 };

// ── 설정 파일 (userData/settings.json) ──────────────────────────────
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveSettings(data) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ── 창 위치 계산 ─────────────────────────────────────────────────────
function getPosition(width, height) {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  return { x: sw - width - 20, y: sh - height - 20 };
}

// ── 저장 파일 내용 생성 ───────────────────────────────────────────────
function buildFileContent(todos) {
  const now     = new Date();
  const year    = now.getFullYear();
  const month   = String(now.getMonth() + 1).padStart(2, '0');
  const day     = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}년 ${month}월 ${day}일`;
  const fileDate = `${year}-${month}-${day}`;

  const lines = todos.map(t => `[${t.done ? 'v' : ' '}] ${t.text}`);
  const checked = todos.filter(t => t.done).length;

  return {
    fileName: `${fileDate}.txt`,
    content: [
      `=== ${dateStr} 할 일 기록 ===`,
      '',
      ...lines,
      '',
      `완료: ${checked}개 / 전체: ${todos.length}개`,
    ].join('\n'),
  };
}

// ── 메인 윈도우 ───────────────────────────────────────────────────────
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

  // 창 닫기 → 렌더러에서 todo 받아서 파일 저장 후 종료
  let isClosing = false;
  win.on('close', (event) => {
    if (isClosing) return;
    event.preventDefault();
    isClosing = true;
    win.webContents.send('request-save');
  });

  // ── IPC 핸들러 ──────────────────────────────────────────────────────

  ipcMain.handle('set-window-size', (_, { width, height }) => {
    const { x: nx, y: ny } = getPosition(width, height);
    win.setSize(width, height);
    win.setPosition(nx, ny);
  });

  // 저장 폴더 조회
  ipcMain.handle('get-save-folder', () => {
    return loadSettings().saveFolder || null;
  });

  // 폴더 선택 다이얼로그
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(win, {
      title: '매일 기록을 저장할 폴더를 선택해주세요',
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const folder = result.filePaths[0];
    const settings = loadSettings();
    settings.saveFolder = folder;
    saveSettings(settings);
    return folder;
  });

  // 렌더러에서 todo 데이터 수신 → 파일 저장 → 창 종료
  ipcMain.once('ready-to-close', (_, todos) => {
    const settings = loadSettings();
    if (settings.saveFolder && todos.length > 0) {
      try {
        const { fileName, content } = buildFileContent(todos);
        fs.writeFileSync(path.join(settings.saveFolder, fileName), content, 'utf8');
      } catch (e) {
        console.error('저장 실패:', e);
      }
    }
    app.quit();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

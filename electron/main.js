const { app, BrowserWindow, screen, ipcMain, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');

const isDev = process.env.NODE_ENV !== 'production';

const COLLAPSED = { width: 200, height: 200 };
const EXPANDED  = { width: 320, height: 480 };

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
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, '../build/index.html'));
  }

  // ── 드래그: main에서 커서 폴링 (창 밖에서도 끊기지 않음) ─────────────
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

  // ── 창 크기 조절 ──────────────────────────────────────────────────
  ipcMain.handle('set-window-size', (_, { width, height }) => {
    const [cx, cy] = win.getPosition();
    const [cw, ch] = win.getSize();
    // 현재 우측 하단 기준점 유지하며 확장/축소
    const newX = cx + cw - width;
    const newY = cy + ch - height;
    win.setSize(width, height);
    win.setPosition(newX, newY);
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

const path = require('node:path');
const { app, BrowserWindow, Menu, ipcMain, net, screen } = require('electron');
const { Settings } = require('./settings');
const { Store } = require('./store');
const { loadCodex, fetchClaude } = require('./sources');

const MARGIN = 16; // 카드 둘레의 그림자 영역
const PAGE_COUNT = 2;
const sizeFor = (compact) =>
  compact ? { width: 170 + MARGIN * 2, height: 82 + MARGIN * 2 } : { width: 180 + MARGIN * 2, height: 180 + MARGIN * 2 };

let win, settings, store, dragOffset;

function send() {
  if (!win || win.isDestroyed()) return;
  const { page, compact } = settings.values;
  win.webContents.send('state', { codex: store.codex, claude: store.claude, now: Date.now(), page, compact });
}

function initialPosition(size) {
  const { x, y } = settings.values;
  if (typeof x === 'number' && typeof y === 'number') {
    const a = screen.getDisplayMatching({ x, y, ...size }).workArea;
    const visible = x < a.x + a.width && x + size.width > a.x && y < a.y + a.height && y + size.height > a.y;
    if (visible) return { x, y };
  }
  const a = screen.getPrimaryDisplay().workArea;
  return { x: a.x + a.width - size.width - 20, y: a.y + 20 };
}

// 크기가 바뀌어도 왼쪽 위 모서리는 그대로 둔다
function setCompact(compact) {
  settings.set({ compact });
  const { x, y } = win.getBounds();
  win.setBounds({ x, y, ...sizeFor(compact) });
  send();
}

function setPage(page) {
  const next = Math.min(Math.max(page, 0), PAGE_COUNT - 1);
  if (next === settings.values.page) return;
  settings.set({ page: next });
  send();
}

function refreshAll() {
  store.refresh();
  store.refreshClaude(true);
}

function startupPath() {
  return { path: process.execPath };
}

function showMenu() {
  const { compact, alwaysOnTop } = settings.values;
  Menu.buildFromTemplate([
    { label: '새로고침', click: refreshAll },
    { label: compact ? '크게 보기' : '작게 보기', click: () => setCompact(!compact) },
    { type: 'separator' },
    {
      label: '항상 위에 표시', type: 'checkbox', checked: alwaysOnTop,
      click: (item) => {
        settings.set({ alwaysOnTop: item.checked });
        win.setAlwaysOnTop(item.checked, 'floating');
      },
    },
    {
      label: 'Windows 시작 시 실행', type: 'checkbox', visible: app.isPackaged,
      checked: app.getLoginItemSettings(startupPath()).openAtLogin,
      click: (item) => app.setLoginItemSettings({ ...startupPath(), openAtLogin: item.checked }),
    },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() },
  ]).popup({ window: win });
}

function createWindow() {
  const size = sizeFor(settings.values.compact);
  win = new BrowserWindow({
    ...size,
    ...initialPosition(size),
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.setAlwaysOnTop(settings.values.alwaysOnTop, 'floating');
  win.setMenu(null);
  win.webContents.once('did-finish-load', () => {
    send();
    win.showInactive();
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

function registerIpc() {
  ipcMain.on('go', (_e, delta) => setPage(settings.values.page + delta));
  ipcMain.on('set-page', (_e, page) => setPage(page));
  ipcMain.on('toggle-compact', () => setCompact(!settings.values.compact));
  ipcMain.on('menu', showMenu);
  ipcMain.on('drag-start', () => {
    const c = screen.getCursorScreenPoint();
    const b = win.getBounds();
    dragOffset = { x: c.x - b.x, y: c.y - b.y };
  });
  ipcMain.on('drag-move', () => {
    if (!dragOffset) return;
    const c = screen.getCursorScreenPoint();
    // setPosition은 배율이 적용된 화면에서 창 크기가 변할 수 있어 크기까지 고정한다
    win.setBounds({ x: c.x - dragOffset.x, y: c.y - dragOffset.y, ...sizeFor(settings.values.compact) });
  });
  ipcMain.on('drag-end', () => {
    dragOffset = null;
    const { x, y } = win.getBounds();
    settings.set({ x, y });
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(() => {
    settings = new Settings(path.join(app.getPath('userData'), 'settings.json'), {
      page: 0, compact: false, alwaysOnTop: true,
    });
    store = new Store({
      settings,
      loadCodex: () => loadCodex(),
      fetchClaude: () => fetchClaude(net.fetch),
      onChange: send,
    });
    registerIpc();
    createWindow();
    store.refresh();
    setInterval(() => store.refresh(), 60_000);
  });
  app.on('window-all-closed', () => app.quit());
}

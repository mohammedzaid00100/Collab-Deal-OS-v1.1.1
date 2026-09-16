const { app, BrowserWindow, shell } = require('electron');

const targetUrl = process.env.COLLAB_DEAL_OS_DEVELOPER_URL || 'http://localhost:3000/developer';

function offlineHtml() {
  const safeTarget = targetUrl.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  return `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html>
<html><head><meta charset="utf-8"><title>Collab Deal OS Developer Tool</title><style>
body{margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;background:#070b14;color:#e5e7eb;display:grid;place-items:center;min-height:100vh}.card{width:min(560px,calc(100% - 48px));background:#0f172a;border:1px solid #243041;border-radius:24px;padding:32px;box-shadow:0 30px 80px #0008}.k{color:#a78bfa;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}h1{margin:10px 0 8px;font-size:28px}p{color:#94a3b8;line-height:1.6}code{display:block;background:#020617;border:1px solid #1e293b;border-radius:12px;padding:12px;margin:18px 0;color:#cbd5e1;word-break:break-all}button{border:0;border-radius:12px;background:#7c3aed;color:#fff;font-weight:800;padding:12px 18px;cursor:pointer}
</style></head><body><main class="card"><div class="k">Collab Deal OS</div><h1>Developer Tool cannot reach the app</h1><p>Start the Collab Deal OS web server first, then retry. The Windows tool is a secure desktop shell around the internal developer dashboard, so backend secrets stay on the web server instead of being packed inside the EXE.</p><code>${safeTarget}</code><button onclick="location.href='${safeTarget}'">Retry connection</button></main></body></html>`)} `;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1050,
    minHeight: 700,
    title: 'Collab Deal OS Developer Tool',
    backgroundColor: '#070b14',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.removeMenu();
  win.loadURL(targetUrl);

  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const targetOrigin = new URL(targetUrl).origin;
      if (new URL(url).origin === targetOrigin) {
        win.loadURL(url);
      } else {
        void shell.openExternal(url);
      }
    } catch {
      // Ignore malformed navigation attempts.
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    try {
      const targetOrigin = new URL(targetUrl).origin;
      if (new URL(url).origin !== targetOrigin) {
        event.preventDefault();
        void shell.openExternal(url);
      }
    } catch {
      event.preventDefault();
    }
  });

  win.webContents.on('did-fail-load', (_event, _code, _description, _url, isMainFrame) => {
    if (isMainFrame && !win.isDestroyed()) void win.loadURL(offlineHtml());
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// To-Do desktop app — a native, self-contained local-first client.
//
// The full web UI is BUNDLED inside this app (ui/app.html) and served over a
// stable custom scheme (todoapp://), so the app opens and works with no server
// at all — your board lives locally and is operated locally. When you point it
// at a server (optional), the in-page layer syncs your local changes to the
// server's REST API whenever it's reachable. UI updates ship with the app via
// the built-in auto-updater — they no longer require updating the server.
// Also shows native OS notifications for task reminders.
const { app, BrowserWindow, Menu, shell, ipcMain, protocol, Notification, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const https = require("https");

app.setName("To-Do");

// Auto-update (packaged builds only; AppImage self-updates, deb/snap just notify).
let autoUpdater = null;
try { ({ autoUpdater } = require("electron-updater")); } catch (e) { /* dev mode */ }

protocol.registerSchemesAsPrivileged([
  { scheme: "todoapp", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

const CONFIG_PATH = () => path.join(app.getPath("userData"), "config.json");
const UI_PATH = () => path.join(__dirname, "ui", "app.html");

function loadConfig() { try { return JSON.parse(fs.readFileSync(CONFIG_PATH(), "utf8")); } catch { return {}; } }
function saveConfig(cfg) {
  try { fs.mkdirSync(app.getPath("userData"), { recursive: true }); fs.writeFileSync(CONFIG_PATH(), JSON.stringify(cfg, null, 2)); }
  catch (e) { console.error("config save failed", e); }
}

let win;
let config = loadConfig();
if (!config.seenReminders) config.seenReminders = {};

// ---- networking helpers (main process, for reminder polling only) ----
function fetchText(u, timeoutMs = 6000) {
  return new Promise((resolve) => {
    let lib;
    try { lib = u.startsWith("https") ? https : http; } catch { return resolve(null); }
    let req;
    try {
      req = lib.get(u, (res) => {
        if (res.statusCode >= 400) { res.resume(); return resolve(null); }
        let d = ""; res.setEncoding("utf8"); res.on("data", (c) => (d += c)); res.on("end", () => resolve(d));
      });
    } catch { return resolve(null); }
    req.on("error", () => resolve(null));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve(null); });
  });
}
async function fetchJson(u) { const t = await fetchText(u); if (!t) return null; try { return JSON.parse(t); } catch { return null; } }

// ---- bundled UI shell ----
// Inject the configured server URL (empty string = pure-local mode) so the
// in-page data layer knows where to sync. With no server, the page's relative
// API calls hit todoapp:// and fail fast (Response.error below) -> offline-first.
function injectBase(html, serverUrl) {
  const tag = `<script>window.__API_BASE__=${JSON.stringify(serverUrl || "")};</script>`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + tag);
  return tag + html;
}
function readUI() {
  try { return fs.readFileSync(UI_PATH(), "utf8"); }
  catch (e) { return "<!doctype html><meta charset=utf-8><body style='font-family:sans-serif;padding:2rem'>Bundled UI missing.</body>"; }
}
function loadApp() {
  // Always open the bundled board — works with or without a server configured.
  win.loadURL("todoapp://app/");
}

// ---- native reminder notifications (only when a server is configured) ----
function utcNow() { return new Date().toISOString().slice(0, 19).replace("T", " "); }
function utcMinus(hours) { return new Date(Date.now() - hours * 3600e3).toISOString().slice(0, 19).replace("T", " "); }

async function checkReminders() {
  if (!config.serverUrl || !Notification.isSupported()) return;
  const st = await fetchJson(config.serverUrl.replace(/\/+$/, "") + "/api/state?archived=1");
  if (!st || !Array.isArray(st.tasks)) return;
  const doneCols = new Set((st.columns || []).filter((c) => c.is_done).map((c) => c.id));
  const projById = {}; for (const p of st.projects || []) projById[p.id] = p;
  const now = utcNow(), cutoff = utcMinus(12);
  let changed = false;
  for (const t of st.tasks) {
    if (t.archived || !t.reminder_at || doneCols.has(t.column_id)) continue;
    if (t.reminder_at > now) continue;                 // not due yet (UTC string compare)
    const key = t.id + "|" + t.reminder_at;
    if (config.seenReminders[key]) continue;
    config.seenReminders[key] = true; changed = true;
    if (t.reminder_at >= cutoff) {                     // recent enough to surface (skip old backlog)
      const proj = projById[t.project_id];
      const tkey = (proj && proj.key ? proj.key : "TASK") + "-" + t.id;
      const n = new Notification({
        title: "Reminder: " + t.title,
        body: tkey + (t.due_date ? "  ·  due " + t.due_date : "") + (proj ? "  ·  " + proj.name : ""),
        silent: false,
      });
      n.on("click", () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
      n.show();
    }
  }
  if (changed) {
    const keys = Object.keys(config.seenReminders);
    if (keys.length > 500) for (const k of keys.slice(0, keys.length - 500)) delete config.seenReminders[k];
    saveConfig(config);
  }
}
let reminderTimer = null;
function startReminderWatcher() {
  if (reminderTimer) clearInterval(reminderTimer);
  setTimeout(checkReminders, 5000);
  reminderTimer = setInterval(checkReminders, 60000);
}

// ---- auto-update (packaged builds; AppImage self-updates, deb/snap notify) ----
function setupAutoUpdate() {
  if (!autoUpdater || !app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.on("update-downloaded", (info) => {
    if (!win) return;
    dialog.showMessageBox(win, {
      type: "info", buttons: ["Restart now", "Later"], defaultId: 0, cancelId: 1,
      title: "Update ready",
      message: `To-Do ${info.version} has been downloaded.`,
      detail: "Restart to finish installing the update.",
    }).then((r) => { if (r.response === 0) autoUpdater.quitAndInstall(); });
  });
  autoUpdater.on("error", (e) => console.error("update error", e));
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});            // on launch
  setInterval(() => autoUpdater.checkForUpdatesAndNotify().catch(() => {}), 6 * 3600e3);  // and every 6h
}
async function checkForUpdatesInteractive() {
  if (!autoUpdater || !app.isPackaged) {
    dialog.showMessageBox(win, { type: "info", message: "Updates apply to installed builds only.",
      detail: "Running from source uses your local code." });
    return;
  }
  try {
    const r = await autoUpdater.checkForUpdates();
    const v = r && r.updateInfo && r.updateInfo.version;
    if (v && v !== app.getVersion()) {
      dialog.showMessageBox(win, { type: "info", message: `Update available: ${v}`,
        detail: "Downloading in the background; you'll be prompted to restart when it's ready." });
    } else {
      dialog.showMessageBox(win, { type: "info", message: "You're up to date.", detail: `Version ${app.getVersion()}` });
    }
  } catch (e) {
    dialog.showMessageBox(win, { type: "warning", message: "Couldn't check for updates.", detail: String((e && e.message) || e) });
  }
}

// ---- window ----
function createWindow() {
  const b = config.bounds || { width: 1200, height: 820 };
  win = new BrowserWindow({
    width: b.width, height: b.height, x: b.x, y: b.y,
    minWidth: 380, minHeight: 480, backgroundColor: "#16181d", title: "To-Do",
    icon: path.join(__dirname, "icon.png"),   // window/taskbar icon (esp. Linux)
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, spellcheck: true },
  });
  loadApp();
  const persistBounds = () => { if (win) { config.bounds = win.getBounds(); saveConfig(config); } };
  win.on("resize", persistBounds);
  win.on("move", persistBounds);
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => {
    if (url.startsWith("todoapp://") || url.startsWith("file://")) return;
    e.preventDefault(); shell.openExternal(url);
  });
  win.on("closed", () => { win = null; });
}

function showSetup() { if (win) win.loadFile(path.join(__dirname, "setup.html")); }

ipcMain.handle("get-server-url", () => config.serverUrl || "");
ipcMain.handle("save-server-url", async (_e, url) => {
  url = String(url || "").trim().replace(/\/+$/, "");
  if (url && !/^https?:\/\//i.test(url)) return { ok: false, error: "Enter a full http(s):// URL" };
  config.serverUrl = url; saveConfig(config);   // empty url is allowed = pure-local mode
  loadApp(); startReminderWatcher();
  return { ok: true };
});
ipcMain.handle("retry", async () => { loadApp(); return true; });

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    { label: "File", submenu: [
      { label: "Sync Server…", accelerator: "CmdOrCtrl+,", click: showSetup },
      { label: "Check for Updates…", click: checkForUpdatesInteractive },
      { type: "separator" },
      isMac ? { role: "close" } : { role: "quit" },
    ] },
    { role: "editMenu" },
    { label: "View", submenu: [
      { label: "Reload", accelerator: "CmdOrCtrl+R", click: () => loadApp() },
      { role: "forceReload" }, { role: "toggleDevTools" }, { type: "separator" },
      { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" },
      { role: "togglefullscreen" },
    ] },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  protocol.handle("todoapp", (req) => {
    const { pathname } = new URL(req.url);
    if (pathname === "/" || pathname === "" || pathname === "/index.html") {
      const html = injectBase(readUI(), config.serverUrl || "");
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    // Relative /api/* and /healthz only reach here in pure-local mode (no server
    // configured); fail like a real network error so the page goes local-first.
    return Response.error();
  });
  buildMenu();
  createWindow();
  startReminderWatcher();
  setupAutoUpdate();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

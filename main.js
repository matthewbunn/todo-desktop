// To-Do desktop app — a native shell around the self-hosted web UI.
//
// Offline-first: the UI is cached locally and served over a stable custom scheme
// (todoapp://), so the app opens and works even when the server is unreachable.
// The page talks to the server's REST API at the configured address; when that's
// down, the in-page layer stores changes locally and syncs them when it returns.
// Also shows native OS notifications for task reminders.
// No server address is bundled — you enter it on first launch.
const { app, BrowserWindow, Menu, shell, ipcMain, protocol, Notification } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const https = require("https");

app.setName("To-Do");

protocol.registerSchemesAsPrivileged([
  { scheme: "todoapp", privileges: { standard: true, secure: false, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

const CONFIG_PATH = () => path.join(app.getPath("userData"), "config.json");
const SHELL_PATH = () => path.join(app.getPath("userData"), "shell.html");

function loadConfig() { try { return JSON.parse(fs.readFileSync(CONFIG_PATH(), "utf8")); } catch { return {}; } }
function saveConfig(cfg) {
  try { fs.mkdirSync(app.getPath("userData"), { recursive: true }); fs.writeFileSync(CONFIG_PATH(), JSON.stringify(cfg, null, 2)); }
  catch (e) { console.error("config save failed", e); }
}

let win;
let config = loadConfig();
if (!config.seenReminders) config.seenReminders = {};

// ---- networking helpers (main process) ----
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

// ---- offline-capable local shell ----
function injectBase(html, serverUrl) {
  const tag = `<script>window.__API_BASE__=${JSON.stringify(serverUrl)};</script>`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + tag);
  return tag + html;
}
async function ensureShell() {
  if (config.serverUrl) {
    const html = await fetchText(config.serverUrl.replace(/\/+$/, "") + "/");
    if (html && /<\/html>/i.test(html)) { try { fs.writeFileSync(SHELL_PATH(), injectBase(html, config.serverUrl)); } catch (e) {} }
  }
  return fs.existsSync(SHELL_PATH());
}
async function loadApp() {
  if (!config.serverUrl) { win.loadFile(path.join(__dirname, "setup.html")); return; }
  const ready = await ensureShell();
  if (ready) win.loadURL("todoapp://app/");
  else win.loadFile(path.join(__dirname, "error.html"));
}

// ---- native reminder notifications ----
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
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: "Enter a full http(s):// URL" };
  config.serverUrl = url; saveConfig(config);
  await loadApp(); startReminderWatcher();
  return { ok: true };
});
ipcMain.handle("retry", async () => { await loadApp(); return true; });

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    { label: "File", submenu: [
      { label: "Change Server URL…", accelerator: "CmdOrCtrl+,", click: showSetup },
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
  protocol.handle("todoapp", () => {
    try {
      const html = fs.readFileSync(SHELL_PATH(), "utf8");
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    } catch {
      return new Response("Shell not cached yet — connect to the server once.", { status: 404 });
    }
  });
  buildMenu();
  createWindow();
  startReminderWatcher();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

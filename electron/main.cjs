// NAWAT Desktop — Electron main process (local layer).
// Runs the UI and exposes native capabilities the browser cannot do:
// real filesystem, PowerShell/bash, SSH, and local Ollama control.

const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { exec } = require("node:child_process");
require("./ssh.cjs").register();

const DEV_URL = process.env.NAWAT_DEV_URL || "http://localhost:8080";
const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 950,
    minWidth: 1100,
    backgroundColor: "#111a2b",
    title: "NAWAT Desktop",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL(DEV_URL);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ---------- filesystem ----------
ipcMain.handle("fs:readDir", async (_e, dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.map((d) => ({
    path: path.join(dir, d.name),
    type: d.isDirectory() ? "dir" : "file",
  }));
});
ipcMain.handle("fs:readFile", (_e, p) => fs.readFile(p, "utf8"));
ipcMain.handle("fs:writeFile", async (_e, p, content) => {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, "utf8");
});
ipcMain.handle("fs:mkdir", (_e, p) => fs.mkdir(p, { recursive: true }));
ipcMain.handle("fs:rename", (_e, from, to) => fs.rename(from, to));
ipcMain.handle("fs:remove", (_e, p) => fs.rm(p, { recursive: true, force: true }));
ipcMain.handle("dialog:openFolder", async () => {
  const r = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  return r.canceled ? null : r.filePaths[0];
});

// ---------- shell (PowerShell / bash) ----------
ipcMain.handle("shell:exec", (_e, cmd, opts = {}) => {
  const shell =
    opts.shell === "bash"
      ? "/bin/bash"
      : process.platform === "win32"
        ? "powershell.exe"
        : "/bin/bash";
  return new Promise((resolve) => {
    exec(
      cmd,
      { cwd: opts.cwd || app.getPath("home"), shell, timeout: 120000 },
      (err, stdout, stderr) => {
        resolve([stdout, stderr, err ? String(err.message) : ""].filter(Boolean).join("\n").trim());
      },
    );
  });
});

// ---------- ollama ----------
ipcMain.handle("ollama:host", () => process.env.OLLAMA_HOST || "http://127.0.0.1:11434");

// السماح بالميكروفون لصفحة Speed Build والمحادثة الصوتية
app.whenReady().then(() => {
  const { session } = require("electron");
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === "media" || perm === "microphone" || perm === "audioCapture"));
  session.defaultSession.setPermissionCheckHandler((_wc, perm) => perm === "media" || perm === "microphone" || perm === "audioCapture");
});

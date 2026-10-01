// NAWAT Studio Desktop — processus principal Electron.
// Charge l'interface buildée (renderer/index.html) et expose les capacités
// natives : système de fichiers réel, PowerShell/bash, hôte Ollama.

const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { exec } = require("node:child_process");
require("./ssh.cjs").register();

const DEV_URL = process.env.NAWAT_DEV_URL || "";
let mainWindow = null;

function buildMenu() {
  const template = [
    {
      label: "ملف",
      submenu: [
        {
          label: "فتح مجلد…",
          accelerator: "CmdOrCtrl+O",
          click: () => mainWindow?.webContents.send("menu:open-folder"),
        },
        { type: "separator" },
        { role: "quit", label: "خروج" },
      ],
    },
    {
      label: "تحرير",
      submenu: [
        { role: "undo", label: "تراجع" },
        { role: "redo", label: "إعادة" },
        { type: "separator" },
        { role: "cut", label: "قص" },
        { role: "copy", label: "نسخ" },
        { role: "paste", label: "لصق" },
        { role: "selectAll", label: "تحديد الكل" },
      ],
    },
    {
      label: "عرض",
      submenu: [
        { role: "reload", label: "تحديث" },
        { role: "forceReload", label: "تحديث كامل" },
        { role: "toggleDevTools", label: "أدوات المطوّر" },
        { type: "separator" },
        { role: "resetZoom", label: "حجم أصلي" },
        { role: "zoomIn", label: "تكبير" },
        { role: "zoomOut", label: "تصغير" },
        { role: "togglefullscreen", label: "ملء الشاشة" },
      ],
    },
    {
      label: "مساعدة",
      submenu: [
        {
          label: "دليل الاستخدام",
          click: () => shell.openExternal("https://groupe-hn-ai.lovable.app"),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    backgroundColor: "#111827",
    title: "NAWAT Studio",
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Priorité : NAWAT_DEV_URL → renderer/index.html local → version publiée.
  const localIndex = path.join(__dirname, "renderer", "index.html");
  const APP_URL = process.env.NAWAT_URL || "https://studio-nawat.lovable.app";
  if (DEV_URL) mainWindow.loadURL(DEV_URL);
  else if (require("node:fs").existsSync(localIndex)) mainWindow.loadFile(localIndex);
  else mainWindow.loadURL(APP_URL);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  buildMenu();
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

// ---------- shell ----------
ipcMain.handle("shell:exec", (_e, cmd, opts = {}) => {
  const shellBin =
    opts.shell === "bash"
      ? "/bin/bash"
      : process.platform === "win32"
        ? "powershell.exe"
        : "/bin/bash";
  return new Promise((resolve) => {
    exec(
      cmd,
      { cwd: opts.cwd || app.getPath("home"), shell: shellBin, timeout: 120000 },
      (err, stdout, stderr) => {
        resolve(
          [stdout, stderr, err ? String(err.message) : ""].filter(Boolean).join("\n").trim(),
        );
      },
    );
  });
});

// ---------- ollama ----------
ipcMain.handle("ollama:host", () => process.env.OLLAMA_HOST || "http://127.0.0.1:11434");

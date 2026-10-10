// NAWAT Code — desktop shell (AR / FR / EN). Loads the studio from the LAN server first,
// then the official site; falls back to a local launcher page when offline.
const { app, BrowserWindow, shell, Menu, session } = require("electron");
const http = require("http");
const path = require("path");

const TARGETS = [
  "http://127.0.0.1:3120/workspace",
  "http://192.168.100.67:8084/workspace",
  "https://nawat.groupe-hn.com/workspace",
  "https://hn-ai.site/workspace",
];
const L = {
  ar: { file: "ملف", view: "عرض", lang: "اللغة", reload: "إعادة التحميل", tools: "أدوات المطوّر", full: "ملء الشاشة", quit: "خروج", home: "البداية" },
  fr: { file: "Fichier", view: "Affichage", lang: "Langue", reload: "Recharger", tools: "Outils développeur", full: "Plein écran", quit: "Quitter", home: "Accueil" },
  en: { file: "File", view: "View", lang: "Language", reload: "Reload", tools: "Developer tools", full: "Full screen", quit: "Quit", home: "Home" },
};
let lang = "ar";
let win;

const reachable = (u) => new Promise((ok) => {
  if (!u.startsWith("http://")) {
    require("https").get(u, { timeout: 3000 }, (r) => { r.resume(); ok(true); }).on("error", () => ok(false));
    return;
  }
  const r = http.get(u, { timeout: 1500 }, (res) => { res.resume(); ok(true); });
  r.on("error", () => ok(false));
  r.on("timeout", () => { r.destroy(); ok(false); });
});

async function openStudio() {
  for (const u of TARGETS) if (await reachable(u)) return win.loadURL(u + (u.includes("?") ? "&" : "?") + "lang=" + lang);
  win.loadFile(path.join(__dirname, "launcher.html"), { query: { lang } });
}

function buildMenu() {
  const t = L[lang];
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: t.file, submenu: [{ label: t.home, click: openStudio }, { type: "separator" }, { label: t.quit, role: "quit" }] },
    { label: t.view, submenu: [{ label: t.reload, role: "reload" }, { label: t.tools, role: "toggleDevTools" }, { label: t.full, role: "togglefullscreen" }] },
    { label: t.lang, submenu: [["ar", "العربية"], ["fr", "Français"], ["en", "English"]].map(([k, n]) => ({
      label: n, type: "radio", checked: lang === k,
      click: () => { lang = k; buildMenu(); win.webContents.executeJavaScript(`localStorage.setItem("nawat.lang","${k}")`).catch(() => {}); openStudio(); },
    })) },
  ]));
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_w, p, cb) => cb(["media", "microphone", "audioCapture", "clipboard-read"].includes(p)));
  win = new BrowserWindow({
    width: 1480, height: 920, title: "NAWAT Code", icon: path.join(__dirname, "icon.png"),
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  buildMenu();
  openStudio();
});
app.on("window-all-closed", () => app.quit());

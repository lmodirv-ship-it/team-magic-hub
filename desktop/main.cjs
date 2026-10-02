// NAWAT Desktop — غلاف خفيف يفتح نواة من السيرفر المحلي أو العنوان الرسمي.
// كل تعديل يُنشر يظهر تلقائيًا لأن الواجهة تُحمَّل من الخادم مباشرة.
const { app, BrowserWindow, shell } = require("electron");
const http = require("http");
const URLS = ["http://192.168.100.67:8084/workspace", "https://nawat.groupe-hn.com/workspace"];
const reachable = (u) => new Promise((ok) => {
  if (!u.startsWith("http://")) return ok(true);
  const r = http.get(u, { timeout: 1500 }, (res) => { res.resume(); ok(true); });
  r.on("error", () => ok(false)); r.on("timeout", () => { r.destroy(); ok(false); });
});
async function create() {
  const win = new BrowserWindow({ width: 1440, height: 900, title: "NAWAT Studio", autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false } });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  for (const u of URLS) if (await reachable(u)) return win.loadURL(u);
  win.loadURL(URLS[1]);
}
app.whenReady().then(create);
app.on("window-all-closed", () => app.quit());

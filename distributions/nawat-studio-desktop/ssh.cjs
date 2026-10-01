// NAWAT — SSH حقيقي عبر ssh2 (جلسات متعددة، تنفيذ أوامر، قائمة ملفات SFTP).
const { ipcMain } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const sessions = new Map();
let seq = 0;

function register() {
  ipcMain.handle("ssh:connect", (_e, cfg) => {
    const { Client } = require("ssh2");
    return new Promise((resolve, reject) => {
      const conn = new Client();
      const id = `ssh-${++seq}`;
      const opts = {
        host: cfg.host,
        port: Number(cfg.port) || 22,
        username: cfg.username,
        readyTimeout: 15000,
      };
      if (cfg.password) opts.password = cfg.password;
      const keyPath = cfg.keyPath
        ? cfg.keyPath.replace(/^~/, os.homedir())
        : path.join(os.homedir(), ".ssh", "id_rsa");
      if (!cfg.password && fs.existsSync(keyPath)) opts.privateKey = fs.readFileSync(keyPath);
      if (cfg.passphrase) opts.passphrase = cfg.passphrase;
      conn
        .on("ready", () => {
          sessions.set(id, conn);
          resolve(id);
        })
        .on("error", (err) => reject(new Error(err.message)))
        .on("close", () => sessions.delete(id))
        .connect(opts);
    });
  });

  ipcMain.handle("ssh:exec", (_e, id, cmd) => {
    const conn = sessions.get(id);
    if (!conn) throw new Error("الجلسة غير موجودة — أعد الاتصال");
    return new Promise((resolve, reject) => {
      conn.exec(cmd, (err, stream) => {
        if (err) return reject(new Error(err.message));
        let out = "";
        stream
          .on("data", (d) => (out += d))
          .stderr.on("data", (d) => (out += d));
        stream.on("close", (code) => resolve(`${out.trimEnd()}${code ? `\n[exit ${code}]` : ""}`));
      });
    });
  });

  ipcMain.handle("ssh:list", (_e, id, dir) => {
    const conn = sessions.get(id);
    if (!conn) throw new Error("الجلسة غير موجودة");
    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) return reject(new Error(err.message));
        sftp.readdir(dir || ".", (e2, list) => {
          if (e2) return reject(new Error(e2.message));
          resolve(
            list.map((f) => ({
              name: f.filename,
              size: f.attrs.size,
              dir: (f.attrs.mode & 0o170000) === 0o040000,
            })),
          );
        });
      });
    });
  });

  ipcMain.handle("ssh:disconnect", (_e, id) => {
    sessions.get(id)?.end();
    sessions.delete(id);
  });
}

module.exports = { register };

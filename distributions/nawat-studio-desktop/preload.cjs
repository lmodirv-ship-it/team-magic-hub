const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nawat", {
  platform: process.platform,
  fs: {
    readDir: (p) => ipcRenderer.invoke("fs:readDir", p),
    readFile: (p) => ipcRenderer.invoke("fs:readFile", p),
    writeFile: (p, c) => ipcRenderer.invoke("fs:writeFile", p, c),
    mkdir: (p) => ipcRenderer.invoke("fs:mkdir", p),
    rename: (from, to) => ipcRenderer.invoke("fs:rename", from, to),
    remove: (p) => ipcRenderer.invoke("fs:remove", p),
    openFolder: () => ipcRenderer.invoke("dialog:openFolder"),
  },
  shell: {
    exec: (cmd, opts) => ipcRenderer.invoke("shell:exec", cmd, opts),
  },
  ssh: {
    connect: (cfg) => ipcRenderer.invoke("ssh:connect", cfg),
    exec: (id, cmd) => ipcRenderer.invoke("ssh:exec", id, cmd),
    list: (id, dir) => ipcRenderer.invoke("ssh:list", id, dir),
    disconnect: (id) => ipcRenderer.invoke("ssh:disconnect", id),
  },
  ollama: {
    host: () => ipcRenderer.invoke("ollama:host"),
  },
  onMenu: (channel, cb) => ipcRenderer.on(channel, cb),
});

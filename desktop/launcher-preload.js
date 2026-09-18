const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("launcher", {
  launch: target => ipcRenderer.invoke("launcher:launch", target),
  quit: () => ipcRenderer.invoke("launcher:quit")
});

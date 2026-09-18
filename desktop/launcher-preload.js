const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("launcher", {
  language: value => ipcRenderer.invoke("launcher:language", value),
  launch: target => ipcRenderer.invoke("launcher:launch", target),
  quit: () => ipcRenderer.invoke("launcher:quit")
});

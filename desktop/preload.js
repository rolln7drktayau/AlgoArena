const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("algoarenaDesktop", {
  setLanguage: value => ipcRenderer.invoke("studio:language", value),
  version: "3.0.1",
  onStartupInfo: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("algoarena:startup-info", listener);
    return () => {
      ipcRenderer.removeListener("algoarena:startup-info", listener);
    };
  }
});

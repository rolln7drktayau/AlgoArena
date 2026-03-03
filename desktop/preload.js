const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("algoarenaDesktop", {
  version: "1.0.0",
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

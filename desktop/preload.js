const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("algoarenaDesktop", {
  version: "1.0.0"
});

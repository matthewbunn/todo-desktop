// Minimal, safe bridge for the setup/error pages only.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("todo", {
  getServerUrl: () => ipcRenderer.invoke("get-server-url"),
  saveServerUrl: (url) => ipcRenderer.invoke("save-server-url", url),
  retry: () => ipcRenderer.invoke("retry"),
});

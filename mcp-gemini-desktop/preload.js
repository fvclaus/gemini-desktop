// preload.js
const {contextBridge, ipcRenderer} = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getPythonPort: () => ipcRenderer.invoke("get-python-port"),
  showOpenDialog: () => ipcRenderer.invoke("show-open-dialog"),
  openSettingsDialog: () => ipcRenderer.invoke("open-settings-dialog"),
  onApiKeyUpdate: (callback) =>
    ipcRenderer.on("api-key-update-status", (event, ...args) =>
      callback(...args)
    ),
});

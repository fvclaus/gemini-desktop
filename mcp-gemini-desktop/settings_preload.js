// settings_preload.js
const {contextBridge, ipcRenderer} = require("electron");

contextBridge.exposeInMainWorld("settingsAPI", {
  saveKey: (key) => ipcRenderer.send("save-api-key", key),
  closeDialog: () => ipcRenderer.send("close-settings-dialog"),
});

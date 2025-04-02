// settings_preload.js
const {contextBridge, ipcRenderer} = require("electron");

contextBridge.exposeInMainWorld("settingsAPI", {
  saveKey: (key) => ipcRenderer.send("save-api-key", key),
  closeDialog: () => ipcRenderer.send("close-settings-dialog"),
  // Model switching functions
  listModels: () => ipcRenderer.invoke("list-models"),
  getModel: () => ipcRenderer.invoke("get-model"),
  setModel: (modelName) => ipcRenderer.invoke("set-model", modelName),
});

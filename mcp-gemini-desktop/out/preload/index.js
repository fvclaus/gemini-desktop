"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  getPythonPort: () => electron.ipcRenderer.invoke("get-python-port"),
  readFileContent: (filePath) => electron.ipcRenderer.invoke("read-file-content", filePath),
  showOpenDialog: (options) => electron.ipcRenderer.invoke("show-open-dialog", options),
  changeWorkspaceAndReload: () => electron.ipcRenderer.invoke("change-workspace-and-reload"),
  getInitialWorkspace: () => electron.ipcRenderer.invoke("get-initial-workspace"),
  // Listener for workspace selection/changes
  onWorkspaceSelected: (callback) => {
    const handler = (event, path) => callback(path);
    electron.ipcRenderer.on("workspace-selected", handler);
  },
  onApiKeyUpdate: (callback) => electron.ipcRenderer.on(
    "api-key-update-status",
    (event, ...args) => callback(...args)
  ),
  // Model switching APIs (ensure these are still needed and correctly exposed)
  listModels: () => electron.ipcRenderer.invoke("list-models"),
  getModel: () => electron.ipcRenderer.invoke("get-model"),
  setModel: (modelName) => electron.ipcRenderer.invoke("set-model", modelName),
  onModelUpdateStatus: (callback) => electron.ipcRenderer.on("model-update-status", (event, ...args) => callback(...args))
});

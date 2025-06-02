// preload.js
const {contextBridge, ipcRenderer} = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getPythonPort: () => ipcRenderer.invoke("get-python-port"),
  openSettingsDialog: () => ipcRenderer.invoke("open-settings-dialog"),
  readFileContent: (filePath) => ipcRenderer.invoke("read-file-content", filePath),
  showOpenDialog: (options) => ipcRenderer.invoke("show-open-dialog", options),

  changeWorkspaceAndReload: () => ipcRenderer.invoke("change-workspace-and-reload"),
  
  getInitialWorkspace: () => ipcRenderer.invoke("get-initial-workspace"),
  // Listener for workspace selection/changes
  onWorkspaceSelected: (callback) => {
    const handler = (event, path) => callback(path);
    ipcRenderer.on("workspace-selected", handler);
    // return () => ipcRenderer.removeListener("workspace-selected", handler);
  },

  onApiKeyUpdate: (callback) =>
    ipcRenderer.on("api-key-update-status", (event, ...args) =>
      callback(...args)
    ),
  // Model switching APIs (ensure these are still needed and correctly exposed)
  listModels: () => ipcRenderer.invoke("list-models"),
  getModel: () => ipcRenderer.invoke("get-model"),
  setModel: (modelName) => ipcRenderer.invoke("set-model", modelName),
  onModelUpdateStatus: (callback) =>
    ipcRenderer.on("model-update-status", (event, ...args) => callback(...args)),

});

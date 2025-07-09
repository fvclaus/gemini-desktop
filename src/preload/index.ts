import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  showOpenDialog: (options) => ipcRenderer.invoke("show-open-dialog", options),

  changeWorkspaceAndReload: () =>
    ipcRenderer.invoke("change-workspace-and-reload"),

  getInitialWorkspace: () => ipcRenderer.invoke("get-initial-workspace"),
  // Listener for workspace selection/changes
  onWorkspaceSelected: (callback) => {
    const handler = (event, path) => callback(path);
    ipcRenderer.on("workspace-selected", handler);
    // return () => ipcRenderer.removeListener("workspace-selected", handler);
  },
  setModel: (modelName) => ipcRenderer.invoke("set-model", modelName),
  onModelUpdateStatus: (callback) =>
    ipcRenderer.on("model-update-status", (event, ...args) =>
      callback(...args),
    ),

  onMcpServerStatus: (callback) => {
    ipcRenderer.on("mcp-server-status", (event, ...args) => callback(...args));
  },
  getMcpServers: () => ipcRenderer.invoke("get-mcp-servers"),
  callMcpTool: (serverName, toolName, params) =>
    ipcRenderer.invoke("call-mcp-tool", { serverName, toolName, params }),
  setToolVisibility: (serverName, toolName, hidden) =>
    ipcRenderer.invoke("set-tool-visibility", serverName, toolName, hidden),
});

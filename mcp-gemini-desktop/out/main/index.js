"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const electron = require("electron");
const path = require("path");
const fs = require("fs/promises");
const __Store = require("electron-store");
const Store = __Store.default || __Store;
console.log(Store);
const store = new Store();
let mainWindow;
const pythonPort = 5001;
function createWindow() {
  console.log("[createWindow] Attempting to create main window...");
  mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    // Initially hide the window
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 15, y: 15 },
    minWidth: 800,
    minHeight: 600,
    title: "GemCP Chat",
    // backgroundColor: "#fdfcf7", // Let the Angular app's theme define background
    icon: path.join(
      __dirname,
      "assets",
      electron.app.isPackaged ? "icon.png" : "icon.png"
    )
    // Optional: set icon for window itself
  });
  console.log("[createWindow] BrowserWindow created.");
  async function loadContent() {
    const isDev = process.env.NODE_ENV === "development";
    let loadPromise;
    if (isDev) {
      console.log("[createWindow] Development mode: Attempting to load URL http://localhost:4200");
      loadPromise = mainWindow.loadURL("http://localhost:4200");
    } else {
      const indexPath = path.join(__dirname, "angular-frontend/dist/angular-frontend/browser/index.html");
      console.log(`[createWindow] Production mode: Attempting to load file: ${indexPath}`);
      loadPromise = mainWindow.loadFile(indexPath);
    }
    try {
      await loadPromise;
      console.log("[createWindow] Content loaded successfully.");
      mainWindow.maximize();
      mainWindow.show();
      console.log("[createWindow] mainWindow.show() called after content load.");
      if (isDev || !electron.app.isPackaged) {
        mainWindow.webContents.openDevTools();
      }
    } catch (err) {
      console.error("[createWindow] Error loading content:", err);
      electron.dialog.showErrorBox(
        "Loading Error",
        `Failed to load application content: ${err.message}`
      );
      electron.app.quit();
    }
  }
  loadContent();
  mainWindow.on("closed", () => {
    console.log("[createWindow] Main window closed.");
    mainWindow = null;
  });
  mainWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription, validatedURL) => {
      console.error(
        `[createWindow] Failed to load URL: ${validatedURL}, Error Code: ${errorCode}, Description: ${errorDescription}`
      );
    }
  );
}
electron.app.whenReady().then(() => {
  console.log("[app.whenReady] App ready. Calling createWindow...");
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("quit", () => {
  console.log("[app.quit] App quitting.");
});
electron.ipcMain.handle("get-python-port", async () => {
  return pythonPort;
});
electron.ipcMain.handle("get-initial-workspace", async () => {
  console.log("[get-initial-workspace] Renderer requested initial workspace path.");
  const currentWorkspace = store.get("lastOpenedWorkspace");
  if (currentWorkspace) {
    try {
      const stats = await fs.stat(currentWorkspace);
      if (stats.isDirectory()) {
        console.log(`[get-initial-workspace] Returning stored workspace: ${currentWorkspace}`);
        return currentWorkspace;
      } else {
        console.log(`[get-initial-workspace] Stored workspace path '${currentWorkspace}' is not a directory. Clearing and returning null.`);
        store.delete("lastOpenedWorkspace");
        return null;
      }
    } catch (error) {
      console.warn(`[get-initial-workspace] Error verifying stored workspace '${currentWorkspace}'. Clearing and returning null:`, error.message);
      store.delete("lastOpenedWorkspace");
      return null;
    }
  } else {
    console.log("[get-initial-workspace] No workspace stored. Returning null.");
    return null;
  }
});
electron.ipcMain.handle("change-workspace-and-reload", async () => {
  console.log("[change-workspace-and-reload] User requested to change workspace.");
  if (!mainWindow) {
    console.error("[change-workspace-and-reload] mainWindow is not available.");
    return null;
  }
  const result = await electron.dialog.showOpenDialog(mainWindow, {
    selectionType: "directory",
    title: "Select New Workspace Folder"
  });
  if (result.canceled) {
    console.log("[change-workspace-and-reload] User canceled workspace selection.");
    return store.get("lastOpenedWorkspace");
  }
  const newWorkspacePath = result.filePath;
  const oldWorkspacePath = store.get("lastOpenedWorkspace");
  if (newWorkspacePath !== oldWorkspacePath) {
    store.set("lastOpenedWorkspace", newWorkspacePath);
    console.log(`[change-workspace-and-reload] Workspace changed to: ${newWorkspacePath}. Reloading app.`);
    mainWindow.webContents.send("workspace-selected", newWorkspacePath);
    mainWindow.reload();
    return newWorkspacePath;
  } else {
    console.log(`[change-workspace-and-reload] Selected workspace is the same as current. No change.`);
    return oldWorkspacePath;
  }
});
electron.ipcMain.handle("read-file-content", async (event, filePath) => {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("Invalid file path provided.");
  }
  try {
    console.log(`[read-file-content] Reading file: ${filePath}`);
    const content = await fs.readFile(filePath, "utf-8");
    return content;
  } catch (error) {
    console.error(`[read-file-content] Error reading file ${filePath}:`, error);
    throw new Error(`Failed to read file: ${error.message}`);
  }
});
electron.ipcMain.handle("show-open-dialog", async (event, options) => {
  if (!mainWindow) {
    throw new Error("Main window is not available to show dialog.");
  }
  if (!options || typeof options !== "object") {
    throw new Error("Invalid options provided for dialog.");
  }
  const { title, filters, selectionType = "file" } = options;
  if (typeof title !== "string" || !title) {
    throw new Error("A valid title must be provided for the dialog.");
  }
  if (selectionType !== "file" && selectionType !== "directory") {
    throw new Error("Invalid selectionType. Must be 'file' or 'directory'.");
  }
  const dialogProperties = [];
  if (selectionType === "file") {
    dialogProperties.push("openFile");
  } else {
    dialogProperties.push("openDirectory");
  }
  const dialogOptions = {
    title,
    properties: dialogProperties
  };
  if (selectionType === "file") {
    if (!Array.isArray(filters) || filters.some((f) => typeof f.name !== "string" || !Array.isArray(f.extensions))) {
      throw new Error("Valid filters (name and extensions array) must be provided for file selection.");
    }
    dialogOptions.filters = filters;
  }
  try {
    const result = await electron.dialog.showOpenDialog(mainWindow, dialogOptions);
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, path: null };
    } else {
      const selectedPath = result.filePaths[0];
      return { canceled: false, path: selectedPath };
    }
  } catch (error) {
    throw new Error(`Failed to show open file dialog: ${error.message}`);
  }
});
exports.Store = Store;

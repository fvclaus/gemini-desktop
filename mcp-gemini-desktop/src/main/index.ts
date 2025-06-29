import {app, BrowserWindow, ipcMain, dialog} from "electron";
import path, { join } from "path";
import fs from "fs/promises";
import fetch from "node-fetch";
// https://github.com/sindresorhus/electron-store/issues/289
import __Store from 'electron-store'
export const Store = __Store.default || __Store

console.log(Store);
const store = new Store();
let mainWindow!: BrowserWindow;
const pythonPort = 5001;

function createWindow() {
  console.log("[createWindow] Attempting to create main window...");
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Initially hide the window
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: "hidden",
    trafficLightPosition: {x: 15, y: 15},
    minWidth: 800,
    minHeight: 600,
    title: "GemCP Chat",
    // backgroundColor: "#fdfcf7", // Let the Angular app's theme define background
    icon: path.join(
      __dirname,
      "assets",
      app.isPackaged ? "icon.png" : "icon.png"
    ), // Optional: set icon for window itself
  });
  
  console.log("[createWindow] BrowserWindow created.");

  async function loadContent() {
    const isDev = process.env.NODE_ENV === 'development';
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
      mainWindow.show(); // Show window after content is loaded
      console.log("[createWindow] mainWindow.show() called after content load.");
      // Initial workspace path is now fetched by the renderer via IPC.

      if (isDev || !app.isPackaged) {
        mainWindow.webContents.openDevTools();
      }
    } catch (err) {
      console.error("[createWindow] Error loading content:", err);
      dialog.showErrorBox(
        "Loading Error",
        `Failed to load application content: ${err.message}`
      );
      app.quit();
    }
  }

  loadContent();


  mainWindow.on("closed", () => {
    console.log("[createWindow] Main window closed.");
    mainWindow = null;
  });

  // mainWindow.on("ready-to-show", () => {
  //   // This is now handled after content load and workspace selection
  //   // console.log("[createWindow] Main window ready-to-show.");
  //   // mainWindow.show();
  //   // console.log("[createWindow] mainWindow.show() called after ready-to-show.");
  // });

  mainWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription, validatedURL) => {
      console.error(
        `[createWindow] Failed to load URL: ${validatedURL}, Error Code: ${errorCode}, Description: ${errorDescription}`
      );
      // Error handling is now more integrated into the loading promise
      // dialog.showErrorBox(
      //   "Load Failed",
      //   `Failed to load content: ${errorDescription}`
      // );
    }
  );
}

app.whenReady().then(() => {
  console.log("[app.whenReady] App ready. Calling createWindow...");
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("quit", () => {
  console.log("[app.quit] App quitting.");
});

ipcMain.handle("get-python-port", async () => {
  return pythonPort;
});



ipcMain.handle("get-initial-workspace", async () => {
  console.log("[get-initial-workspace] Renderer requested initial workspace path.");
  const currentWorkspace = store.get("lastOpenedWorkspace") as string;
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

// This specific "change-workspace" might involve more than just opening a dialog,
// like reloading the app, so we keep it distinct.
// The Angular app will call this, which in turn uses `select-workspace-dialog`
// and then reloads.
ipcMain.handle("change-workspace-and-reload", async () => {
  console.log("[change-workspace-and-reload] User requested to change workspace.");
  if (!mainWindow) {
    console.error("[change-workspace-and-reload] mainWindow is not available.");
    return null;
  }
  // We can reuse the select-workspace-dialog logic here or call it directly
  // For now, let's keep it simple and assume the renderer calls select-workspace-dialog first,
  // then if a path is returned, it calls this to confirm and reload.
  // Or, this function itself can orchestrate.
  // Let's make it orchestrate:

  const result = await dialog.showOpenDialog(mainWindow, {
    selectionType: "directory",
    title: "Select New Workspace Folder",
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
    mainWindow.webContents.send("workspace-selected", newWorkspacePath); // Inform before reload
    mainWindow.reload();
    return newWorkspacePath;
  } else {
    console.log(`[change-workspace-and-reload] Selected workspace is the same as current. No change.`);
    return oldWorkspacePath;
  }
});


// Handler to read file content
ipcMain.handle("read-file-content", async (event, filePath) => {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error("Invalid file path provided.");
  }
  try {
    // Basic security check: Ensure the path is within expected directories if needed
    // For simplicity now, we just read the path given. Add validation if required.
    console.log(`[read-file-content] Reading file: ${filePath}`);
    const content = await fs.readFile(filePath, "utf-8");
    return content;
  } catch (error) {
    console.error(`[read-file-content] Error reading file ${filePath}:`, error);
    throw new Error(`Failed to read file: ${error.message}`);
  }
});


ipcMain.handle("show-open-dialog", async (event, options) => {
  if (!mainWindow) {
    throw new Error("Main window is not available to show dialog.");
  }
  if (!options || typeof options !== 'object') {
    throw new Error("Invalid options provided for dialog.");
  }

  const { title, filters, selectionType = 'file' } = options; // Default to 'file'

  if (typeof title !== 'string' || !title) {
    throw new Error("A valid title must be provided for the dialog.");
  }

  if (selectionType !== 'file' && selectionType !== 'directory') {
    throw new Error("Invalid selectionType. Must be 'file' or 'directory'.");
  }

  const dialogProperties = [];
  if (selectionType === 'file') {
    dialogProperties.push('openFile');
  } else { // 'directory'
    dialogProperties.push('openDirectory');
  }

  const dialogOptions = {
    title: title,
    properties: dialogProperties,
  };

  if (selectionType === 'file') {
    if (!Array.isArray(filters) || filters.some(f => typeof f.name !== 'string' || !Array.isArray(f.extensions))) {
      throw new Error("Valid filters (name and extensions array) must be provided for file selection.");
    }
    dialogOptions.filters = filters;
  }

  try {
    const result = await dialog.showOpenDialog(mainWindow, dialogOptions);

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



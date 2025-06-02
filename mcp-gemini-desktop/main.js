// main.js
import {app, BrowserWindow, ipcMain, dialog} from "electron";
import path from "path";
import fs from "fs/promises";
import fetch from "node-fetch";
import Store from "electron-store";

// For ESM __dirname equivalent
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const store = new Store();
let mainWindow;
let settingsWindow = null;
const pythonPort = 5001;

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 400,
    height: 200,
    title: "Settings",
    parent: mainWindow,
    modal: true,
    show: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      preload: path.join(__dirname, "settings_preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    // backgroundColor: "#f4f1e7", // Let HTML/CSS define background
  });

  settingsWindow.loadFile(path.join(__dirname, "settings.html"));

  settingsWindow.once("ready-to-show", () => {
    settingsWindow.show();
  });

  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

function createWindow() {
  console.log("[createWindow] Attempting to create main window...");
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Initially hide the window
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
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
    if (settingsWindow) {
      settingsWindow.close();
    }
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

ipcMain.handle("open-settings-dialog", () => {
  createSettingsWindow();
});

ipcMain.on("close-settings-dialog", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.close();
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

// --- Model Switching IPC Handlers ---

ipcMain.handle("list-models", async () => {
  console.log("[ipcMain] Handling list-models request");
  try {
    const response = await fetch(`http://127.0.0.1:${pythonPort}/list-models`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }
    console.log("[ipcMain] list-models response:", data);
    return data.models; // Assuming backend returns { status: 'success', models: [...] }
  } catch (error) {
    console.error("[ipcMain] Error listing models:", error);
    throw error; // Re-throw to be caught in renderer
  }
});

ipcMain.handle("get-model", async () => {
  console.log("[ipcMain] Handling get-model request");
  try {
    const response = await fetch(`http://127.0.0.1:${pythonPort}/get-model`);
    const data = await response.json();
     if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }
    console.log("[ipcMain] get-model response:", data);
    return data.model; // Assuming backend returns { status: 'success', model: '...' }
  } catch (error) {
    console.error("[ipcMain] Error getting current model:", error);
    throw error;
  }
});

ipcMain.handle("set-model", async (event, modelName) => {
  console.log(`[ipcMain] Handling set-model request for: ${modelName}`);
  try {
    const response = await fetch(`http://127.0.0.1:${pythonPort}/set-model`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelName }),
    });
    const data = await response.json();
     if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }
    console.log("[ipcMain] set-model response:", data);
    // Optionally notify main window or handle success/error feedback
    if (mainWindow) {
        mainWindow.webContents.send("model-update-status", { success: true, message: data.message, model: modelName });
    }
    return { success: true, message: data.message }; // Return success status to settings window
  } catch (error) {
    console.error(`[ipcMain] Error setting model to ${modelName}:`, error);
     if (mainWindow) {
        mainWindow.webContents.send("model-update-status", { success: false, message: error.message, model: modelName });
    }
    throw error; // Re-throw for settings window
  }
});

// --- End Model Switching IPC Handlers ---

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


ipcMain.on("save-api-key", async (event, apiKey) => {
  console.log("[save-api-key] Received API key from settings dialog.");
  let result;
  try {
    const response = await fetch(`http://127.0.0.1:${pythonPort}/set-api-key`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({apiKey: apiKey}),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }
    console.log("[save-api-key] Backend responded:", data);
    result = {success: true, message: data.message};
  } catch (error) {
    console.error("[save-api-key] Error setting API key via backend:", error);
    result = {success: false, message: error.message};
  }
  if (mainWindow) {
    mainWindow.webContents.send("api-key-update-status", result);
  }
});

// main.js
const {app, BrowserWindow, ipcMain, dialog} = require("electron");
const path = require("path");
const fetch = require("node-fetch");

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
    backgroundColor: "#f4f1e7",
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
    backgroundColor: "#fdfcf7",
    icon: path.join(
      __dirname,
      "assets",
      app.isPackaged ? "icon.png" : "icon.png"
    ), // Optional: set icon for window itself
  });
  console.log("[createWindow] BrowserWindow created.");

  const indexPath = path.join(__dirname, "index.html");
  console.log(`[createWindow] Attempting to load file: ${indexPath}`);
  mainWindow
    .loadFile(indexPath)
    .then(() => {
      console.log("[createWindow] index.html loaded successfully.");
    })
    .catch((err) => {
      console.error("[createWindow] Error loading index.html:", err);
      dialog.showErrorBox(
        "Loading Error",
        `Failed to load index.html: ${err.message}`
      );
    });

  // Only open DevTools if not packaged
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    console.log("[createWindow] Main window closed.");
    mainWindow = null;
    if (settingsWindow) {
      settingsWindow.close();
    }
  });

  mainWindow.on("ready-to-show", () => {
    console.log("[createWindow] Main window ready-to-show.");
    mainWindow.show();
    console.log("[createWindow] mainWindow.show() called after ready-to-show.");
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription, validatedURL) => {
      console.error(
        `[createWindow] Failed to load URL: ${validatedURL}, Error Code: ${errorCode}, Description: ${errorDescription}`
      );
      dialog.showErrorBox(
        "Load Failed",
        `Failed to load content: ${errorDescription}`
      );
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

ipcMain.handle("show-open-dialog", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [{name: "Python Scripts", extensions: ["py"]}],
  });
  return result.filePaths;
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

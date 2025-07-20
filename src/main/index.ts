import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path, { join } from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { parse } from "jsonc-parser";
// https://github.com/sindresorhus/electron-store/issues/289
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";
import {
  McpServerState,
  McpServerStatus,
  McpToolDefinition,
} from "../shared/types";
import __Store from "electron-store";

export const Store = __Store.default || __Store;

console.log(Store);
const store = new Store();
let mainWindow!: BrowserWindow;

// Zod schema for server definition
const ServerDefinitionSchema = z.object({
  command: z.string(),
  args: z.array(z.string()),
  env: z.record(z.string(), z.string()).optional(),
  hidden: z.array(z.string()).optional(), // Add hidden property here
});

// Zod schema for the entire mcpServers.json
const McpServersConfigSchema = z
  .object({
    mcpServers: z.record(z.string(), ServerDefinitionSchema),
  })
  .strict();

type McpServersConfig = z.infer<typeof McpServersConfigSchema>;

let lastMcpConfig: {
  config: McpServersConfig;
  configPath: string;
  configFileName: string;
} | null;

const mcpServerStatuses = new Map<
  string,
  { status: McpServerStatus; client?: Client }
>();
let mcpConfigWatcher: fsSync.FSWatcher | null = null;

function sendAllServerStatuses(): void {
  if (mainWindow) {
    const statuses = Array.from(mcpServerStatuses.values());
    console.log(
      `[MCP] Sending ${statuses.length} server statuses to renderer.`,
    );
    mainWindow.webContents.send(
      "mcp-server-status",
      statuses.map((s) => ({ ...s.status })),
    );
  }
}

async function getMcpServersConfig(workspacePath: string): Promise<{
  config: McpServersConfig;
  configPath: string;
  configFileName: string;
} | null> {
  let configFileName = "mcpServers.json";
  let mcpConfigPath = path.join(workspacePath, "mcpServers.jsonc");

  if (!fsSync.existsSync(mcpConfigPath)) {
    mcpConfigPath = path.join(workspacePath, "mcpServers.json");
  } else {
    configFileName = "mcpServers.jsonc";
  }

  if (!fsSync.existsSync(mcpConfigPath)) {
    console.log(
      `[MCP] ${configFileName} not found in workspace. No servers to start.`,
    );
    return null;
  }

  try {
    const configContent = await fs.readFile(mcpConfigPath, "utf-8");
    const rawConfig = parse(configContent);
    const config = McpServersConfigSchema.parse(rawConfig);
    return { config, configPath: mcpConfigPath, configFileName };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(`[MCP] Invalid ${configFileName} format:`, error.message);
    } else if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.log(
        `[MCP] ${configFileName} not found in workspace. No servers to start.`,
      );
    } else {
      console.error(
        `[MCP] Error loading, parsing, or validating ${configFileName}:`,
        error,
      );
    }
    throw error; // Re-throw to be handled by the caller
  }
}

async function loadAndStartMcpServers(workspacePath: string): Promise<void> {
  try {
    const configResult = await getMcpServersConfig(workspacePath);
    const newConfig = configResult ? configResult.config : null;

    // Deep compare new config with last loaded config
    // Otherwise this will run after the code updated the hidden fields.
    if (JSON.stringify(newConfig) === JSON.stringify(lastMcpConfig?.config)) {
      console.log("[MCP] Configuration unchanged. Skipping server restart.");
      sendAllServerStatuses();
      return;
    }

    lastMcpConfig = configResult; // Update last loaded config

    // Stop all currently running servers
    for (const mcpServer of Array.from(mcpServerStatuses.values())) {
      if (mcpServer.client) {
        console.log(`[MCP] Stopping ${mcpServer.status.identifier}`);
        await mcpServer.client.close();
      }
    }
    mcpServerStatuses.clear(); // Clear all statuses before starting new ones

    if (!newConfig) {
      sendAllServerStatuses();
      return;
    }

    const { config, configPath, configFileName } = configResult!;

    if (mcpConfigWatcher) {
      mcpConfigWatcher.close();
    }

    mcpConfigWatcher = fsSync.watch(
      configPath,
      { encoding: "utf-8" },
      (event) => {
        if (event === "change") {
          console.log(`[MCP] ${configFileName} changed. Reloading...`);
          loadAndStartMcpServers(workspacePath);
        }
      },
    );

    for (const mcpServer of Array.from(mcpServerStatuses.values())) {
      if (mcpServer.client) {
        console.log(`[MCP] stopping ${mcpServer.status.identifier}`);
        // TODO in parallel
        await mcpServer.client.close();
      }
    }

    if (config.mcpServers) {
      for (const serverName in config.mcpServers) {
        const serverDef = config.mcpServers[serverName];

        mcpServerStatuses.set(serverName, {
          status: { identifier: serverName, state: McpServerState.STOPPED },
        });

        const client = new Client({
          name: serverName,
          version: "0.0.1",
        });

        const command = serverDef.command;
        const args = serverDef.args.map((a) =>
          a.replaceAll(/\$?\{workspaceFolder\}/g, workspacePath),
        );

        const transport = new StdioClientTransport({
          command,
          args,
          env: serverDef.env,
          stderr: "pipe",
        });
        const stderrData: string[] = [];
        if (transport.stderr != null) {
          transport.stderr.on("data", (data) => {
            console.error(`[MCP][Server ${serverName}][stderr] ${data}`);
            stderrData.push(String(data));
          });
        }

        console.log(`Starting ${command} ${args.join(" ")}`);

        mcpServerStatuses.set(serverName, {
          status: { identifier: serverName, state: McpServerState.STARTING },
        });
        sendAllServerStatuses();

        client
          .connect(transport)
          .then(async () => {
            console.log(`[MCP] Server '${serverName}' connected successfully.`);
            interface McpClientToolDefinition {
              name: string;
              description?: string;
              inputSchema?: object;
              outputSchema?: object;
            }
            const toolResponse = await client.listTools();
            const hiddenToolsForServer = serverDef.hidden || [];
            const tools = toolResponse.tools.map(
              (tool: McpClientToolDefinition) => ({
                ...tool,
                hidden: hiddenToolsForServer.includes(tool.name),
              }),
            ) as McpToolDefinition[];
            tools.sort((t1, t2) => t1.name.localeCompare(t2.name));
            mcpServerStatuses.set(serverName, {
              status: {
                identifier: serverName,
                state: McpServerState.STARTED,
                tools: tools,
              },
              client,
            });
            sendAllServerStatuses();
          })
          .catch((error) => {
            console.error(
              `[MCP] Server '${serverName}' failed to connect:`,
              error,
            );
            mcpServerStatuses.set(serverName, {
              status: {
                identifier: serverName,
                state: McpServerState.ERROR,
                error: `${(error as Error).message}\n${stderrData.join("\n")}`,
              },
            });
            sendAllServerStatuses();
          });
      }
    }
  } catch (error: unknown) {
    console.error(`[MCP] Error in loadAndStartMcpServers:`, error);
  }
  sendAllServerStatuses();
}

function createWindow(): void {
  console.log("[createWindow] Attempting to create main window...");
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Initially hide the window
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
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
      app.isPackaged ? "icon.png" : "icon.png",
    ), // Optional: set icon for window itself
  });

  console.log("[createWindow] BrowserWindow created.");

  async function loadContent(): Promise<void> {
    const isDev = process.env.NODE_ENV === "development";
    let loadPromise;

    if (isDev) {
      console.log(
        "[createWindow] Development mode: Attempting to load URL http://localhost:4200",
      );
      loadPromise = mainWindow.loadURL("http://localhost:4200");
    } else {
      const indexPath = path.join(
        __dirname,
        "angular-frontend/dist/angular-frontend/browser/index.html",
      );
      console.log(
        `[createWindow] Production mode: Attempting to load file: ${indexPath}`,
      );
      loadPromise = mainWindow.loadFile(indexPath);
    }

    try {
      await loadPromise;
      console.log("[createWindow] Content loaded successfully.");
      mainWindow.maximize();
      mainWindow.show(); // Show window after content is loaded
      console.log(
        "[createWindow] mainWindow.show() called after content load.",
      );
      // Initial workspace path is now fetched by the renderer via IPC.

      if (isDev || !app.isPackaged) {
        mainWindow.webContents.openDevTools();
      }
    } catch (err) {
      console.error("[createWindow] Error loading content:", err);
      dialog.showErrorBox(
        "Loading Error",
        `Failed to load application content: ${(err as Error).message}`,
      );
      app.quit();
    }
  }

  loadContent();

  mainWindow.on("closed", () => {
    console.log("[createWindow] Main window closed.");
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
        `[createWindow] Failed to load URL: ${validatedURL}, Error Code: ${errorCode}, Description: ${errorDescription}`,
      );
      // Error handling is now more integrated into the loading promise
      // dialog.showErrorBox(
      //   "Load Failed",
      //   `Failed to load content: ${errorDescription}`
      // );
    },
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

ipcMain.handle("get-initial-workspace", async () => {
  console.log(
    "[get-initial-workspace] Renderer requested initial workspace path.",
  );
  const currentWorkspace = store.get("lastOpenedWorkspace") as string;
  if (currentWorkspace) {
    try {
      const stats = await fs.stat(currentWorkspace);
      if (stats.isDirectory()) {
        console.log(
          `[get-initial-workspace] Returning stored workspace: ${currentWorkspace}`,
        );
        loadAndStartMcpServers(currentWorkspace);
        return currentWorkspace;
      } else {
        console.log(
          `[get-initial-workspace] Stored workspace path '${currentWorkspace}' is not a directory. Clearing and returning null.`,
        );
        store.delete("lastOpenedWorkspace");
        return null;
      }
    } catch (error) {
      console.warn(
        `[get-initial-workspace] Error verifying stored workspace '${currentWorkspace}'. Clearing and returning null:`,
        (error as Error).message,
      );
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
ipcMain.handle(
  "change-workspace-and-reload",
  async function (): Promise<string> {
    console.log(
      "[change-workspace-and-reload] User requested to change workspace.",
    );
    // We can reuse the select-workspace-dialog logic here or call it directly
    // For now, let's keep it simple and assume the renderer calls select-workspace-dialog first,
    // then if a path is returned, it calls this to confirm and reload.
    // Or, this function itself can orchestrate.
    // Let's make it orchestrate:

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
      title: "Select New Workspace Folder",
    });

    if (result.canceled) {
      console.log(
        "[change-workspace-and-reload] User canceled workspace selection.",
      );
      return store.get("lastOpenedWorkspace");
    }

    const newWorkspacePath = result.filePaths[0];
    const oldWorkspacePath = store.get("lastOpenedWorkspace");

    if (newWorkspacePath !== oldWorkspacePath) {
      store.set("lastOpenedWorkspace", newWorkspacePath);
      console.log(
        `[change-workspace-and-reload] Workspace changed to: ${newWorkspacePath}. Reloading app.`,
      );
      mainWindow.webContents.send("workspace-selected", newWorkspacePath); // Inform before reload
      loadAndStartMcpServers(newWorkspacePath);
      mainWindow.reload();
      return newWorkspacePath;
    } else {
      console.log(
        `[change-workspace-and-reload] Selected workspace is the same as current. No change.`,
      );
      return oldWorkspacePath;
    }
  },
);

ipcMain.handle("get-mcp-servers", async () => {
  return Array.from(mcpServerStatuses.values()).map((s) => s.status);
});

ipcMain.handle(
  "set-tool-visibility",
  async (event, serverName: string, toolName: string, hidden: boolean) => {
    console.log(
      `[set-tool-visibility] Setting visibility for tool '${toolName}' on server '${serverName}' to ${hidden}`,
    );

    try {
      const serverConfig = lastMcpConfig!.config.mcpServers[serverName];
      if (!serverConfig) {
        throw new Error(`Server configuration for '${serverName}' not found.`);
      }

      // TODO Fix this
      const serverStatus = mcpServerStatuses.get(serverName)!.status;
      if (serverStatus.state !== "STARTED") {
        throw new Error("Server should be in started state");
      }
      const tool = serverStatus.tools.find((t) => t.name === toolName);
      if (tool == null || tool == undefined) {
        throw new Error(`Could not find ${toolName} in ${serverName}`);
      }
      tool.hidden = hidden;

      const currentHidden = serverConfig.hidden || [];
      let newHidden: string[];

      if (hidden) {
        // Add toolName to hidden if it's not already there
        newHidden = [...new Set([...currentHidden, toolName])];
      } else {
        // Remove toolName from hidden
        newHidden = currentHidden.filter((name) => name !== toolName);
      }

      serverConfig.hidden = newHidden;

      // TODO Write jsonc
      await fs.writeFile(
        lastMcpConfig!.configPath,
        JSON.stringify(lastMcpConfig!.config, null, 2),
        "utf-8",
      );

      console.log(
        `[set-tool-visibility] Updated visibility for ${serverName}/${toolName}.`,
      );
    } catch (error) {
      console.error(`[set-tool-visibility] Error updating config file:`, error);
      throw new Error(
        `Failed to update tool visibility: ${(error as Error).message}`,
      );
    }
  },
);

ipcMain.handle(
  "call-mcp-tool",
  async (event, { serverName, toolName, params }) => {
    console.log(
      `[call-mcp-tool] Calling tool '${toolName}' on server '${serverName}' with params:`,
      params,
    );
    const server = mcpServerStatuses.get(serverName);
    if (!server || !server.client) {
      throw new Error(`Server '${serverName}' not found or not connected.`);
    }
    if (server.status.state !== McpServerState.STARTED) {
      throw new Error(`Server '${serverName}' is not in a started state.`);
    }

    try {
      const result = await server.client.callTool({
        name: toolName,
        arguments: params,
      });
      console.log(
        `[call-mcp-tool] Tool '${toolName}' executed successfully with result:`,
        result,
      );
      return result;
    } catch (error) {
      console.error(
        `[call-mcp-tool] Error calling tool '${toolName}' on server '${serverName}':`,
        error,
      );
      throw new Error(`Failed to call tool: ${(error as Error).message}`);
    }
  },
);

ipcMain.handle("show-open-dialog", async (event, options) => {
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

  const properties: ("openFile" | "openDirectory")[] = [];
  if (selectionType === "file") {
    properties.push("openFile");
  } else if (selectionType === "directory") {
    properties.push("openDirectory");
  } else {
    throw new Error("Invalid selectionType. Must be 'file' or 'directory'.");
  }

  const dialogOptions: Electron.OpenDialogOptions = {
    title: title,
    properties: properties,
  };

  if (selectionType === "file" && filters) {
    if (
      !Array.isArray(filters) ||
      filters.some(
        (f) => typeof f.name !== "string" || !Array.isArray(f.extensions),
      )
    ) {
      throw new Error(
        "Valid filters (name and extensions array) must be provided for file selection.",
      );
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
    throw new Error(
      `Failed to show open file dialog: ${(error as Error).message}`,
    );
  }
});

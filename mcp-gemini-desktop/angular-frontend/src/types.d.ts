import { McpServerState, McpServerStatus } from "../../src/shared/types";

declare global {

  type ShowOpenDialogCanceledResponse = {
    canceled: true;
  };

  type ShowOpenDialogResponse = {
    canceled: false;
    path: string;
  }

  type ShowOpenDialogFilter = {
    name: string;
    extensions: string[]
  }

  type ShowOpenDirectoryDialog = {
    title: string;
    selectionType: 'directory',
  }

  type ShowOpenFileDialog = {
    title: string;
    selectionType: 'file',
    filters:  ShowOpenDialogFilter[];
  }

  interface Window {
    electronAPI: {
      getInitialWorkspace: () => Promise<string | null>;
      onWorkspaceSelected: (callback: (path: string | null) => void) => void;
      getSelectedWorkspace: () => Promise<string | null>;
      changeWorkspaceAndReload: () => Promise<string | null>;
      showOpenDialog: (options: ShowOpenFileDialog | ShowOpenDirectoryDialog) => Promise<ShowOpenDialogCanceledResponse | ShowOpenDialogResponse>;
      readFileContent: (filePath: string) => Promise<string>;
      onApiKeyUpdate: (callback: (result: { success: boolean; message?: string }) => void) => void;
      onMcpServerStatus: (callback: (servers: McpServerStatus[])=> void) => void;
      getMcpServers: () => Promise<McpServerStatus[]>;
      callMcpTool: (serverName: string, toolName: string, params: any) => Promise<any>;
      // Add any other electronAPI methods that might be used by services
    }
  }
}

// Export an empty object to make this a module file,
// which can be necessary for global declarations to be picked up correctly.
export {};
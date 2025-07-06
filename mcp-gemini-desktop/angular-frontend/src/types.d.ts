import { McpServerStatus } from '../../src/shared/types';

declare global {
  interface ShowOpenDialogCanceledResponse {
    canceled: true;
  }

  interface ShowOpenDialogResponse {
    canceled: false;
    path: string;
  }

  interface ShowOpenDialogFilter {
    name: string;
    extensions: string[];
  }

  interface ShowOpenDirectoryDialog {
    title: string;
    selectionType: 'directory';
  }

  interface ShowOpenFileDialog {
    title: string;
    selectionType: 'file';
    filters: ShowOpenDialogFilter[];
  }

  interface Window {
    electronAPI: {
      getInitialWorkspace: () => Promise<string | null>;
      onWorkspaceSelected: (callback: (path: string | null) => void) => void;
      getSelectedWorkspace: () => Promise<string | null>;
      changeWorkspaceAndReload: () => Promise<string>;
      showOpenDialog: (
        options: ShowOpenFileDialog | ShowOpenDirectoryDialog,
      ) => Promise<ShowOpenDialogCanceledResponse | ShowOpenDialogResponse>;
      onMcpServerStatus: (
        callback: (servers: McpServerStatus[]) => void,
      ) => void;
      getMcpServers: () => Promise<McpServerStatus[]>;
      callMcpTool: (
        serverName: string,
        toolName: string,
        params: unknown,
      ) => Promise<Record<string, unknown>>;
      // Add any other electronAPI methods that might be used by services
    };
  }
}

// Export an empty object to make this a module file,
// which can be necessary for global declarations to be picked up correctly.
export {};

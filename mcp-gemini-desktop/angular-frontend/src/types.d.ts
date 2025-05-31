declare global {
  interface Window {
    electronAPI: {
      getInitialWorkspace: () => Promise<string | null>;
      onWorkspaceSelected: (callback: (path: string | null) => void) => void;
      getSelectedWorkspace: () => Promise<string | null>;
      changeWorkspaceAndReload: () => Promise<string | null>;
      getPythonPort: () => Promise<number>;
      showOpenDialog: (options: any) => Promise<string[] | undefined>;
      readFileContent: (filePath: string) => Promise<string>;
      openSettingsDialog: () => void;
      onApiKeyUpdate: (callback: (result: { success: boolean; message?: string }) => void) => void;
      // Add any other electronAPI methods that might be used by services
    }
  }
}

// Export an empty object to make this a module file,
// which can be necessary for global declarations to be picked up correctly.
export {};
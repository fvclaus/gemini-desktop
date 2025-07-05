export enum McpServerState {
  STOPPED = "STOPPED",
  STARTING = "STARTING",
  STARTED = "STARTED",
  ERROR = "ERROR",
}

export interface McpServerStopped {
  identifier: string;
  state: "STOPPED";
}

export interface McpServerStarting {
  identifier: string;
  state: "STARTING";
}

export interface McpServerStarted {
  identifier: string;
  state: "STARTED";
  tools: object[];
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
}

export interface McpServerError {
  identifier: string;
  state: "ERROR";
  error: string;
}

export type McpServerStatus =
  | McpServerStarting
  | McpServerStopped
  | McpServerStarted
  | McpServerError;

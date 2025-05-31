import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, timer } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { marked } from 'marked';
import katex from 'katex';

// Electron API types are now expected to be globally available via types.d.ts

// Define and export Message interface here
export interface Message {
  id?: string;
  text: string;
  sender: 'user' | 'ai' | 'system';
  type?: 'welcome' | 'loading' | 'error' | 'tool_call_start' | 'tool_call_end' | 'tool_announcement' | 'log';
  details?: string;
  htmlContent?: string;
  timestamp: Date;
}

export interface Server { // Ensure Server interface is also exported if used elsewhere
  identifier: string;
  display_name: string;
  status: 'connected' | 'error' | 'connecting' | 'disconnected';
  tools?: string[];
  path?: string; // For .py servers
  command?: string; // For JSON-defined servers
  args?: string[];  // For JSON-defined servers
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private pythonPort: number | null = null;
  private serverRefreshIntervalSubscription: any; // Using 'any' for simplicity, can be Subscription

  private messagesSubject = new BehaviorSubject<Message[]>([]);
  messages$: Observable<Message[]> = this.messagesSubject.asObservable();

  private serversSubject = new BehaviorSubject<Server[]>([]);
  servers$: Observable<Server[]> = this.serversSubject.asObservable();

  private backendConnectionStatusSubject = new BehaviorSubject<'connected' | 'disconnected' | 'error'>('disconnected');
  backendConnectionStatus$: Observable<'connected' | 'disconnected' | 'error'> = this.backendConnectionStatusSubject.asObservable();


  constructor(private http: HttpClient, private ngZone: NgZone) {
    this.initializeApp();
    this.setupElectronListeners();
  }

  private async initializeApp(): Promise<void> {
    try {
      this.pythonPort = await window.electronAPI.getPythonPort();
      console.log(`Python backend running on port: ${this.pythonPort}`);
      this.backendConnectionStatusSubject.next('connected');
      this.addMessageHelper({
        id: 'init-welcome',
        text: 'Welcome to GemCP Chat!',
        sender: 'ai',
        type: 'welcome',
        timestamp: new Date()
      });
      await this.fetchServers();
      this.startServerRefresh();
    } catch (error) {
      console.error('Error initializing app:', error);
      this.backendConnectionStatusSubject.next('error');
      this.addMessageHelper({
        id: 'init-error',
        text: 'Error connecting to backend. Please ensure it is running.',
        sender: 'system',
        type: 'error',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
      this.serversSubject.next([]);
      this.stopServerRefresh();
    }
  }

  private setupElectronListeners(): void {
    window.electronAPI.onApiKeyUpdate((result) => {
      this.ngZone.run(() => { // Run inside Angular zone for change detection
        if (result.success) {
          this.addMessageHelper({
            text: 'API Key set successfully. Backend re-initialized.',
            sender: 'system',
            timestamp: new Date()
          });
          // Potentially re-initialize or notify backend
        } else {
          this.addMessageHelper({
            text: `Error setting API Key: ${result.message}`,
            sender: 'system',
            type: 'error',
            details: result.message,
            timestamp: new Date()
          });
        }
      });
    });
  }

  private addMessageHelper(message: Message, updateId?: string): void {
    this.ngZone.run(() => {
      const currentMessages = this.messagesSubject.getValue();
      if (updateId) {
        const existingMsgIndex = currentMessages.findIndex(m => m.id === updateId);
        if (existingMsgIndex !== -1) {
          currentMessages[existingMsgIndex] = { ...currentMessages[existingMsgIndex], ...message, id: updateId };
          this.messagesSubject.next([...currentMessages]);
          return;
        }
      }
      // Ensure unique ID if not provided or if it's a new message
      if (!message.id) {
        message.id = `${message.sender}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      }
      this.messagesSubject.next([...currentMessages, message]);
    });
  }

  private renderLaTeX(text: string): { processedText: string, latexPlaceholders: Array<{ placeholder: string, rendered: string }> } {
    const latexPlaceholders: Array<{ placeholder: string, rendered: string }> = [];
    let placeholderIndex = 0;

    function replaceAndRender(match: string, displayMode: boolean): string {
      const latex = match.slice(displayMode ? 2 : 1, -(displayMode ? 2 : 1));
      try {
        const rendered = katex.renderToString(latex, {
          throwOnError: false,
          displayMode: displayMode,
          output: 'html',
        });
        const placeholder = `__LATEX_PLACEHOLDER_${placeholderIndex++}__`;
        latexPlaceholders.push({ placeholder, rendered });
        return placeholder;
      } catch (e) {
        console.error('KaTeX rendering error:', e);
        return match; // Return original on error
      }
    }

    let processedText = text.replace(/\\$\\$([\\s\\S]*?)\\$\\$/g, (match) => replaceAndRender(match, true));
    processedText = processedText.replace(/(?<!\\$)\\$([^$]+)\\$(?!\\$)/g, (match) => replaceAndRender(match, false));
    return { processedText, latexPlaceholders };
  }

  private processAiMessageContent(text: string): string {
    try {
      const { processedText, latexPlaceholders } = this.renderLaTeX(text);
      let html = marked.parse(processedText) as string; // Ensure marked returns string
      latexPlaceholders.forEach(({ placeholder, rendered }) => {
        html = html.replace(placeholder, rendered);
      });
      return html;
    } catch (parseError) {
      console.error('Error parsing AI message content:', parseError);
      return text; // Fallback to raw text on error
    }
  }

  async sendMessage(messageText: string): Promise<void> {
    if (!messageText.trim() || !this.pythonPort) {
      if (!this.pythonPort) {
        this.addMessageHelper({
          text: 'Error: Backend not connected. Cannot send message.',
          sender: 'system',
          type: 'error',
          timestamp: new Date()
        });
      }
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: messageText,
      sender: 'user',
      timestamp: new Date()
    };
    this.addMessageHelper(userMessage);

    const loadingMessageId = `ai-loading-${Date.now()}`;
    this.addMessageHelper({
      id: loadingMessageId,
      text: '...',
      sender: 'ai',
      type: 'loading',
      timestamp: new Date()
    });

    try {
      const response = await fetch(`http://127.0.0.1:${this.pythonPort}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ reply: `HTTP error! status: ${response.status}` }));
        throw new Error(errorData.reply || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.handleBackendResponse(loadingMessageId, data.reply);

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.addMessageHelper({
        text: `Error: ${errorMessage}`,
        sender: 'system',
        type: 'error',
        details: errorMessage,
        timestamp: new Date()
      }, loadingMessageId); // Update loading message with error
    }
  }

  private handleBackendResponse(loadingMessageId: string, responseText: string): void {
    const lines = responseText.split('\\n');
    const statusMessages: string[] = [];
    const finalReplyLines: string[] = [];

    lines.forEach(line => {
      if (line.startsWith('TOOL_CALL_START:') || line.startsWith('TOOL_CALL_END:')) {
        statusMessages.push(line);
      } else if (line.trim().length > 0) {
        finalReplyLines.push(line);
      }
    });

    // Display status messages first as separate system messages
    statusMessages.forEach(statusMsg => {
      let type: 'tool_call_start' | 'tool_call_end' = 'tool_call_start';
      let details = '';
      if (statusMsg.startsWith('TOOL_CALL_START:')) {
        type = 'tool_call_start';
        details = statusMsg.substring('TOOL_CALL_START:'.length).trim();
      } else {
        type = 'tool_call_end';
        details = statusMsg.substring('TOOL_CALL_END:'.length).trim();
      }
      this.addMessageHelper({
        text: details.split(' ')[0] || 'Tool Call', // Use tool name as text
        sender: 'system',
        type: type,
        details: details,
        timestamp: new Date()
      });
    });

    const finalReply = finalReplyLines.join('\\n').trim();
    const currentMessages = this.messagesSubject.getValue();
    const loadingMessageIndex = currentMessages.findIndex(m => m.id === loadingMessageId);

    if (loadingMessageIndex !== -1) {
      if (finalReply) {
        const aiMessage: Message = {
          id: loadingMessageId, // Reuse ID to update
          text: finalReply,
          sender: 'ai',
          htmlContent: this.processAiMessageContent(finalReply),
          timestamp: new Date()
        };
        this.addMessageHelper(aiMessage, loadingMessageId);
      } else if (statusMessages.length > 0) {
        // If only status messages and no final reply, remove loading
        this.ngZone.run(() => {
          const updatedMessages = currentMessages.filter(m => m.id !== loadingMessageId);
          this.messagesSubject.next(updatedMessages);
        });
      } else {
        // Empty response
        this.addMessageHelper({
          text: '(Received empty response from AI)',
          sender: 'system',
          type: 'log',
          timestamp: new Date()
        }, loadingMessageId);
      }
    } else if (finalReply) {
      // Loading message was somehow removed, add final reply as new
      this.addMessageHelper({
        text: finalReply,
        sender: 'ai',
        htmlContent: this.processAiMessageContent(finalReply),
        timestamp: new Date()
      });
    }
  }

  async fetchServers(): Promise<void> {
    if (!this.pythonPort) return;
    try {
      const response = await fetch(`http://127.0.0.1:${this.pythonPort}/servers`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.status === 'success' && Array.isArray(data.servers)) {
        this.ngZone.run(() => this.serversSubject.next(data.servers));
      } else {
        throw new Error(data.message || 'Failed to fetch servers or invalid format');
      }
    } catch (error) {
      console.error('Error fetching servers:', error);
      this.ngZone.run(() => this.serversSubject.next([])); // Clear servers on error
      this.addMessageHelper({
        text: `Error fetching server list: ${error instanceof Error ? error.message : String(error)}`,
        sender: 'system',
        type: 'error',
        timestamp: new Date()
      });
      this.stopServerRefresh(); // Stop refresh on error
      this.addMessageHelper({
        text: 'Stopping automatic server refresh due to connection error.',
        sender: 'system',
        type: 'log',
        timestamp: new Date()
      });
    }
  }

  private startServerRefresh(): void {
    if (this.serverRefreshIntervalSubscription || !this.pythonPort) return;
    this.ngZone.runOutsideAngular(() => { // Run interval outside Angular zone
      this.serverRefreshIntervalSubscription = timer(0, 10000) // Initial delay 0, then every 10s
        .pipe(switchMap(() => this.fetchServers()))
        .subscribe({
          error: (err) => {
            console.error('Server refresh failed:', err);
            // Error handling is done within fetchServers, which stops the interval
          }
        });
    });
    console.log('Server refresh interval started.');
  }

  private stopServerRefresh(): void {
    if (this.serverRefreshIntervalSubscription) {
      this.serverRefreshIntervalSubscription.unsubscribe();
      this.serverRefreshIntervalSubscription = null;
      console.log('Server refresh interval stopped.');
    }
  }

  async addServerByPath(filePath: string): Promise<void> {
    if (!this.pythonPort) {
      this.addMessageHelper({ text: 'Cannot add server: Backend not connected.', sender: 'system', type: 'error', timestamp: new Date() });
      return;
    }
    const fileName = filePath.split(/[\\\\/]/).pop() || filePath;
    this.addMessageHelper({ text: `Attempting to add server: ${fileName}`, sender: 'system', type: 'log', timestamp: new Date() });

    try {
      const response = await fetch(`http://127.0.0.1:${this.pythonPort}/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath }), // For .py files
      });
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        this.addMessageHelper({ text: `Server added from ${fileName}. Tools: ${data.tools?.join(', ') || 'None'}`, sender: 'system', timestamp: new Date() });
        await this.fetchServers();
        this.startServerRefresh(); // Ensure refresh is running
      } else {
        throw new Error(data.message || `Failed to add server (status: ${response.status})`);
      }
    } catch (error) {
      console.error(`Error adding Python server ${fileName}:`, error);
      this.addMessageHelper({ text: `Error adding server ${fileName}: ${error instanceof Error ? error.message : String(error)}`, sender: 'system', type: 'error', timestamp: new Date() });
      await this.fetchServers(); // Refresh list even on error
    }
  }

  async addServersFromJsonFile(filePath: string): Promise<void> {
    if (!this.pythonPort) {
      this.addMessageHelper({ text: 'Cannot add servers: Backend not connected.', sender: 'system', type: 'error', timestamp: new Date() });
      return;
    }
    const fileName = filePath.split(/[\\\\/]/).pop() || filePath;
    this.addMessageHelper({ text: `Attempting to add servers from JSON file: ${fileName}`, sender: 'system', type: 'log', timestamp: new Date() });

    try {
      const jsonContent = await window.electronAPI.readFileContent(filePath);
      const config = JSON.parse(jsonContent);

      if (!config || typeof config.mcpServers !== 'object') {
        throw new Error("Invalid JSON format. Missing 'mcpServers' object.");
      }
      const serverEntries = Object.entries(config.mcpServers);
      if (serverEntries.length === 0) {
        this.addMessageHelper({ text: `No servers found in ${fileName}.`, sender: 'system', type: 'log', timestamp: new Date() });
        return;
      }

      this.addMessageHelper({ text: `Found ${serverEntries.length} server(s) in ${fileName}. Adding...`, sender: 'system', type: 'log', timestamp: new Date() });
      let allAddedSuccessfully = true;

      for (const [serverName, serverDefUntyped] of serverEntries) {
        const serverDef = serverDefUntyped as any; // Cast for now
        if (!serverDef || !serverDef.command || !Array.isArray(serverDef.args)) {
          this.addMessageHelper({ text: `Skipping invalid server definition for '${serverName}' in ${fileName}. Missing command or args.`, sender: 'system', type: 'log', timestamp: new Date() });
          allAddedSuccessfully = false;
          continue;
        }
        try {
          const response = await fetch(`http://127.0.0.1:${this.pythonPort}/servers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: serverName, command: serverDef.command, args: serverDef.args }),
          });
          const data = await response.json();
          if (response.ok && data.status === 'success') {
            this.addMessageHelper({ text: `Server '${serverName}' added. Tools: ${data.tools?.join(', ') || 'None'}`, sender: 'system', timestamp: new Date() });
          } else {
            throw new Error(data.message || `Failed to add server '${serverName}' (status: ${response.status})`);
          }
        } catch (serverAddError) {
          console.error(`Error adding server '${serverName}':`, serverAddError);
          this.addMessageHelper({ text: `Error adding server '${serverName}': ${serverAddError instanceof Error ? serverAddError.message : String(serverAddError)}`, sender: 'system', type: 'error', timestamp: new Date() });
          allAddedSuccessfully = false;
        }
      }
      await this.fetchServers();
      if (allAddedSuccessfully) this.startServerRefresh();

    } catch (error) {
      console.error(`Error processing JSON server file ${fileName}:`, error);
      this.addMessageHelper({ text: `Error processing ${fileName}: ${error instanceof Error ? error.message : String(error)}`, sender: 'system', type: 'error', timestamp: new Date() });
      await this.fetchServers();
    }
  }


  async deleteServer(serverIdentifier: string): Promise<void> {
    if (!this.pythonPort) {
      this.addMessageHelper({ text: 'Cannot delete server: Backend not connected.', sender: 'system', type: 'error', timestamp: new Date() });
      return;
    }
    const currentServers = this.serversSubject.getValue();
    const serverToDelete = currentServers.find(s => s.identifier === serverIdentifier);
    const displayName = serverToDelete?.display_name || serverIdentifier;

    this.addMessageHelper({ text: `Attempting to remove server: ${displayName}`, sender: 'system', type: 'log', timestamp: new Date() });

    try {
      const response = await fetch(`http://127.0.0.1:${this.pythonPort}/servers`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: serverIdentifier }),
      });
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        this.addMessageHelper({ text: `Server ${displayName} removed.`, sender: 'system', timestamp: new Date() });
        await this.fetchServers();
      } else {
        throw new Error(data.message || `Failed to remove server (status: ${response.status})`);
      }
    } catch (error) {
      console.error('Error removing server:', error);
      this.addMessageHelper({ text: `Error removing server ${displayName}: ${error instanceof Error ? error.message : String(error)}`, sender: 'system', type: 'error', timestamp: new Date() });
      await this.fetchServers(); // Refresh list even on error
    }
  }

  // Method to be called by a UI component (e.g., a button in the sidebar)
  async openAddServerDialog(): Promise<void> {
    if (!this.pythonPort) {
      this.addMessageHelper({ text: 'Cannot add server: Backend not connected.', sender: 'system', type: 'error', timestamp: new Date() });
      return;
    }
    const dialogOptions = {
      properties: ['openFile'],
      filters: [
        { name: 'MCP Server Files', extensions: ['py', 'json'] },
        { name: 'Python Scripts', extensions: ['py'] },
        { name: 'JSON Config', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    };
    try {
      const filePaths = await window.electronAPI.showOpenDialog(dialogOptions);
      if (filePaths && filePaths.length > 0) {
        const filePath = filePaths[0];
        if (filePath.endsWith('.py')) {
          await this.addServerByPath(filePath);
        } else if (filePath.endsWith('.json')) {
          await this.addServersFromJsonFile(filePath);
        } else {
          const fileName = filePath.split(/[\\\\/]/).pop() || filePath;
          this.addMessageHelper({ text: `Unsupported file type: ${fileName}. Please select a .py or .json file.`, sender: 'system', type: 'error', timestamp: new Date() });
        }
      }
    } catch (dialogError) {
        console.error('Error opening file dialog or processing file:', dialogError);
        this.addMessageHelper({ text: `Error with file dialog: ${dialogError instanceof Error ? dialogError.message : String(dialogError)}`, sender: 'system', type: 'error', timestamp: new Date() });
    }
  }

  openSettings(): void {
    window.electronAPI.openSettingsDialog();
  }

  ngOnDestroy() {
    this.stopServerRefresh();
    // Potentially clean up other listeners if any were added directly to window or document
  }
}
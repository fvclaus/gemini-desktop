import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { marked } from 'marked';
import katex from 'katex';
import { GoogleGenAI, Content, Part, FunctionCall, GenerateContentResponse } from '@google/genai';
import { SettingsService } from './settings.service';

// Electron API types are now expected to be globally available via types.d.ts

// Define and export Message interface here
export interface Message {
  id?: string;
  text: string;
  sender: 'user' | 'ai' | 'system';
  type?: 'welcome' | 'loading' | 'error' | 'tool_request' | 'tool_result' | 'log' | 'text';
  details?: any; // Can be string or object for tool calls
  htmlContent?: string;
  timestamp: Date;
  tool_calls?: any[]; // For tool_request type
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
  private genAI: GoogleGenAI | null = null;
  private apiKey: string | null = null;
  private modelName: string = 'gemini-2.5-pro-preview-05-06'; // Default model
  private chatHistory: Content[] = [];

  private messagesSubject = new BehaviorSubject<Message[]>([]);
  messages$: Observable<Message[]> = this.messagesSubject.asObservable();

  private serversSubject = new BehaviorSubject<Server[]>([]);
  servers$: Observable<Server[]> = this.serversSubject.asObservable();

  private backendConnectionStatusSubject = new BehaviorSubject<'connected' | 'disconnected' | 'error'>('disconnected');
  backendConnectionStatus$: Observable<'connected' | 'disconnected' | 'error'> = this.backendConnectionStatusSubject.asObservable();


  constructor(
    private ngZone: NgZone,
    private settingsService: SettingsService
  ) {
    this.apiKey = this.settingsService.getApiKey();
    this.initializeApp();
  }

  private async initializeApp(): Promise<void> {
    if (!this.apiKey) {
      console.error('API key is not set.');
      this.backendConnectionStatusSubject.next('error');
      this.addMessageHelper({
        id: 'init-error',
        text: 'API Key is not configured. Please set it in the settings.',
        sender: 'system',
        type: 'error',
        timestamp: new Date()
      });
      return;
    }

    try {
      this.genAI = new GoogleGenAI({apiKey: this.apiKey});
      this.backendConnectionStatusSubject.next('connected');
      console.log('Gemini client initialized successfully.');

      if (this.messagesSubject.getValue().length === 0) {
        this.addMessageHelper({
          id: 'init-welcome',
          text: 'Welcome to GemCP Chat! I am ready to chat.',
          sender: 'ai',
          type: 'welcome',
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Error initializing Gemini client:', error);
      this.backendConnectionStatusSubject.next('error');
      this.addMessageHelper({
        id: 'init-error',
        text: 'Error initializing Gemini. Please check your API key and network connection.',
        sender: 'system',
        type: 'error',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
      this.cleanup();
    }
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
      let html = marked.parse(processedText) as string;
      latexPlaceholders.forEach(({ placeholder, rendered }) => {
        html = html.replace(placeholder, rendered);
      });
      return html;
    } catch (parseError) {
      console.error('Error parsing AI message content:', parseError);
      return text;
    }
  }

  async sendMessage(messageText: string): Promise<void> {
    if (!messageText.trim()) return;

    if (!this.genAI) {
      this.addMessageHelper({
        text: 'Error: Chat session not initialized. Please check your API key.',
        sender: 'system',
        type: 'error',
        timestamp: new Date()
      });
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: messageText,
      sender: 'user',
      timestamp: new Date()
    };
    this.addMessageHelper(userMessage);
    this.chatHistory.push({ role: 'user', parts: [{ text: messageText }] });

    const loadingMessageId = `ai-loading-${Date.now()}`;
    this.addMessageHelper({
      id: loadingMessageId,
      text: '...',
      sender: 'ai',
      type: 'loading',
      timestamp: new Date()
    });

    try {
      const result = await this.genAI.models.generateContent({ model: this.modelName, contents: this.chatHistory });
      this.handleGeminiResponse(loadingMessageId, result);
    } catch (error) {
      console.error('Error sending message to Gemini:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.addMessageHelper({
        text: `Error: ${errorMessage}`,
        sender: 'system',
        type: 'error',
        details: errorMessage,
        timestamp: new Date()
      }, loadingMessageId);
    }
  }

  private handleGeminiResponse(loadingMessageId: string, response: GenerateContentResponse): void {
    this.ngZone.run(() => {
      const currentMessages = this.messagesSubject.getValue();
      const updatedMessages = currentMessages.filter(m => m.id !== loadingMessageId);
      this.messagesSubject.next(updatedMessages);
    });

    const functionCalls = response.functionCalls;
    if (functionCalls && functionCalls.length > 0) {
      const toolRequestMessage: Message = {
        sender: 'ai',
        type: 'tool_request',
        text: 'The model wants to call the following tool(s):',
        tool_calls: functionCalls,
        timestamp: new Date(),
      };
      this.addMessageHelper(toolRequestMessage);
      this.chatHistory.push({ role: 'model', parts: functionCalls.map((fc: FunctionCall) => ({ functionCall: fc })) });
    } else {
      const text = response.text;
      if (text === undefined) {
        console.error(`Excepted text but was undefined in response`, response);
        throw new Error(`Excepted text but was undefined in response`);
      }
      const aiMessage: Message = {
        sender: 'ai',
        type: 'text',
        text: text,
        htmlContent: this.processAiMessageContent(text),
        timestamp: new Date(),
      };
      this.addMessageHelper(aiMessage);
      this.chatHistory.push({ role: 'model', parts: [{ text }] });
    }
  }

  async sendToolResponse(approved: boolean, toolCall: FunctionCall): Promise<void> {
    if (!this.genAI) {
      this.addMessageHelper({ text: 'Cannot send tool response: Chat session not initialized.', sender: 'system', type: 'error', timestamp: new Date() });
      return;
    }

    this.addMessageHelper({
      text: `User ${approved ? 'approved' : 'denied'} tool call: ${toolCall.name}`,
      sender: 'system',
      type: 'log',
      timestamp: new Date()
    });

    let toolResponsePart: Part;
    if (approved) {
      // Here you would execute the actual tool. Since we are removing the filesystem tools for now,
      // we will simulate a response.
      const toolResult = { result: `Simulated result for ${toolCall.name}` };
      toolResponsePart = {
        functionResponse: {
          name: toolCall.name,
          response: toolResult,
        },
      };
      this.addMessageHelper({
        sender: 'system',
        type: 'tool_result',
        text: `Tool ${toolCall.name} finished with status: Success`,
        details: toolResult.result,
        timestamp: new Date(),
      });
    } else {
      toolResponsePart = {
        functionResponse: {
          name: toolCall.name,
          response: { result: "User denied the tool call." },
        },
      };
      this.addMessageHelper({
        sender: 'system',
        type: 'tool_result',
        text: `Tool ${toolCall.name} finished with status: Denied`,
        details: "User denied the tool call.",
        timestamp: new Date(),
      });
    }

    this.chatHistory.push({ role: 'function', parts: [toolResponsePart] });

    const loadingMessageId = `ai-loading-${Date.now()}`;
    this.addMessageHelper({
      id: loadingMessageId,
      text: '...',
      sender: 'ai',
      type: 'loading',
      timestamp: new Date()
    });

    try {
      const result = await this.genAI.models.generateContent({ model: this.modelName, contents: this.chatHistory });
      this.handleGeminiResponse(loadingMessageId, result);
    } catch (error) {
      console.error('Error sending tool response to Gemini:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.addMessageHelper({
        text: `Error: ${errorMessage}`,
        sender: 'system',
        type: 'error',
        details: errorMessage,
        timestamp: new Date()
      }, loadingMessageId);
    }
  }

  public setModel(modelName: string): void {
    this.modelName = modelName;
    this.addMessageHelper({
      text: `Model switched to ${modelName}. The chat history has been cleared.`,
      sender: 'system',
      type: 'log',
      timestamp: new Date()
    });
    this.chatHistory = [];
    this.messagesSubject.next([]); // Clear messages
    this.initializeApp(); // Re-initialize with the new model
  }

  private cleanup(): void {
    this.genAI = null;
    this.backendConnectionStatusSubject.next('disconnected');
  }

  ngOnDestroy() {
    this.cleanup();
  }
}
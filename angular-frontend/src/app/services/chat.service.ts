import { Injectable, NgZone, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { marked } from 'marked';
import katex from 'katex';
import {
  GoogleGenAI,
  Content,
  Part,
  FunctionCall,
  GenerateContentResponse,
} from '@google/genai';
import { ProfilesService } from './profiles.service';
import { McpServerStatus } from '../../../../src/shared/types';
import { ChatSessionHistoryService } from './chat-session-history.service';
import { ChatSession } from '../domain/chatSession';
import { Profile } from '../domain/profile';
import {
  AiMessage,
  Message,
  ToolRequestMessage,
  UserMessage,
} from '../domain/messages';

interface ToolCall {
  serverName: string;
  toolName: string;
  args?: Record<string, unknown>;
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private ngZone = inject(NgZone);
  private settingsService = inject(ProfilesService);
  private chatHistoryService = inject(ChatSessionHistoryService);

  private chatHistory: Content[] = [];
  private activeSession: ChatSession | null = null;

  private messagesSubject = new BehaviorSubject<Message[]>([]);
  messages$: Observable<Message[]> = this.messagesSubject.asObservable();

  private mcpServersSubject = new BehaviorSubject<McpServerStatus[]>([]);
  mcpServers$: Observable<McpServerStatus[]> =
    this.mcpServersSubject.asObservable();

  constructor() {
    window.electronAPI.onMcpServerStatus((statuses) => {
      this.ngZone.run(() => {
        console.log('MCP servers changed', statuses);
        this.mcpServersSubject.next(statuses);
      });
    });

    window.electronAPI.getMcpServers().then((statuses) => {
      this.ngZone.run(() => {
        console.log('Received mcp servers on startup', statuses);
        this.mcpServersSubject.next(statuses);
      });
    });
  }

  public async setToolVisibility(
    serverName: string,
    toolName: string,
    hidden: boolean,
  ): Promise<void> {
    try {
      await window.electronAPI.setToolVisibility(serverName, toolName, hidden);
    } catch (error) {
      console.error(
        `Error setting tool visibility for ${serverName}/${toolName}:`,
        error,
      );
      this.addMessageHelper({
        id: this.generateId(),
        text: `Error setting tool visibility: ${toolName}`,
        sender: 'system',
        type: 'error',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      });
    }
  }

  private initializeGenAI(profile: Profile): GoogleGenAI {
    try {
      return new GoogleGenAI({ apiKey: profile.apiKey });
    } catch (error) {
      // TODO Test
      console.error('Error initializing Gemini client:', error);
      this.addMessageHelper({
        id: 'init-error',
        text: 'Error initializing Gemini. Please check your API key and network connection.',
        sender: 'system',
        type: 'error',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      });
      throw error;
    }
  }

  private addMessageHelper(message: Message, updateId?: string): void {
    this.ngZone.run(() => {
      const currentMessages = this.messagesSubject.getValue();
      if (updateId) {
        const existingMsgIndex = currentMessages.findIndex(
          (m) => m.id === updateId,
        );
        if (existingMsgIndex !== -1) {
          currentMessages[existingMsgIndex] = {
            ...currentMessages[existingMsgIndex],
            ...message,
            id: updateId,
          };
          this.messagesSubject.next([...currentMessages]);
          return;
        }
      }
      if (!message.id) {
        message.id = `${message.sender}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      }
      console.log('Added new message', message);
      const newMessages = [...currentMessages, message];
      this.messagesSubject.next(newMessages);

      if (!this.activeSession) {
        // TODO Improve this Typecast
        const newSession = this.chatHistoryService.createSession(
          message as UserMessage,
        );
        this.activeSession = newSession;
      } else if (!(message.sender === 'ai' && message.type === 'loading')) {
        this.activeSession.messages.push(message);
        this.chatHistoryService.updateSession(this.activeSession);
      }
    });
  }

  private renderLaTeX(text: string): {
    processedText: string;
    latexPlaceholders: { placeholder: string; rendered: string }[];
  } {
    const latexPlaceholders: { placeholder: string; rendered: string }[] = [];
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

    let processedText = text.replace(/\\$\\$([\\s\\S]*?)\\$\\$/g, (match) =>
      replaceAndRender(match, true),
    );
    processedText = processedText.replace(
      /(?<!\\$)\\$([^$]+)\\$(?!\\$)/g,
      (match) => replaceAndRender(match, false),
    );
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

  async sendMessage(profile: Profile, messageText: string): Promise<void> {
    const genAI = this.initializeGenAI(profile);

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'message',
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
    };
    this.addMessageHelper(userMessage);
    this.chatHistory.push({ role: 'user', parts: [{ text: messageText }] });

    const loadingMessageId = `ai-loading-${Date.now()}`;
    this.addMessageHelper({
      id: loadingMessageId,
      sender: 'ai',
      type: 'loading',
      timestamp: new Date(),
    });

    try {
      const result = await genAI.models.generateContent({
        model: profile.model.name,
        contents: this.chatHistory,

        config: {
          tools: this.mcpServersSubject
            .getValue()
            .filter((mcpServer) => mcpServer.state === 'STARTED')
            .map((mcpServer) => {
              return {
                functionDeclarations: mcpServer.tools
                  .filter((tool) => !tool.hidden) // Filter out hidden tools
                  .map((t) => ({
                    name: `${mcpServer.identifier}_${t.name}`,
                    description: t.description,
                    parameters: t.inputSchema,
                  })),
              };
            }),
          systemInstruction: profile.systemPrompt
            ? {
                role: 'system',
                parts: [{ text: profile.systemPrompt }],
              }
            : undefined,
        },
      });
      this.handleGeminiResponse(loadingMessageId, result, profile);
    } catch (error) {
      console.error('Error sending message to Gemini:', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.addMessageHelper(
        {
          id: this.generateId(),
          text: `Error: ${errorMessage}`,
          sender: 'system',
          type: 'error',
          details: errorMessage,
          timestamp: new Date(),
        },
        loadingMessageId,
      );
    }
  }

  private generateId(): string {
    return `${Date.now()}`;
  }

  private handleGeminiResponse(
    loadingMessageId: string,
    response: GenerateContentResponse,
    profile: Profile,
  ): void {
    this.ngZone.run(() => {
      const currentMessages = this.messagesSubject.getValue();
      const updatedMessages = currentMessages.filter(
        (m) => m.id !== loadingMessageId,
      );
      this.messagesSubject.next(updatedMessages);
    });

    const functionCalls = response.functionCalls;
    if (functionCalls && functionCalls.length > 0) {
      const toolRequestMessage: ToolRequestMessage = {
        id: this.generateId(),
        sender: 'ai',
        type: 'tool_request',
        showRequestedTools: true,
        tools: functionCalls.map((f) => {
          const [serverName, ...rest] = f.name!.split('_');
          const toolName = rest.join('_');
          return {
            serverName,
            toolName,
            args: f.args,
          };
        }),
        timestamp: new Date(),
        usageMetadata: response.usageMetadata,
        model: profile.model,
      };
      this.addMessageHelper(toolRequestMessage);
      this.chatHistory.push({
        role: 'model',
        parts: functionCalls.map((fc: FunctionCall) => ({ functionCall: fc })),
      });
    } else {
      const text = response.text;
      // TODO
      //       "candidates": [
      //   {
      //     "finishReason": "UNEXPECTED_TOOL_CALL",
      //     "index": 0
      //   }
      // ],
      if (text === undefined) {
        console.error(`Excepted text but was undefined in response`, response);
        throw new Error(`Excepted text but was undefined in response`);
      }
      const aiMessage: AiMessage = {
        id: this.generateId(),
        sender: 'ai',
        type: 'message',
        text: text,
        htmlContent: this.processAiMessageContent(text),
        timestamp: new Date(),
        usageMetadata: response.usageMetadata,
        model: profile.model!,
      };
      this.addMessageHelper(aiMessage);
      this.chatHistory.push({ role: 'model', parts: [{ text }] });
    }
  }

  async sendToolResponse(
    profile: Profile,
    approved: boolean,
    toolCalls: ToolCall[],
  ): Promise<void> {
    this.addMessageHelper({
      id: this.generateId(),
      sender: 'user',
      type: 'tool_decision',
      approval: approved ? 'approved' : 'rejected',
      timestamp: new Date(),
    });

    const genAI = this.initializeGenAI(profile);

    let toolResponseParts: Part[] = [];
    if (approved) {
      // Run all tool calls in parallel and collect results
      toolResponseParts = await Promise.all(
        toolCalls.map(async (toolCall) => {
          try {
            const toolResult = {
              output: await window.electronAPI.callMcpTool(
                toolCall.serverName,
                toolCall.toolName,
                toolCall.args,
              ),
            };
            this.addMessageHelper({
              id: this.generateId(),
              sender: 'system',
              type: 'tool_result',
              tool: {
                name: `${toolCall.serverName}_${toolCall.toolName}`,
                args: toolCall.args,
              },
              result: toolResult,
              timestamp: new Date(),
            });
            return {
              functionResponse: {
                name: toolCall.toolName,
                response: toolResult,
              },
            } as Part;
          } catch (error: unknown) {
            const result = { error: `${error}` };
            this.addMessageHelper({
              id: this.generateId(),
              sender: 'system',
              type: 'tool_result',
              tool: {
                name: `${toolCall.serverName}_${toolCall.toolName}`,
                args: toolCall.args,
              },
              result: result,
              timestamp: new Date(),
            });
            return {
              functionResponse: {
                name: toolCall.toolName,
                response: result,
              },
            } as Part;
          }
        }),
      );
    } else {
      toolResponseParts = toolCalls.map((t) => ({
        functionResponse: {
          name: t.toolName,
          response: {
            error: 'User denied the function call.',
          },
        },
      }));
    }

    this.chatHistory.push({ role: 'function', parts: toolResponseParts });

    const loadingMessageId = `ai-loading-${Date.now()}`;
    this.addMessageHelper({
      id: loadingMessageId,
      sender: 'ai',
      type: 'loading',
      timestamp: new Date(),
    });

    try {
      const result = await genAI.models.generateContent({
        model: profile.model.name,
        contents: this.chatHistory,
      });
      this.handleGeminiResponse(loadingMessageId, result, profile);
    } catch (error) {
      console.error('Error sending tool response to Gemini:', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.addMessageHelper(
        {
          id: this.generateId(),
          text: `Error: ${errorMessage}`,
          sender: 'system',
          type: 'error',
          details: errorMessage,
          timestamp: new Date(),
        },
        loadingMessageId,
      );
    }
  }

  public startNewSession(): void {
    this.chatHistory = [];
    this.messagesSubject.next([]);
  }

  public loadSession(sessionId: string): void {
    const session = this.chatHistoryService.getSession(sessionId);
    if (session) {
      this.activeSession = session;
      this.chatHistory = session.messages.reduce((messages, m) => {
        if (
          m.type === 'loading' ||
          m.type === 'tool_decision' ||
          m.type === 'tool_request' ||
          m.type === 'tool_result' ||
          m.type === 'error'
        ) {
          return messages;
        }
        messages.push({
          role: m.sender === 'user' ? 'user' : 'model',
          parts: [{ text: m.text }],
        });

        return messages;
      }, [] as Content[]);
      this.messagesSubject.next(session.messages);
    }
  }

  public getActiveSession(): ChatSession | null {
    return this.activeSession;
  }
}

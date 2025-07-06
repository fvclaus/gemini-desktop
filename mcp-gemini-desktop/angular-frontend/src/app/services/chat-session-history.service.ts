import { Injectable, inject } from '@angular/core';
import { ChatSession } from './chat-session.interface';
import { AiMessage, ToolRequestMessage, UserMessage } from './chat.service';
import { SettingsService } from './settings.service';

@Injectable({
  providedIn: 'root',
})
export class ChatSessionHistoryService {
  private readonly STORAGE_KEY = 'chat_session_history';
  private settingsService = inject(SettingsService);

  private getSessions(): ChatSession[] {
    const sessionsJson = localStorage.getItem(this.STORAGE_KEY);
    if (!sessionsJson) {
      return [];
    }
    const sessions: ChatSession[] = JSON.parse(sessionsJson);
    // Re-hydrate model instances
    sessions.forEach((session) => {
      session.messages.forEach((message) => {
        if (
          message.sender === 'ai' &&
          (message.type === 'message' || message.type === 'tool_request')
        ) {
          const aiMessage = message as AiMessage | ToolRequestMessage;
          aiMessage.modelInstance = this.settingsService.getGeminiModel(
            aiMessage.model.name,
          );
        }
      });
    });
    return sessions;
  }

  private saveSessions(sessions: ChatSession[]): void {
    const serializableSessions = sessions.map((session) => {
      const serializableMessages = session.messages.map((message) => {
        if (
          message.sender === 'ai' &&
          (message.type === 'message' || message.type === 'tool_request')
        ) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { modelInstance, ...rest } = message as
            | AiMessage
            | ToolRequestMessage;
          return rest;
        }
        return message;
      });
      return { ...session, messages: serializableMessages };
    });
    localStorage.setItem(
      this.STORAGE_KEY,
      JSON.stringify(serializableSessions),
    );
  }

  getAllSessions(): ChatSession[] {
    return this.getSessions();
  }

  getSession(id: string): ChatSession | undefined {
    return this.getSessions().find((session) => session.id === id);
  }

  createSession(message: UserMessage): ChatSession {
    const sessions = this.getSessions();
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      startTime: new Date(),
      messages: [message],
    };
    sessions.push(newSession);
    this.saveSessions(sessions);
    return newSession;
  }

  updateSession(updatedSession: ChatSession): void {
    const sessions = this.getSessions();
    const index = sessions.findIndex(
      (session) => session.id === updatedSession.id,
    );
    if (index !== -1) {
      sessions[index] = updatedSession;
      this.saveSessions(sessions);
    }
  }

  deleteSession(id: string): void {
    let sessions = this.getSessions();
    sessions = sessions.filter((session) => session.id !== id);
    this.saveSessions(sessions);
  }
}

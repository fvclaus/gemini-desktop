import { Injectable, inject } from '@angular/core';
import { ChatSession } from './chat-session.interface';
import { AiMessage, ToolRequestMessage, UserMessage } from './chat.service';
import { SettingsService } from './settings.service';
import { BehaviorSubject, Observable } from 'rxjs';

// TODO Write into workspace

@Injectable({
  providedIn: 'root',
})
export class ChatSessionHistoryService {
  private readonly STORAGE_KEY = 'chat_session_history';
  private settingsService = inject(SettingsService);

  private _sessionsSubject: BehaviorSubject<ChatSession[]>;
  public sessions$: Observable<ChatSession[]>;

  constructor() {
    const initialSessions = this.loadSessionsFromLocalStorage();
    this._sessionsSubject = new BehaviorSubject<ChatSession[]>(initialSessions);
    this.sessions$ = this._sessionsSubject.asObservable();
  }

  private loadSessionsFromLocalStorage(): ChatSession[] {
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
          aiMessage.model = this.settingsService.getGeminiModel(
            // TODO Better typing
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            aiMessage.model as any,
          );
        }
      });
    });
    return sessions;
  }

  private saveSessionsToLocalStorage(sessions: ChatSession[]): void {
    const serializableSessions = sessions.map((session) => {
      const serializableMessages = session.messages.map((message) => {
        if (
          message.sender === 'ai' &&
          (message.type === 'message' || message.type === 'tool_request')
        ) {
          return {
            ...message,
            model: message.model.name,
          };
        }
        return message;
      });
      return { ...session, messages: serializableMessages };
    });
    localStorage.setItem(
      this.STORAGE_KEY,
      JSON.stringify(serializableSessions),
    );
    this._sessionsSubject.next(sessions); // Emit the updated sessions
  }

  private saveSessions(sessions: ChatSession[]): void {
    const serializableSessions = sessions.map((session) => {
      const serializableMessages = session.messages.map((message) => {
        if (
          message.sender === 'ai' &&
          (message.type === 'message' || message.type === 'tool_request')
        ) {
          return {
            ...message,
            model: message.model.name,
          };
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
    return this._sessionsSubject.getValue();
  }

  getSession(id: string): ChatSession | undefined {
    return this._sessionsSubject
      .getValue()
      .find((session) => session.id === id);
  }

  createSession(message: UserMessage): ChatSession {
    const sessions = this._sessionsSubject.getValue();
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      startTime: new Date(),
      messages: [message],
    };
    sessions.push(newSession);
    this.saveSessionsToLocalStorage(sessions);
    return newSession;
  }

  updateSession(updatedSession: ChatSession): void {
    const sessions = this._sessionsSubject.getValue();
    const index = sessions.findIndex(
      (session) => session.id === updatedSession.id,
    );
    if (index !== -1) {
      sessions[index] = updatedSession;
      this.saveSessionsToLocalStorage(sessions);
    }
  }

  deleteSession(id: string): void {
    let sessions = this._sessionsSubject.getValue();
    sessions = sessions.filter((session) => session.id !== id);
    this.saveSessionsToLocalStorage(sessions);
  }
}

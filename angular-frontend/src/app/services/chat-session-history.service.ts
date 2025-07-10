import { Injectable, inject } from '@angular/core';
import { ChatSession } from './chat-session.interface';
import { UserMessage } from './chat.service';
import { SettingsService } from './settings.service';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  deserializeChatSession,
  SerializedChatSession,
} from './serialization.utils';

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
    const parsedSessions: SerializedChatSession[] = JSON.parse(sessionsJson);
    return parsedSessions.map((session) =>
      deserializeChatSession(session, this.settingsService),
    );
  }

  private saveSessionsToLocalStorage(sessions: ChatSession[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));
    this._sessionsSubject.next(sessions); // Emit the updated sessions
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

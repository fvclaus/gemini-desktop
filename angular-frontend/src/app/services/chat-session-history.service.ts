import { Injectable } from '@angular/core';
import {
  ChatSession,
  deserializeChatSessions,
  serializeChatSessions,
} from '../domain/chatSession';
import { UserMessage } from '../domain/messages';
import { BehaviorSubject, Observable } from 'rxjs';

// TODO Write into workspace

@Injectable({
  providedIn: 'root',
})
export class ChatSessionHistoryService {
  private readonly STORAGE_KEY = 'chat_session_history';

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
    return deserializeChatSessions(sessionsJson);
  }

  private saveSessionsToLocalStorage(sessions: ChatSession[]): void {
    localStorage.setItem(this.STORAGE_KEY, serializeChatSessions(sessions));
    this._sessionsSubject.next(sessions);
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

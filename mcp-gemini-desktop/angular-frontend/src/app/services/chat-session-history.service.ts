import { Injectable } from '@angular/core';
import { ChatSession } from './chat-session.interface';
import { Message, UserMessage } from './chat.service';

@Injectable({
  providedIn: 'root'
})
export class ChatSessionHistoryService {
  private readonly STORAGE_KEY = 'chat_session_history';

  constructor() { }

  private getSessions(): ChatSession[] {
    const sessionsJson = localStorage.getItem(this.STORAGE_KEY);
    return sessionsJson ? JSON.parse(sessionsJson) : [];
  }

  private saveSessions(sessions: ChatSession[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));
  }

  getAllSessions(): ChatSession[] {
    return this.getSessions();
  }

  getSession(id: string): ChatSession | undefined {
    return this.getSessions().find(session => session.id === id);
  }

  createSession(message: UserMessage): ChatSession {
    const sessions = this.getSessions();
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      startTime: new Date(),
      messages: [message]
    };
    sessions.push(newSession);
    this.saveSessions(sessions);
    return newSession;
  }

  updateSession(updatedSession: ChatSession): void {
    const sessions = this.getSessions();
    const index = sessions.findIndex(session => session.id === updatedSession.id);
    if (index !== -1) {
      sessions[index] = updatedSession;
      this.saveSessions(sessions);
    }
  }

  deleteSession(id: string): void {
    let sessions = this.getSessions();
    sessions = sessions.filter(session => session.id !== id);
    this.saveSessions(sessions);
  }
}
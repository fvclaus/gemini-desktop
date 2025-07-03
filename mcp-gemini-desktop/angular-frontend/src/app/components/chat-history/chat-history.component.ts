import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatSessionHistoryService } from '../../services/chat-session-history.service';
import { ChatService } from '../../services/chat.service';
import { ChatSession } from '../../services/chat-session.interface';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';

@Component({
  selector: 'app-chat-history',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatListModule],
  templateUrl: './chat-history.component.html',
  styleUrls: ['./chat-history.component.css']
})
export class ChatHistoryComponent implements OnInit {
  public sessions: ChatSession[] = [];

  constructor(
    private chatHistoryService: ChatSessionHistoryService,
    private chatService: ChatService
  ) { }

  ngOnInit(): void {
    this.sessions = this.chatHistoryService.getAllSessions();
  }

  loadSession(sessionId: string): void {
    this.chatService.loadSession(sessionId);
  }

  getTitle(session: ChatSession): string {
    const content = session.messages[0].text;
    return content.length > 100 ? content.slice(0, 100) + '…' : content;
  }
}

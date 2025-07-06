import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatSessionHistoryService } from '../../services/chat-session-history.service';
import { ChatService } from '../../services/chat.service';
import { ChatSession } from '../../services/chat-session.interface';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatDialog } from '@angular/material/dialog';
import { ChatHistoryDeletionConfirmationDialogComponent } from '../chat-history-deletion-confirmation-dialog/chat-history-deletion-confirmation-dialog.component';
import { SettingsService } from '../../services/settings.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-chat-history',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatListModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './chat-history.component.html',
  styleUrls: ['./chat-history.component.css'],
})
export class ChatHistoryComponent implements OnInit {
  private chatHistoryService = inject(ChatSessionHistoryService);
  private chatService = inject(ChatService);
  private dialog = inject(MatDialog);
  private settingsService = inject(SettingsService);

  public sessions: ChatSession[] = [];
  public visibleSessions: ChatSession[] = [];
  public showAll = false;

  ngOnInit(): void {
    this.sessions = this.chatHistoryService.getAllSessions();
    this.updateVisibleSessions();
  }

  loadSession(sessionId: string): void {
    this.chatService.loadSession(sessionId);
  }

  getTitle(session: ChatSession): string {
    const content = session.messages[0].text;
    return content.length > 100 ? content.slice(0, 100) + '…' : content;
  }

  toggleShowAll(): void {
    this.showAll = !this.showAll;
    this.updateVisibleSessions();
  }

  private updateVisibleSessions(): void {
    if (this.showAll) {
      this.visibleSessions = this.sessions;
    } else {
      this.visibleSessions = this.sessions.slice(0, 5);
    }
  }

  deleteSession(sessionId: string, event: MouseEvent): void {
    event.stopPropagation();

    if (this.settingsService.getSkipDeleteConfirmation()) {
      this.performDelete(sessionId);
      return;
    }

    const dialogRef = this.dialog.open(
      ChatHistoryDeletionConfirmationDialogComponent,
      {
        data: {
          title: 'Delete Chat History',
          message: 'Are you sure you want to delete this chat history?',
        },
      },
    );

    dialogRef.afterClosed().subscribe((result) => {
      if (result?.confirmed) {
        if (result.rememberChoice) {
          this.settingsService.setSkipDeleteConfirmation(true);
        }
        this.performDelete(sessionId);
      }
    });
  }

  private performDelete(sessionId: string): void {
    this.chatHistoryService.deleteSession(sessionId);
    this.sessions = this.chatHistoryService.getAllSessions();
    this.updateVisibleSessions();
    if (this.chatService.getActiveSession()?.id === sessionId) {
      this.chatService.startNewSession();
    }
  }
}

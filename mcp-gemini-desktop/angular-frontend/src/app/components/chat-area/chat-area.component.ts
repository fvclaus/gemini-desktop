import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, NgFor } from '@angular/common';
import { ChatMessageComponent } from './chat-message/chat-message.component';
import { ChatInputComponent } from './chat-input/chat-input.component';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ChatService } from '../../services/chat.service'; // Import ChatService
import { Message } from '../../services/chat.service'; // Import Message from ChatService or a shared types file
import { Subscription } from 'rxjs';

// Message interface is now likely in ChatService or a shared types file.
// If Message is directly from ChatService, the export below can be removed if not strictly needed
// by other components that *only* have access to ChatAreaComponent's exports.
export type { Message }; // Re-export if needed by template or other components directly using ChatAreaComponent's Message type

@Component({
  selector: 'app-chat-area',
  standalone: true,
  imports: [
    CommonModule,
    NgFor,
    ChatMessageComponent,
    ChatInputComponent,
    MatToolbarModule,
  ],
  templateUrl: './chat-area.component.html',
  styleUrl: './chat-area.component.css',
})
export class ChatAreaComponent implements OnInit, OnDestroy {
  private chatService = inject(ChatService);

  messages: Message[] = [];
  private messagesSubscription: Subscription | undefined;

  ngOnInit(): void {
    this.messagesSubscription = this.chatService.messages$.subscribe(
      (newMessages) => {
        this.messages = newMessages;
      },
    );
  }

  handleMessageSent(messageText: string): void {
    if (messageText && messageText.trim().length > 0) {
      this.chatService.sendMessage(messageText);
    }
  }

  ngOnDestroy(): void {
    if (this.messagesSubscription) {
      this.messagesSubscription.unsubscribe();
    }
  }
}

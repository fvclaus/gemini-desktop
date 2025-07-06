import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, NgFor } from '@angular/common';
import { ChatMessageComponent } from './chat-message/chat-message.component';
import { ChatInputComponent } from './chat-input/chat-input.component';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ChatService, ToolRequestMessage } from '../../services/chat.service'; // Import ChatService
import { Message } from '../../services/chat.service'; // Import Message from ChatService or a shared types file
import { Subscription } from 'rxjs';
import { SettingsService } from '../../services/settings.service';

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
  private settingsService = inject(SettingsService);

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
    const profile = this.settingsService.getActiveProfile();
    if (messageText && messageText.trim().length > 0) {
      this.chatService.sendMessage(profile, messageText);
    }
  }

  handleToolResponse(event: {
    message: ToolRequestMessage;
    approved: boolean;
  }) {
    const profile = this.settingsService.getActiveProfile();
    this.chatService.sendToolResponse(
      profile,
      event.approved,
      event.message.tools,
    );
  }

  ngOnDestroy(): void {
    if (this.messagesSubscription) {
      this.messagesSubscription.unsubscribe();
    }
  }
}

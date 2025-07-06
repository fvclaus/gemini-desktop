import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { ChatMessageComponent } from './chat-message/chat-message.component';
import { ChatInputComponent } from './chat-input/chat-input.component';
import { MatToolbarModule } from '@angular/material/toolbar';
import {
  AiMessage,
  ChatService,
  Message,
  ToolRequestMessage,
} from '../../services/chat.service';
import { Subscription, combineLatest } from 'rxjs';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-chat-area',
  standalone: true,
  imports: [
    CommonModule,
    ChatMessageComponent,
    ChatInputComponent,
    MatToolbarModule,
    MatProgressBarModule,
    MatChipsModule
],
  templateUrl: './chat-area.component.html',
  styleUrl: './chat-area.component.css',
})
export class ChatAreaComponent implements OnInit, OnDestroy {
  private chatService = inject(ChatService);
  private settingsService = inject(SettingsService);

  messages: Message[] = [];
  totalTokensUsed = 0;
  inputTokenLimit = 0;
  totalCost = 0;

  private subscriptions = new Subscription();

  ngOnInit(): void {
    this.subscriptions.add(
      combineLatest([
        this.chatService.messages$,
        this.settingsService.activeProfile$,
      ]).subscribe(([newMessages, activeProfile]) => {
        this.messages = newMessages;
        this.inputTokenLimit =
          activeProfile?.modelInstance?.inputTokenLimit || 0;

        this.totalTokensUsed = newMessages.reduce((sum, message) => {
          if (
            (message.sender === 'ai' && message.type === 'message') ||
            message.type === 'tool_request'
          ) {
            const aiMessage = message as AiMessage | ToolRequestMessage;
            return sum + (aiMessage.usageMetadata?.totalTokenCount || 0);
          }
          return sum;
        }, 0);

        this.totalCost = newMessages.reduce((sum, message) => {
          if (
            (message.sender === 'ai' && message.type === 'message') ||
            message.type === 'tool_request'
          ) {
            const aiMessage = message as AiMessage | ToolRequestMessage;
            return (
              sum +
              (aiMessage.modelInstance?.calculatePrice(
                aiMessage.usageMetadata!,
              ) || 0)
            );
          }
          return sum;
        }, 0);
      }),
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
    this.subscriptions.unsubscribe();
  }
}

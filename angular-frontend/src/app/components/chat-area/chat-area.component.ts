import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { ChatMessageComponent } from './chat-message/chat-message.component';
import { ChatInputComponent } from './chat-input/chat-input.component';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AiMessage, Message, ToolRequestMessage } from '../../domain/messages';
import { Subscription, combineLatest } from 'rxjs';
import {
  GeminiUsageMetadata,
  ProfilesService,
} from '../../services/profiles.service';
import { AbstractGeminiModel } from '../../domain/models';
import { UsageMetadataDisplayComponent } from '../usage-metadata-display/usage-metadata-display.component';
import { ChatService } from '../../services/chat.service';

@Component({
  selector: 'app-chat-area',
  standalone: true,
  imports: [
    CommonModule,
    ChatMessageComponent,
    ChatInputComponent,
    MatToolbarModule,
    MatProgressBarModule,
    MatChipsModule,
    UsageMetadataDisplayComponent,
  ],
  templateUrl: './chat-area.component.html',
  styleUrl: './chat-area.component.css',
})
export class ChatAreaComponent implements OnInit, OnDestroy {
  private chatService = inject(ChatService);
  private profilesService = inject(ProfilesService);

  messages: Message[] = [];
  totalTokensUsed = 0;
  inputTokenLimit = 0;
  totalCost = 0;
  aggregatedUsageMetadata: GeminiUsageMetadata = {};
  aggregatedModelInstance?: AbstractGeminiModel;

  private subscriptions = new Subscription();

  ngOnInit(): void {
    this.subscriptions.add(
      combineLatest([
        this.chatService.messages$,
        this.profilesService.activeProfile$,
      ]).subscribe(([newMessages, activeProfile]) => {
        this.messages = newMessages;
        this.inputTokenLimit = activeProfile?.model?.inputTokenLimit || 0;

        this.aggregatedUsageMetadata = {};
        this.aggregatedModelInstance = activeProfile?.model;

        this.totalCost = 0;

        this.totalTokensUsed = newMessages.reduce((sum, message) => {
          if (
            (message.sender === 'ai' && message.type === 'message') ||
            message.type === 'tool_request'
          ) {
            const aiMessage = message as AiMessage | ToolRequestMessage;
            this.aggregateUsageMetadata(aiMessage.usageMetadata);
            this.totalCost += aiMessage.model.calculatePrice(
              aiMessage.usageMetadata!,
            );
            return sum + (aiMessage.usageMetadata?.totalTokenCount || 0);
          }
          return sum;
        }, 0);
      }),
    );
  }

  private aggregateUsageMetadata(metadata?: GeminiUsageMetadata): void {
    if (!metadata) {
      return;
    }

    for (const key in metadata) {
      if (Object.prototype.hasOwnProperty.call(metadata, key)) {
        const typedKey = key as keyof GeminiUsageMetadata;
        if (typeof metadata[typedKey] === 'number') {
          this.aggregatedUsageMetadata[typedKey] =
            (this.aggregatedUsageMetadata[typedKey] || 0) +
            (metadata[typedKey] || 0);
        }
      }
    }
  }

  handleMessageSent(messageText: string): void {
    const profile = this.profilesService.getActiveProfile();
    if (messageText && messageText.trim().length > 0) {
      this.chatService.sendMessage(profile, messageText);
    }
  }

  handleToolResponse(event: {
    message: ToolRequestMessage;
    approved: boolean;
  }) {
    const profile = this.profilesService.getActiveProfile();
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

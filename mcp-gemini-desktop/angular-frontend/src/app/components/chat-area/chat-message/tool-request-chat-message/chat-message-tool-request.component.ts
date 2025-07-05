import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import {
  ChatService,
  ToolRequestMessage,
} from '../../../../services/chat.service';
import { MatCardModule } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'app-chat-message-tool-request',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIcon],
  templateUrl: './chat-message-tool-request.component.html',
  styleUrl: './chat-message-tool-request.component.css',
})
export class ToolRequestChatMessageComponent {
  private chatService = inject(ChatService);

  @Input() message!: ToolRequestMessage;

  onToolResponse(approved: boolean): void {
    if (this.message) {
      this.chatService.sendToolResponse(approved, this.message.tools);
      // TODO persist this somehow
      this.message.showRequestedTools = false;
    }
  }
}

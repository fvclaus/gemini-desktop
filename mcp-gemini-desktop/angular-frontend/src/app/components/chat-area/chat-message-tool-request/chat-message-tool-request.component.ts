import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { ChatService, Message, ToolRequestMessage } from '../../../services/chat.service';
import { FunctionCall } from '@google/genai';

@Component({
  selector: 'app-chat-message-tool-request',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './chat-message-tool-request.component.html',
  styleUrl: './chat-message-tool-request.component.css'
})
export class ChatMessageToolRequestComponent {
  @Input() message!: ToolRequestMessage;

  constructor(private chatService: ChatService) {}

  onToolResponse(approved: boolean, toolCall: FunctionCall): void {
    if (this.message) {
      this.chatService.sendToolResponse(approved, toolCall);
      // Visually disable the buttons after an action is taken
      if ('tool_calls' in this.message && this.message.tool_calls) {
        this.message.tool_calls = this.message.tool_calls.filter((tc: any) => tc !== toolCall);
      }
    }
  }

  getDetailsContent(): string {
    return this.message.text;
  }

}

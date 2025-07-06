import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { ToolRequestMessage } from '../../../../services/chat.service';
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
  @Input() message!: ToolRequestMessage;
  @Output() toolResponse = new EventEmitter<{
    message: ToolRequestMessage;
    approved: boolean;
  }>();

  onToolResponse(approved: boolean): void {
    // TODO persist this somehow
    this.message.showRequestedTools = false;
    this.toolResponse.emit({ message: this.message, approved });
  }
}

import { Component, Input, ViewEncapsulation } from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ToolResultMessage } from '../../../../services/chat.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tool-result-chat-message',
  standalone: true,
  imports: [MatCardModule, MatIconModule, CommonModule],
  templateUrl: './tool-result-chat-message.component.html',
  styleUrl: './tool-result-chat-message.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class ToolResultChatMessageComponent {
  @Input() message!: ToolResultMessage;
}

import { Component, Input } from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ToolResultMessage } from '../../../../services/chat.service';

@Component({
  selector: 'app-tool-result-chat-message',
  standalone: true,
  imports: [MatCardModule, MatIconModule],
  templateUrl: './tool-result-chat-message.component.html',
  styleUrl: './tool-result-chat-message.component.css',
})
export class ToolResultChatMessageComponent {
  @Input() message!: ToolResultMessage;
}

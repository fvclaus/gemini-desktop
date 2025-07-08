import { Component, Input } from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ToolDecisionMessage } from '../../../../services/chat.service';

@Component({
  selector: 'app-tool-decision-chat-message',
  standalone: true,
  imports: [MatCardModule, MatIconModule],
  templateUrl: './tool-decision-chat-message.component.html',
  styleUrl: './tool-decision-chat-message.component.css',
})
export class ToolDecisionChatMessageComponent {
  @Input() message!: ToolDecisionMessage;
}

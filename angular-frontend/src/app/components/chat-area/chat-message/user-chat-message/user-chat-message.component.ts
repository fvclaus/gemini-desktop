import { Component, Input } from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { UserMessage } from '../../../../domain/messages';

@Component({
  selector: 'app-user-chat-message',
  standalone: true,
  imports: [MatCardModule],
  templateUrl: './user-chat-message.component.html',
  styleUrl: './user-chat-message.component.css',
})
export class UserChatMessageComponent {
  @Input() message!: UserMessage;
}

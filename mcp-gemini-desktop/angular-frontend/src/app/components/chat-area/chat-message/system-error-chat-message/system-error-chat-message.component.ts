import { Component, Input } from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { SystemErrorMessage } from '../../../../services/chat.service';

@Component({
  selector: 'app-system-error-chat-message',
  standalone: true,
  imports: [MatCardModule, MatIconModule],
  templateUrl: './system-error-chat-message.component.html',
  styleUrl: './system-error-chat-message.component.css',
})
export class SystemErrorChatMessageComponent {
  @Input() message!: SystemErrorMessage;
}

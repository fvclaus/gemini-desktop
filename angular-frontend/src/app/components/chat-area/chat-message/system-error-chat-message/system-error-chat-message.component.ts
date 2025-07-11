import { Component, Input, ViewEncapsulation } from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { SystemErrorMessage } from '../../../../domain/messages';

@Component({
  selector: 'app-system-error-chat-message',
  standalone: true,
  imports: [MatCardModule, MatIconModule],
  templateUrl: './system-error-chat-message.component.html',
  styleUrl: './system-error-chat-message.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class SystemErrorChatMessageComponent {
  @Input() message!: SystemErrorMessage;
}

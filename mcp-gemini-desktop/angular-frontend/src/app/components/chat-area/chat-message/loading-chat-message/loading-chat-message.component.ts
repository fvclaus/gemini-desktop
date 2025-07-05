import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { LoadingMessage } from '../../../../services/chat.service';

@Component({
  selector: 'app-loading-chat-message',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  templateUrl: './loading-chat-message.component.html',
  styleUrl: './loading-chat-message.component.css',
})
export class LoadingChatMessageComponent {
  @Input() message!: LoadingMessage;
}

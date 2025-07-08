import { Component, Input, SecurityContext, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { AiMessage } from '../../../../services/chat.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { UsageMetadataDisplayComponent } from '../../../usage-metadata-display/usage-metadata-display.component';

@Component({
  selector: 'app-ai-message-chat-message',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatChipsModule,
    UsageMetadataDisplayComponent,
  ],
  templateUrl: './ai-message-chat-message.component.html',
  styleUrl: './ai-message-chat-message.component.css',
})
export class AiMessageChatMessageComponent {
  private sanitizer = inject(DomSanitizer);

  @Input() message!: AiMessage;

  getFormattedContent(): SafeHtml {
    return (
      this.sanitizer.sanitize(SecurityContext.HTML, this.message.htmlContent) ||
      ''
    );
  }
}

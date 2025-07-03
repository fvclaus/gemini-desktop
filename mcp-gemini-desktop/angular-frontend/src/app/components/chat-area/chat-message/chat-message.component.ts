import { Component, Input, SecurityContext } from '@angular/core';
import { CommonModule, NgClass, NgIf } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ChatService, Message } from '../../../services/chat.service'; // Import ChatService and Message interface
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ChatMessageToolRequestComponent } from '../chat-message-tool-request/chat-message-tool-request.component';

@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [CommonModule, NgClass, NgIf, MatCardModule, MatIconModule, MatButtonModule, ChatMessageToolRequestComponent],
  templateUrl: './chat-message.component.html',
  styleUrl: './chat-message.component.css'
})
export class ChatMessageComponent {
  @Input() message!: Message;

  constructor(private sanitizer: DomSanitizer, private chatService: ChatService) {}

  isSystemMessage(): boolean {
    return this.message.sender === 'system';
  }

  isToolStatusMessage(): boolean {
    return this.message.sender === 'system' &&  this.message.type === 'tool_result';
  }

  isDetailsOpen(): boolean {
    return this.isToolStatusMessage() || this.isErrorMessage() || 
      (this.message.sender === 'system' && this.message.type == 'tool_request');
  }

  private isErrorMessage(): boolean {
    return this.message.sender === 'system' && this.message.type === 'error';
  }

  getSummaryColor(): string | null {
    if (this.isErrorMessage()) {
      return 'var(--status-error)';
    }
    return null;
  }

  getSummaryIconName(): string {

    if (this.message.sender === 'user') {
      return 'info_outline';
    }

    switch (this.message.type) {
      case 'tool_request':
        return 'build';
      case 'tool_result':
        const isError = this.message.details?.toLowerCase().includes('error');
        return isError ? 'error_outline' : 'check_circle_outline';
      case 'error':
        return 'warning_amber';
      case 'log':
      default:
        return 'info_outline';
    }
  }

  getSummaryText(): string {

    if (this.message.sender === 'user') {
      return this.message.text;
    }

    switch (this.message.type) {
      case 'tool_request':
        return 'Tool Call Request';
      case 'tool_result':
        return `Tool Result: ${this.message.text}`;
      case 'error':
        return 'System Error';
      case 'log':
        return 'System Log';
      case 'loading': 
        return '...';
      default:
        return this.message.text || 'System Message';
    }
  }

  getDetailsContent(): string {
    // TODO
    return (this.message as any).text;
  }

  getFormattedContent(): SafeHtml {
    if (this.message.sender === 'system') {
      // System messages are handled by summary/details, or have no formatted content part
      return '';
    }

    if (this.message.sender === 'ai' && this.message.type === 'loading') {
      return '...';
    }

    // If htmlContent is pre-rendered by the service, use it directly
    if (this.message.sender === 'ai' && this.message.type === 'text') {
      // Sanitize it once more, just in case, though service should also sanitize.
      return this.sanitizer.sanitize(SecurityContext.HTML, this.message.htmlContent) || '';
    }

    // Fallback to sanitizing raw text if htmlContent is not available (e.g., for user messages)
    // User messages typically don't need Markdown/LaTeX processing on the client.
    // If they did, that logic would go here.
    const sanitizedText = this.sanitizer.sanitize(SecurityContext.HTML, this.message.text);
    return sanitizedText || '';
  }

}

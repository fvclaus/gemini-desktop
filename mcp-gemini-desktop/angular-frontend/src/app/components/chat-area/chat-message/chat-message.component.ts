import { Component, Input, SecurityContext } from '@angular/core';
import { CommonModule, NgClass, NgIf } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ChatService, Message } from '../../../services/chat.service'; // Import ChatService and Message interface
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [CommonModule, NgClass, NgIf, MatCardModule, MatIconModule, MatButtonModule],
  templateUrl: './chat-message.component.html',
  styleUrl: './chat-message.component.css'
})
export class ChatMessageComponent {
  @Input() message: Message | undefined;

  constructor(private sanitizer: DomSanitizer, private chatService: ChatService) {}

  isSystemMessage(): boolean {
    return this.message?.sender === 'system';
  }

  isToolStatusMessage(): boolean {
    return this.message?.type === 'tool_result';
  }

  isDetailsOpen(): boolean {
    return this.isToolStatusMessage() || this.message?.type === 'error' || this.message?.type === 'tool_request';
  }

  getSummaryColor(): string | null {
    if (this.message?.type === 'tool_result') {
      const isError = this.message.details?.toLowerCase().includes('error');
      return isError ? 'var(--status-error)' : null;
    }
    if (this.message?.type === 'error') {
      return 'var(--status-error)';
    }
    return null;
  }

  getSummaryIconName(): string {
    if (!this.message || !this.message.type) return 'info_outline';

    switch (this.message.type) {
      case 'tool_request':
        return 'build';
      case 'tool_result':
        const isError = this.message.details?.toLowerCase().includes('error');
        return isError ? 'error_outline' : 'check_circle_outline';
      case 'error':
        return 'warning_amber';
      case 'log':
      case 'welcome':
      default:
        return 'info_outline';
    }
  }

  getSummaryText(): string {
    if (!this.message) return '';

    switch (this.message.type) {
      case 'tool_request':
        return 'Tool Call Request';
      case 'tool_result':
        return `Tool Result: ${this.message.text}`;
      case 'error':
        return 'System Error';
      case 'welcome':
        return 'Welcome';
      case 'log':
        return 'System Log';
      default:
        return this.message.text || 'System Message';
    }
  }

  getDetailsContent(): string {
    if (!this.message) return '';
    if (this.message.type === 'tool_result' || this.message.type === 'error') {
      return this.message.details || this.message.text;
    }
    return this.message.text;
  }

  getFormattedContent(): SafeHtml {
    if (!this.message || this.message.sender === 'system') {
      // System messages are handled by summary/details, or have no formatted content part
      return '';
    }

    // If htmlContent is pre-rendered by the service, use it directly
    if (this.message.htmlContent) {
      // Sanitize it once more, just in case, though service should also sanitize.
      return this.sanitizer.sanitize(SecurityContext.HTML, this.message.htmlContent) || '';
    }

    // Fallback to sanitizing raw text if htmlContent is not available (e.g., for user messages)
    // User messages typically don't need Markdown/LaTeX processing on the client.
    // If they did, that logic would go here.
    const sanitizedText = this.sanitizer.sanitize(SecurityContext.HTML, this.message.text);
    return sanitizedText || '';
  }

  onToolResponse(approved: boolean, toolCall: any): void {
    if (this.message) {
      this.chatService.sendToolResponse(approved, toolCall);
      // Visually disable the buttons after an action is taken
      if (this.message.tool_calls) {
        this.message.tool_calls = this.message.tool_calls.filter(tc => tc !== toolCall);
      }
    }
  }
}

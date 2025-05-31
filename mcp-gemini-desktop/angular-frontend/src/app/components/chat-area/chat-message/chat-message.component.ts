import { Component, Input, SecurityContext } from '@angular/core';
import { CommonModule, NgClass, NgIf } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
// marked and katex are not directly used here anymore if ChatService pre-renders HTML
// import { marked } from 'marked';
// import katex from 'katex';
import { Message } from '../../../services/chat.service'; // Import Message interface from ChatService
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [CommonModule, NgClass, NgIf, MatCardModule, MatIconModule],
  templateUrl: './chat-message.component.html',
  styleUrl: './chat-message.component.css'
})
export class ChatMessageComponent {
  @Input() message: Message | undefined;

  constructor(private sanitizer: DomSanitizer) {}

  isSystemMessage(): boolean {
    return this.message?.sender === 'system';
  }

  isToolStatusMessage(): boolean {
    return this.message?.type === 'tool_call_start' || this.message?.type === 'tool_call_end';
  }

  // Helper to determine if the details section should be open by default
  isDetailsOpen(): boolean {
    return this.isToolStatusMessage() || this.message?.type === 'error';
  }

  getSummaryColor(): string | null {
    if (this.message?.type === 'tool_call_end') {
      const isError = this.message.details?.toLowerCase().includes('error'); // A bit simplistic, might need refinement
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
      case 'tool_call_start':
        return 'hourglass_empty';
      case 'tool_call_end':
        const isError = this.message.details?.toLowerCase().includes('error');
        return isError ? 'error_outline' : 'check_circle_outline';
      case 'error':
        return 'warning_amber';
      case 'log':
      case 'welcome':
      case 'tool_announcement': // Could have a specific icon
      default:
        return 'info_outline';
    }
  }

  getSummaryText(): string {
    if (!this.message) return '';

    switch (this.message.type) {
      case 'tool_call_start':
        const toolNameStart = this.message.details?.split(' ')[0] || 'Unknown Tool';
        return `Calling Tool: ${toolNameStart}...`;
      case 'tool_call_end':
        const toolNameEnd = this.message.details?.split(' ')[0] || 'Unknown Tool';
        const isError = this.message.details?.toLowerCase().includes('error');
        return `Tool Finished: ${toolNameEnd} (${isError ? 'Error' : 'Success'})`;
      case 'error':
        return 'System Error';
      case 'welcome':
        return 'Welcome';
      case 'log':
        return 'System Log';
      case 'tool_announcement':
        return 'Tool Announcement'; // Or use message.text directly
      default:
        return this.message.text || 'System Message'; // Fallback for general system messages
    }
  }

  getDetailsContent(): string {
    if (!this.message) return '';
    // For tool calls and errors, 'details' field is preferred.
    // For other system messages, 'text' might be the primary content.
    if (this.message.type === 'tool_call_start' || this.message.type === 'tool_call_end' || this.message.type === 'error') {
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
}

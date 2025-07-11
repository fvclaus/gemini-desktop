import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { UserChatMessageComponent } from './user-chat-message/user-chat-message.component';
import { AiMessageChatMessageComponent } from './ai-message-chat-message/ai-message-chat-message.component';
import { LoadingChatMessageComponent } from './loading-chat-message/loading-chat-message.component';
import { SystemErrorChatMessageComponent } from './system-error-chat-message/system-error-chat-message.component';
import { ToolDecisionChatMessageComponent } from './tool-decision-chat-message/tool-decision-chat-message.component';
import { ToolResultChatMessageComponent } from './tool-result-chat-message/tool-result-chat-message.component';
import { ToolRequestChatMessageComponent } from './tool-request-chat-message/chat-message-tool-request.component';
import { Message, ToolRequestMessage } from '../../../domain/messages';

@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [
    CommonModule,
    NgClass,
    MatCardModule,
    UserChatMessageComponent,
    AiMessageChatMessageComponent,
    LoadingChatMessageComponent,
    SystemErrorChatMessageComponent,
    ToolDecisionChatMessageComponent,
    ToolResultChatMessageComponent,
    ToolRequestChatMessageComponent,
  ],
  templateUrl: './chat-message.component.html',
  styleUrl: './chat-message.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class ChatMessageComponent {
  @Input() message!: Message;
  @Output() toolResponse = new EventEmitter<{
    message: ToolRequestMessage;
    approved: boolean;
  }>();

  handleToolResponse(event: {
    message: ToolRequestMessage;
    approved: boolean;
  }) {
    this.toolResponse.emit(event);
  }
}

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { UsageMetadataDisplayComponent } from '../../../usage-metadata-display/usage-metadata-display.component';
import { ToolRequestMessage } from '../../../../domain/messages';

@Component({
  selector: 'app-chat-message-tool-request',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIcon,
    MatChipsModule,
    UsageMetadataDisplayComponent,
  ],
  templateUrl: './chat-message-tool-request.component.html',
  styleUrl: './chat-message-tool-request.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class ToolRequestChatMessageComponent {
  @Input() message!: ToolRequestMessage;
  @Output() toolResponse = new EventEmitter<{
    message: ToolRequestMessage;
    approved: boolean;
  }>();

  onToolResponse(approved: boolean): void {
    // TODO persist this somehow
    this.message.showRequestedTools = false;
    this.toolResponse.emit({ message: this.message, approved });
  }
}

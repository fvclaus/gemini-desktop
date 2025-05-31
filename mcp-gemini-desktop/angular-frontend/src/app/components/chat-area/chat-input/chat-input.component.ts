import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TextFieldModule } from '@angular/cdk/text-field'; // For CdkTextareaAutosize

@Component({
  selector: 'app-chat-input',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    TextFieldModule
  ],
  templateUrl: './chat-input.component.html',
  styleUrl: './chat-input.component.css'
})
export class ChatInputComponent {
  @Output() messageSent = new EventEmitter<string>();
  messageText: string = '';

  sendMessageOnEnter(event: Event): void {
    // Check if it's a KeyboardEvent and the Enter key (without Shift)
    if (event instanceof KeyboardEvent && event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  sendMessage(): void {
    if (this.messageText.trim()) {
      this.messageSent.emit(this.messageText.trim());
      this.messageText = '';
      // Textarea autosize should handle reset, but manual adjustment might be needed
      // if specific visual behavior is desired after send.
    }
  }

  adjustTextareaHeight(event: Event): void {
    // CDK's autosize directive handles this automatically.
    // This method can be removed if no additional logic is needed on input.
    // For now, keeping it in case specific logic is added later.
    const textarea = event.target as HTMLTextAreaElement;
    // console.log('Textarea scrollHeight:', textarea.scrollHeight);
  }
}

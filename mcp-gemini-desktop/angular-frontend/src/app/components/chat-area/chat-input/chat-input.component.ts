import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TextFieldModule } from '@angular/cdk/text-field';
import { CommonModule } from '@angular/common';
import { ModalService } from '../../../services/modal.service';
import { MatDivider, MatDividerModule } from '@angular/material/divider';
import { SettingsService } from '../../../services/settings.service';

@Component({
  selector: 'app-chat-input',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    TextFieldModule,
    MatDividerModule
  ],
  templateUrl: './chat-input.component.html',
  styleUrl: './chat-input.component.css'
})
export class ChatInputComponent {
  @Output() messageSent = new EventEmitter<string>();
  messageText: string = '';
  isModelDropdownOpen = false;

  models: string[] = []
  selectedModel: string | null = null;

  constructor(
    private settingsService: SettingsService,
    private modalService: ModalService
  ) {
    this.models = settingsService.getModels();
    this.selectedModel = settingsService.getModel();
  }

  sendMessageOnEnter(event: Event): void {
    if (event instanceof KeyboardEvent && event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  sendMessage(): void {
    if (this.messageText.trim()) {
      this.messageSent.emit(this.messageText.trim());
      this.messageText = '';
    }
  }

  toggleModelDropdown(): void {
    this.isModelDropdownOpen = !this.isModelDropdownOpen;
  }

  selectModel(modelName: string): void {
    this.settingsService.setModel(modelName);
    this.isModelDropdownOpen = false;
  }

  editSettings(): void {
    this.modalService.open('settings-modal');
  }
}

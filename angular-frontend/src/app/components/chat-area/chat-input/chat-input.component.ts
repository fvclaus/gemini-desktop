import { Component, EventEmitter, inject, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TextFieldModule } from '@angular/cdk/text-field';

import { MatDividerModule } from '@angular/material/divider';
import { ProfileSelectorComponent } from '../../profile-selector/profile-selector.component';
import { ProfilesService } from '../../../services/profiles.service';
import { CommonModule } from '@angular/common';
import { PillComponent } from '../../pill/pill.component';

@Component({
  selector: 'app-chat-input',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    TextFieldModule,
    MatDividerModule,
    ProfileSelectorComponent,
    CommonModule,
    PillComponent,
  ],
  templateUrl: './chat-input.component.html',
  styleUrl: './chat-input.component.css',
})
export class ChatInputComponent {
  @Output() messageSent = new EventEmitter<string>();
  private profilesService = inject(ProfilesService);
  public activeProfile$ = this.profilesService.activeProfile$;
  messageText = '';
  sendMessageOnEnter(event: Event): void {
    if (
      event instanceof KeyboardEvent &&
      event.key === 'Enter' &&
      !event.shiftKey
    ) {
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
}

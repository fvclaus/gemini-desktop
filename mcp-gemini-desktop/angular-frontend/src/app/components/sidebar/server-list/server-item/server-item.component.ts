import { Component, Input } from '@angular/core';
import { CommonModule, NgClass, NgFor, NgIf } from '@angular/common';
import { ChatService, Server } from '../../../../services/chat.service'; // Import ChatService and Server interface
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion'; // Import MatExpansionModule

@Component({
  selector: 'app-server-item',
  standalone: true,
  imports: [
    CommonModule,
    NgClass,
    NgFor,
    NgIf,
    MatListModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    MatExpansionModule // Add MatExpansionModule to imports
  ],
  templateUrl: './server-item.component.html',
  styleUrl: './server-item.component.css'
})
export class ServerItemComponent {
  @Input() server: Server | undefined;

  constructor(private chatService: ChatService) {}

  deleteServer(): void {
    if (this.server && this.server.identifier) {
      // TODO
      // this.chatService.deleteServer(this.server.identifier);
    } else {
      console.error('Cannot delete server: server data or identifier is missing.', this.server);
    }
  }
}

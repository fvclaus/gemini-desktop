import { Component, Input, inject } from '@angular/core'; // Import ChangeDetectionStrategy
import { CommonModule } from '@angular/common';
import { ChatService } from '../../../../services/chat.service'; // Import ChatService
import {
  McpServerStatus,
  McpToolDefinition,
} from '../../../../../../../src/shared/types';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion'; // Import MatExpansionModule
import { MatDialog } from '@angular/material/dialog';
import { ToolInfoDialogComponent } from '../../../tool-info-dialog/tool-info-dialog.component';

const serverToPanelStatus: Record<string, boolean> = {};

@Component({
  selector: 'app-server-item',
  standalone: true,
  imports: [
    CommonModule,
    MatListModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    MatExpansionModule, // Add MatExpansionModule to imports
  ],
  templateUrl: './server-item.component.html',
  styleUrl: './server-item.component.css',
})
export class ServerItemComponent {
  private chatService = inject(ChatService);
  private dialog = inject(MatDialog);

  @Input() server!: McpServerStatus;

  isPanelOpened(): boolean {
    return serverToPanelStatus[this.server.identifier];
  }

  onPanelOpened(): void {
    serverToPanelStatus[this.server.identifier] = true;
  }

  onPanelClosed(): void {
    serverToPanelStatus[this.server.identifier] = false;
  }

  openToolDialog(tool: McpToolDefinition): void {
    this.dialog.open(ToolInfoDialogComponent, {
      width: '600px',
      data: { tool, serverName: this.server.identifier },
    });
  }

  deleteServer(): void {
    if (this.server && this.server.identifier) {
      // TODO
      // this.chatService.deleteServer(this.server.name);
    } else {
      console.error(
        'Cannot delete server: server data or name is missing.',
        this.server,
      );
    }
  }

  toggleToolVisibility(tool: McpToolDefinition): void {
    this.chatService.setToolVisibility(
      this.server.identifier,
      tool.name,
      !tool.hidden,
    );
  }
}

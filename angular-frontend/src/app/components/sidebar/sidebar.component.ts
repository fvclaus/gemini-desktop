import { Component, inject } from '@angular/core';

import { WorkspaceComponent } from './workspace/workspace.component';
// WorkspaceStateService might still be used by WorkspaceComponent, but SidebarComponent itself doesn't directly use its state here.
// import { WorkspaceStateService, WorkspaceState } from '../../services/workspace-state.service';
import { ServerListComponent } from './server-list/server-list.component';
import { ChatService } from '../../services/chat.service';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ChatHistoryComponent } from '../chat-history/chat-history.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    WorkspaceComponent,
    ServerListComponent,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    ChatHistoryComponent,
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  private chatService = inject(ChatService);

  public activeTab: 'new' | 'servers' = 'new';

  setTab(tab: 'new' | 'servers'): void {
    this.activeTab = tab;
  }

  newChat(): void {
    this.chatService.startNewSession();
    this.setTab('new');
  }
}

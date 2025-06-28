import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkspaceComponent } from './workspace/workspace.component';
// WorkspaceStateService might still be used by WorkspaceComponent, but SidebarComponent itself doesn't directly use its state here.
// import { WorkspaceStateService, WorkspaceState } from '../../services/workspace-state.service';
import { ServerListComponent } from './server-list/server-list.component';
import { ChatService } from '../../services/chat.service';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ModalService } from '../../services/modal.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    WorkspaceComponent,
    ServerListComponent,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {
  public activeTab: 'new' | 'servers' = 'new';

  constructor(private chatService: ChatService, private modalService: ModalService) {}

  addServer(): void {
    this.chatService.openAddServerDialog();
  }

  setTab(tab: 'new' | 'servers'): void {
    this.activeTab = tab;
  }
}

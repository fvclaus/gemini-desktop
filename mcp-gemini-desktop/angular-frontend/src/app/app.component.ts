import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { ChatAreaComponent } from './components/chat-area/chat-area.component';
import { MatSidenavModule } from '@angular/material/sidenav';
// Removed WorkspaceState import from WorkspaceComponent, WorkspaceComponent itself is still needed for the template
import { WorkspaceComponent } from './components/sidebar/workspace/workspace.component';
import { WorkspaceStateService, WorkspaceState } from './services/workspace-state.service'; // Corrected path
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    SidebarComponent,
    ChatAreaComponent,
    MatSidenavModule,
    WorkspaceComponent, // Add WorkspaceComponent here
    MatProgressSpinnerModule,
    MatButtonModule,
    MatIcon
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'GemCP Chat';
  // Removed local workspaceState property

  constructor(
    private cdr: ChangeDetectorRef, // cdr might still be useful for other async operations not related to signals
    public workspaceStateService: WorkspaceStateService // Injected service, public for template access to signal
  ) {}

  // Removed onWorkspaceStateChanged method

  // Getter for easier access in template, though direct service signal access is also possible
  get currentWorkspaceState(): WorkspaceState {
    return this.workspaceStateService.workspaceState();
  }
  // Expose a method for the template to call if the workspace component needs to re-trigger a prompt
  // This might be useful if the initial prompt in WorkspaceComponent fails and we want a button in AppComponent's "no workspace" view.
  // For now, WorkspaceComponent handles its own button clicks.
  // async requestWorkspaceSelection(): Promise<void> {
  //   // This would typically call a method on the WorkspaceComponent instance,
  //   // or WorkspaceComponent would expose an event that AppComponent listens to.
  //   // For now, WorkspaceComponent's button directly calls its internal methods.
  // }

  get showMainContent(): boolean {
    const state = this.currentWorkspaceState;
    return !state.isLoading && !!state.path && !state.error;
  }
}

import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { ChatAreaComponent } from './components/chat-area/chat-area.component';
import { MatSidenavModule } from '@angular/material/sidenav';
import { WorkspaceComponent } from './components/sidebar/workspace/workspace.component';
import { WorkspaceStateService, WorkspaceState } from './services/workspace-state.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { SettingsModalComponent } from './components/settings-modal/settings-modal.component';
import { SettingsComponent } from './components/settings/settings.component';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    SidebarComponent,
    ChatAreaComponent,
    MatSidenavModule,
    WorkspaceComponent,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatIcon,
    SettingsModalComponent,
    SettingsComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'GemCP Chat';

  constructor(
    private cdr: ChangeDetectorRef,
    public workspaceStateService: WorkspaceStateService,
  ) {
  }

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

import { Component, OnInit, ChangeDetectorRef, NgZone, Signal } from '@angular/core'; // Removed Output, EventEmitter
import { CommonModule } from '@angular/common';
import { WorkspaceStateService, WorkspaceState } from '../../../services/workspace-state.service'; // Import service and interface
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable } from 'rxjs';

// Removed Electron API typings (moved to types.d.ts)

// Removed local WorkspaceState interface, will use the one from WorkspaceStateService

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './workspace.component.html',
  styleUrl: './workspace.component.css'
})
export class WorkspaceComponent {
  public workspaceState$: Signal<WorkspaceState>; // Expose signal to template

  constructor(
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private workspaceStateService: WorkspaceStateService // Injected service
  ) {
    this.workspaceState$ = this.workspaceStateService.workspaceState;
  }


  public extractFolderName(fullPath: string | null): string {
    if (!fullPath) return "N/A";
    // Handles both Unix-like and Windows paths
    const parts = fullPath.replace(/\\/g, '/').split('/');
    return parts.pop() || "Unknown";
  }

  async promptForWorkspace(): Promise<void> {
    if (!window.electronAPI) {
      this.workspaceStateService.setError("Cannot select workspace: Electron API not available.");
      return;
    }
    try {
      this.ngZone.run(() => {
        this.workspaceStateService.setLoading(true);
      });

      await window.electronAPI.changeWorkspaceAndReload();

    } catch (err) {
      this.ngZone.run(() => {
        console.error('WorkspaceComponent: Error prompting for workspace:', err);
        this.workspaceStateService.setError(`Error selecting workspace: ${err instanceof Error ? err.message : String(err)}`);
      });
    }
  }

  async handleChangeWorkspace(): Promise<void> {
    if (!window.electronAPI) {
      this.workspaceStateService.setError("Cannot change workspace: Electron API not available.")
      return;
    }
    try {
      this.ngZone.run(() => {
        this.workspaceStateService.setLoading(true);
      });
      console.log('WorkspaceComponent: Calling changeWorkspaceAndReload.');
      // Main process handles dialog and reload. App will re-initialize.
      await window.electronAPI.changeWorkspaceAndReload();
      // No need to update state here as app reloads.
    } catch (err) {
      this.ngZone.run(() => {
        console.error('WorkspaceComponent: Error changing workspace:', err);
        this.workspaceStateService.setError(`Error changing workspace: ${err instanceof Error ? err.message : String(err)}`);
      });
    }
  }
}


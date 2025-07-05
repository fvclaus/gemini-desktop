import { Injectable, NgZone, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface WorkspaceState {
  path: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialWorkspaceState: WorkspaceState = {
  path: null,
  isLoading: true,
  error: null,
};

@Injectable({
  providedIn: 'root',
})
export class WorkspaceStateService {
  private ngZone = inject(NgZone);
  private http = inject(HttpClient);

  private readonly _state = signal<WorkspaceState>(initialWorkspaceState);

  public readonly workspaceState = this._state.asReadonly();

  constructor() {
    // Inject HttpClient
    this.initializeWorkspace();
  }

  private async initializeWorkspace(): Promise<void> {
    try {
      const path: string | null =
        await window.electronAPI.getInitialWorkspace();
      if (path) {
        await this.setWorkspace(path); // Await the async setWorkspace
      } else {
        this.ngZone.run(() => this.setLoading(false));
      }
    } catch (error: unknown) {
      // Explicitly type error as unknown
      console.error('Error initializing workspace:', error);
      let errorMessage = 'An unknown error occurred during initialization.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      this.ngZone.run(() =>
        this.setError(`Initialization failed: ${errorMessage}`),
      );
    }
  }

  /**
   * Updates the entire workspace state.
   * This method should be called when a complete new state is available,
   * for example, after a workspace selection process.
   * @param newState The complete new WorkspaceState object.
   */
  public updateFullState(newState: WorkspaceState): void {
    this._state.set(newState);
    console.log('WorkspaceStateService: Full state updated to:', newState);
  }

  public setLoading(isLoading: boolean): void {
    this._state.update((s) => ({ ...s, isLoading, error: null, path: null }));
    console.log('WorkspaceStateService: Loading state updated to:', isLoading);
  }

  public setError(errorMessage: string): void {
    this._state.update((s) => ({
      ...s,
      error: errorMessage,
      isLoading: false,
      path: null,
    }));
    console.log('WorkspaceStateService: Error state updated to:', errorMessage);
  }

  public async setWorkspace(workspacePath: string): Promise<void> {
    this._state.update((s) => ({
      ...s,
      path: workspacePath,
      isLoading: false,
      error: null,
    }));
  }
}

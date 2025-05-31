import { Injectable, NgZone, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

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
  providedIn: 'root'
})
export class WorkspaceStateService {
  private readonly _state = signal<WorkspaceState>(initialWorkspaceState);

  public readonly workspaceState = this._state.asReadonly();

  constructor(private ngZone: NgZone, private http: HttpClient) { // Inject HttpClient
    this.initializeWorkspace();
  }

  private async initializeWorkspace(): Promise<void> {
    try {
      const path: string | null = await window.electronAPI.getInitialWorkspace();
      if (path) {
        await this.setWorkspace(path); // Await the async setWorkspace
      } else {
        this.ngZone.run(() => this.setLoading(false));
      }
    } catch (error: unknown) { // Explicitly type error as unknown
      console.error("Error initializing workspace:", error);
      let errorMessage = "An unknown error occurred during initialization.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      this.ngZone.run(() => this.setError(`Initialization failed: ${errorMessage}`));
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
    this._state.update(s => ({ ...s, isLoading, error: null, path: null }));
    console.log('WorkspaceStateService: Loading state updated to:', isLoading);
  }

  
  public setError(errorMessage: string): void {
    this._state.update(s => ({ ...s, error: errorMessage, isLoading: false, path: null }));
    console.log('WorkspaceStateService: Error state updated to:', errorMessage);
  }

  public async setWorkspace(workspacePath: string): Promise<void> {
    this.ngZone.run(() => this.setLoading(true)); // Set loading true before async operation

    try {
      const port = await window.electronAPI.getPythonPort();
      if (!port) {
        throw new Error('Python backend port not available.');
      }
      
      const url = `http://127.0.0.1:${port}/set-workspace`;
      console.log(`WorkspaceStateService: Calling backend to set workspace: ${url} with path: ${workspacePath}`);

      // Using firstValueFrom to convert Observable to Promise for await
      const response = await firstValueFrom(
        this.http.post<{ status: string; message: string; tools?: string[] }>(url, { workspace_path: workspacePath })
      );

      if (response.status === 'success') {
        this.ngZone.run(() => {
          this._state.update(s => ({
            ...s,
            path: workspacePath,
            isLoading: false,
            error: null
          }));
          console.log('WorkspaceStateService: Workspace set and Python backend confirmed:', workspacePath, 'Registered tools:', response.tools);
        });
      } else {
        throw new Error(response.message || 'Failed to set workspace in Python backend.');
      }
    } catch (error) {
      console.error('WorkspaceStateService: Error setting workspace via Python backend:', error);
      let errorMessage = 'An unknown error occurred while setting workspace.';
      if (error instanceof HttpErrorResponse) {
        errorMessage = error.error?.message || error.message || `HTTP error ${error.status}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      this.ngZone.run(() => {
        this.setError(errorMessage); // setLoading(false) is handled by setError
      });
      // Optionally re-throw or decide if this is a critical failure
    }
  }
}
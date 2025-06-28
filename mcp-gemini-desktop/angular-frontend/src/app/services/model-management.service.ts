import { Injectable } from '@angular/core';
import { BehaviorSubject, throwError } from 'rxjs';
import { catchError, tap, finalize } from 'rxjs/operators';
import { SettingsService } from './settings.service';

@Injectable({
  providedIn: 'root'
})
export class ModelManagementService {
  private readonly storageKey = 'gemini-last-model';

  private readonly _models = new BehaviorSubject<string[]>([]);
  public readonly models$ = this._models.asObservable();

  private readonly _selectedModel = new BehaviorSubject<string | null>(null);
  public readonly selectedModel$ = this._selectedModel.asObservable();

  private readonly _isLoading = new BehaviorSubject<boolean>(false);
  public readonly isLoading$ = this._isLoading.asObservable();

  constructor(private settingsService: SettingsService) {}

  initializeModels(): void {
    this._isLoading.next(true);
    this.settingsService.getModels().pipe(
      tap(response => {
        const availableModels = response.models || [];
        this._models.next(availableModels);

        if (availableModels.length > 0) {
          const lastModel = localStorage.getItem(this.storageKey);
          const modelToSelect = lastModel && availableModels.includes(lastModel)
            ? lastModel
            : availableModels[0];
          this.changeModel(modelToSelect);
        }
      }),
      catchError(err => {
        console.error('Failed to initialize models:', err);
        this._models.next([]);
        this._selectedModel.next(null);
        return throwError(() => err);
      }),
      finalize(() => this._isLoading.next(false))
    ).subscribe();
  }

  changeModel(modelName: string): void {
    this._isLoading.next(true);
    this.settingsService.setModel(modelName).pipe(
      tap(() => {
        this._selectedModel.next(modelName);
        localStorage.setItem(this.storageKey, modelName);
      }),
      catchError(err => {
        console.error(`Failed to set model to ${modelName}:`, err);
        // Optionally revert to the previous model if the backend call fails
        return throwError(() => err);
      }),
      finalize(() => this._isLoading.next(false))
    ).subscribe();
  }
}

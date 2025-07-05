import { Injectable } from '@angular/core';

const STORAGE_API_KEY = 'api_key';
@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  getApiKey(): string | null {
    return localStorage.getItem(STORAGE_API_KEY);
  }

  saveApiKey(apiKey: string): void {
    localStorage.setItem(STORAGE_API_KEY, apiKey);
  }

  getModels(): string[] {
    // In the future, this could fetch from the API, but for now, it's a static list.
    return ['gemini-2.5-pro-preview-05-06', 'gemini-2.5-flash'];
  }

  getModel(): string {
    const availableModels = this.getModels();
    const lastModel = localStorage.getItem('gemini-model');
    const modelToSelect =
      lastModel && availableModels.includes(lastModel)
        ? lastModel
        : availableModels[0];
    return modelToSelect;
  }

  setModel(modelName: string): void {
    localStorage.setItem('gemini-model', modelName);
  }
}

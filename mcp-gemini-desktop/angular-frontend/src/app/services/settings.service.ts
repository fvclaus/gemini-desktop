import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ModelsResponse {
  models: string[];
  status: string;
}

export interface ModelResponse {
  model: string;
  status: string;
}

export interface StatusResponse {
  status: string;
  message: string;
}


@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly backendUrl = 'http://127.0.0.1:5001';

  constructor(private http: HttpClient) { }

  getModels(): Observable<ModelsResponse> {
    return this.http.get<ModelsResponse>(`${this.backendUrl}/list-models`);
  }

  setModel(modelName: string): Observable<StatusResponse> {
    return this.http.post<StatusResponse>(`${this.backendUrl}/set-model`, { model: modelName });
  }

  saveApiKey(apiKey: string): Observable<StatusResponse> {
    return this.http.post<StatusResponse>(`${this.backendUrl}/set-api-key`, { apiKey: apiKey });
  }
}

import { AbstractGeminiModel } from './settings.service';

export interface Profile {
  name: string;
  model: string; // Stored as string name
  modelInstance?: AbstractGeminiModel; // In-memory instance
  apiKey: string;
  systemPrompt: string;
  isActive: boolean;
}

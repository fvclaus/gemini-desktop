import { AbstractGeminiModel } from './settings.service';

export interface Profile {
  name: string;
  model: AbstractGeminiModel;
  apiKey: string;
  systemPrompt: string;
  isActive: boolean;
}

export type PersistedProfile = Omit<Profile, 'model'> & { model: string };

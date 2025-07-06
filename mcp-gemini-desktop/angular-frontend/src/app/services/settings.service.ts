import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { PersistedProfile, Profile } from './profile.interface';
import { GoogleGenAI } from '@google/genai';

const PROFILES_STORAGE_KEY = 'gemini-desktop-profiles';
const SKIP_DELETE_CONFIRMATION_KEY = 'skip_delete_confirmation';

export interface GeminiUsageMetadata {
  /** Output only. Number of tokens in the cached part in the input (the cached content). */
  cachedContentTokenCount?: number;
  /** Number of tokens in the response(s). */
  candidatesTokenCount?: number;
  /** Number of tokens in the request. When `cached_content` is set, this is still the total effective prompt size meaning this includes the number of tokens in the cached content. */
  promptTokenCount?: number;
  /** Output only. Number of tokens present in thoughts output. */
  thoughtsTokenCount?: number;
  /** Output only. Number of tokens present in tool-use prompt(s). */
  toolUsePromptTokenCount?: number;
  /** Total token count for prompt, response candidates, and tool-use prompts (if present). */
  totalTokenCount?: number;
}

export interface ModelPricing {
  inputPrice: number;
  outputPrice: number;
  contextCachingPrice: number;
}

export abstract class AbstractGeminiModel {
  abstract name: string;
  abstract label: string;
  inputTokenLimit?: number;

  abstract calculatePrice(usage: GeminiUsageMetadata): number;
}

export class Gemini25Pro extends AbstractGeminiModel {
  name = 'gemini-2.5-pro-preview-05-06';
  label = 'Gemini 2.5 Pro Preview 05-06';

  private getPricing(promptTokenCount: number): ModelPricing {
    const isOver200k = promptTokenCount > 200000;
    return {
      inputPrice: isOver200k ? 2.5 : 1.25,
      outputPrice: isOver200k ? 15.0 : 10.0,
      contextCachingPrice: isOver200k ? 0.625 : 0.31,
    };
  }

  calculatePrice(usage: GeminiUsageMetadata): number {
    if (!usage.totalTokenCount) {
      return 0;
    }

    const pricing = this.getPricing(usage.promptTokenCount || 0);
    let cost = 0;

    if (usage.promptTokenCount) {
      cost += (usage.promptTokenCount / 1_000_000) * pricing.inputPrice;
    }
    if (usage.candidatesTokenCount) {
      cost += (usage.candidatesTokenCount / 1_000_000) * pricing.outputPrice;
    }
    if (usage.cachedContentTokenCount) {
      cost +=
        (usage.cachedContentTokenCount / 1_000_000) *
        pricing.contextCachingPrice;
    }
    if (usage.toolUsePromptTokenCount) {
      // Tool use prompt tokens are part of the input tokens
      cost += (usage.toolUsePromptTokenCount / 1_000_000) * pricing.inputPrice;
    }
    if (usage.thoughtsTokenCount) {
      // Thoughts tokens are part of the output tokens
      cost += (usage.thoughtsTokenCount / 1_000_000) * pricing.outputPrice;
    }

    return cost;
  }
}

export class Gemini25Flash extends AbstractGeminiModel {
  name = 'gemini-2.5-flash';
  label = 'Gemini 2.5 Flash';

  private getPricing(): ModelPricing {
    return {
      inputPrice: 0.3,
      outputPrice: 2.5,
      contextCachingPrice: 0.075,
    };
  }

  calculatePrice(usage: GeminiUsageMetadata): number {
    if (!usage.totalTokenCount) {
      return 0;
    }

    const pricing = this.getPricing();
    let cost = 0;

    if (usage.promptTokenCount) {
      cost += (usage.promptTokenCount / 1_000_000) * pricing.inputPrice;
    }
    if (usage.candidatesTokenCount) {
      cost += (usage.candidatesTokenCount / 1_000_000) * pricing.outputPrice;
    }
    if (usage.cachedContentTokenCount) {
      cost +=
        (usage.cachedContentTokenCount / 1_000_000) *
        pricing.contextCachingPrice;
    }
    if (usage.toolUsePromptTokenCount) {
      cost += (usage.toolUsePromptTokenCount / 1_000_000) * pricing.inputPrice;
    }
    if (usage.thoughtsTokenCount) {
      cost += (usage.thoughtsTokenCount / 1_000_000) * pricing.outputPrice;
    }

    return cost;
  }
}

export const GEMINI_MODELS: AbstractGeminiModel[] = [
  new Gemini25Pro(),
  new Gemini25Flash(),
];

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private profilesSubject = new BehaviorSubject<Profile[]>([]);
  profiles$ = this.profilesSubject.asObservable();

  private activeProfileSubject = new BehaviorSubject<Profile | null>(null);
  activeProfile$ = this.activeProfileSubject.asObservable();

  private modelsMap = new Map<string, AbstractGeminiModel>();

  constructor() {
    GEMINI_MODELS.forEach((model) => this.modelsMap.set(model.name, model));
    this.loadProfiles();
  }

  private loadProfiles(): void {
    const profiles = this.getProfilesFromStorage().map((p) => {
      // TODO Better serialization
      const modelInstance = this.getGeminiModel((p as PersistedProfile).model);
      return { ...p, model: modelInstance };
    });

    const activeProfiles = profiles.filter((p) => p.isActive);
    // More than one profile shouldn't be active, but if it is we just accept the first one
    if (activeProfiles.length > 0) {
      activeProfiles.slice(1).forEach((p) => (p.isActive = false));
      this.saveProfilesToStorage(profiles);
    }
    this.profilesSubject.next(profiles);
    const activeProfile = activeProfiles[0];
    if (activeProfile) {
      this.setActiveProfile(activeProfile);
    }
  }

  private getProfilesFromStorage(): PersistedProfile[] {
    const profilesJson = localStorage.getItem(PROFILES_STORAGE_KEY);
    return profilesJson ? JSON.parse(profilesJson) : [];
  }

  private saveProfilesToStorage(profiles: Profile[]): void {
    localStorage.setItem(
      PROFILES_STORAGE_KEY,
      JSON.stringify(
        profiles.map((p) => {
          return { ...p, model: p.model.name };
        }),
      ),
    );
    this.profilesSubject.next(profiles);
    const activeProfile = profiles.find((p) => p.isActive);
    this.activeProfileSubject.next(activeProfile ? activeProfile : null);
  }

  addProfile(profile: PersistedProfile): void {
    const profiles = this.profilesSubject.value;
    const modelInstance = this.modelsMap.get(profile.model);
    // TODO
    if (!modelInstance) {
      throw new Error(`Unknown model: ${profile.model}`);
    }
    this.saveProfilesToStorage([
      ...profiles,
      { ...profile, model: modelInstance, isActive: true },
    ]);
  }

  updateProfile(updatedProfile: PersistedProfile): void {
    const profiles = this.profilesSubject.value;
    const index = profiles.findIndex((p) => p.name === updatedProfile.name);
    if (index !== -1) {
      const modelInstance = this.modelsMap.get(updatedProfile.model);
      // TODO
      if (!modelInstance) {
        throw new Error(`Unknown model: ${updatedProfile.model}`);
      }
      profiles[index] = {
        ...updatedProfile,
        model: modelInstance,
      };
      this.saveProfilesToStorage(profiles);
    }
  }

  deleteProfile(profileName: string): void {
    const activeProfile = this.activeProfileSubject.value;
    if (activeProfile && activeProfile.name === profileName) {
      throw new Error(`Cannot delete active profile ${profileName}`);
    }
    const profiles = this.profilesSubject.value;

    const filteredProfiles = profiles.filter((p) => p.name !== profileName);

    this.saveProfilesToStorage(filteredProfiles);
  }

  async setActiveProfile(activeProfile: Profile): Promise<void> {
    const profiles = this.profilesSubject.value;
    for (const profile of profiles) {
      if (profile.name === activeProfile.name) {
        profile.isActive = true;
        if (!profile.model.inputTokenLimit) {
          await this.fetchModelInputTokenLimit(profile);
        }
      } else {
        profile.isActive = false;
      }
    }
    this.saveProfilesToStorage(profiles);
  }

  getActiveProfile(): Profile {
    const profile = this.activeProfileSubject.value;
    if (!profile) {
      throw new Error('IllegalState: Profile should be defined');
    }
    return profile;
  }

  getSkipDeleteConfirmation(): boolean {
    const skip = localStorage.getItem(SKIP_DELETE_CONFIRMATION_KEY);
    return skip === 'true';
  }

  setSkipDeleteConfirmation(skip: boolean): void {
    localStorage.setItem(SKIP_DELETE_CONFIRMATION_KEY, String(skip));
  }

  getGeminiModel(modelName: string): AbstractGeminiModel {
    const model = this.modelsMap.get(modelName);
    if (!model) {
      throw new Error('Should not happen');
    }
    return model;
  }

  private async fetchModelInputTokenLimit(profile: Profile): Promise<void> {
    try {
      const genAI = new GoogleGenAI({ apiKey: profile.apiKey });
      const modelInfo = await genAI.models.get({
        model: profile.model.name,
      });
      const modelInstance = profile.model;
      if (modelInstance) {
        modelInstance.inputTokenLimit = modelInfo.inputTokenLimit;
        this.modelsMap.set(modelInstance.name, modelInstance);
        // Trigger update for active profile to reflect the new token limit
        this.activeProfileSubject.next(profile);
      }
    } catch (error) {
      console.error(
        `Error fetching input token limit for model ${profile.model.name}:`,
        error,
      );
      // Handle error, maybe set a default or show a message
    }
  }
}

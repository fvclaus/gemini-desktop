import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  deserializeProfiles,
  PersistedProfile,
  Profile,
  serializeProfiles,
} from '../domain/profile';
import { GoogleGenAI } from '@google/genai';
import { AbstractGeminiModel } from '../domain/models';

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

@Injectable({
  providedIn: 'root',
})
export class ProfilesService {
  private profilesSubject = new BehaviorSubject<Profile[]>([]);
  profiles$ = this.profilesSubject.asObservable();

  private activeProfileSubject = new BehaviorSubject<Profile | null>(null);
  activeProfile$ = this.activeProfileSubject.asObservable();

  constructor() {
    this.loadProfiles();
  }

  private loadProfiles(): void {
    const profilesJson = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (!profilesJson) {
      this.profilesSubject.next([]);
      this.activeProfileSubject.next(null);
      return;
    }

    const profiles = deserializeProfiles(profilesJson);

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

  private saveProfilesToStorage(profiles: Profile[]): void {
    localStorage.setItem(PROFILES_STORAGE_KEY, serializeProfiles(profiles));
    this.profilesSubject.next(profiles);
    const activeProfile = profiles.find((p) => p.isActive);
    this.activeProfileSubject.next(activeProfile ? activeProfile : null);
  }

  addProfile(profile: PersistedProfile): void {
    const profiles = this.profilesSubject.value;
    const modelInstance = AbstractGeminiModel.forModel(profile.model);
    this.saveProfilesToStorage([
      ...profiles,
      { ...profile, model: modelInstance, isActive: true },
    ]);
  }

  updateProfile(updatedProfile: PersistedProfile): void {
    const profiles = this.profilesSubject.value;
    const index = profiles.findIndex((p) => p.name === updatedProfile.name);
    if (index !== -1) {
      const modelInstance = AbstractGeminiModel.forModel(updatedProfile.model);
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

  private async fetchModelInputTokenLimit(profile: Profile): Promise<void> {
    try {
      const genAI = new GoogleGenAI({ apiKey: profile.apiKey });
      const modelInfo = await genAI.models.get({
        model: profile.model.name,
      });
      const modelInstance = profile.model;
      if (modelInstance) {
        modelInstance.inputTokenLimit = modelInfo.inputTokenLimit;
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

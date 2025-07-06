import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Profile } from './profile.interface';

const PROFILES_STORAGE_KEY = 'gemini-desktop-profiles';
const SKIP_DELETE_CONFIRMATION_KEY = 'skip_delete_confirmation';

export interface GeminiModel {
  name: string;
  label: string;
}

export const GEMINI_PRO_2_5_PREVIEW_05_06: GeminiModel = {
  label: 'Gemini 2.5 Pro Preview 05-06',
  name: 'gemini-2.5-pro-preview-05-06',
};

export const GEMINI_2_5_FLASH: GeminiModel = {
  label: 'Gemini 2.5 Flash',
  name: 'gemini-2.5-flash',
};

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private profilesSubject = new BehaviorSubject<Profile[]>([]);
  profiles$ = this.profilesSubject.asObservable();

  private activeProfileSubject = new BehaviorSubject<Profile | null>(null);
  activeProfile$ = this.activeProfileSubject.asObservable();

  constructor() {
    this.loadProfiles();
  }

  private loadProfiles(): void {
    const profiles = this.getProfilesFromStorage();

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

  private getProfilesFromStorage(): Profile[] {
    const profilesJson = localStorage.getItem(PROFILES_STORAGE_KEY);
    return profilesJson ? JSON.parse(profilesJson) : [];
  }

  private saveProfilesToStorage(profiles: Profile[]): void {
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
    this.profilesSubject.next(profiles);
    const activeProfile = profiles.find((p) => p.isActive);
    this.activeProfileSubject.next(activeProfile ? activeProfile : null);
  }

  addProfile(profile: Profile): void {
    const profiles = this.getProfilesFromStorage();
    profile.isActive = true;
    this.saveProfilesToStorage([...profiles, profile]);
  }

  updateProfile(updatedProfile: Profile): void {
    const profiles = this.getProfilesFromStorage();
    const index = profiles.findIndex((p) => p.name === updatedProfile.name);
    if (index !== -1) {
      profiles[index] = updatedProfile;
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

  setActiveProfile(activeProfile: Profile): void {
    const profiles = this.profilesSubject.value;
    for (const profile of profiles) {
      if (profile.name === activeProfile.name) {
        profile.isActive = true;
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
}

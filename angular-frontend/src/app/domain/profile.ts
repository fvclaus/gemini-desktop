import { z } from 'zod';
import { AbstractGeminiModelSchema } from './messages';

export type PersistedProfile = Omit<Profile, 'model'> & { model: string };

const ProfileSchema = z.object({
  name: z.string(),
  model: AbstractGeminiModelSchema,
  apiKey: z.string(),
  systemPrompt: z.string(),
  isActive: z.boolean(),
});

export type Profile = z.infer<typeof ProfileSchema>;

export function deserializeProfiles(profilesJson: string): Profile[] {
  const parsedProfiles: unknown[] = JSON.parse(profilesJson);
  const validProfiles: Profile[] = [];

  parsedProfiles.forEach((p) => {
    const result = ProfileSchema.safeParse(p);
    if (result.success) {
      validProfiles.push(result.data);
    } else {
      console.error('Error parsing profile from localStorage:', result.error);
    }
  });
  return validProfiles;
}

export function serializeProfiles(profiles: Profile[]): string {
  return JSON.stringify(
    profiles.map((profile) => ({
      ...profile,
      model: profile.model.name,
    })),
  );
}

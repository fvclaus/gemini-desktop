import { Pipe, PipeTransform } from '@angular/core';
import { Profile } from '../services/profile.interface';

@Pipe({
  name: 'sortProfiles',
  standalone: true,
})
export class SortProfilesPipe implements PipeTransform {
  transform(profiles: Profile[] | null): Profile[] {
    if (!profiles) {
      return [];
    }
    return [...profiles].sort((a, b) => a.name.localeCompare(b.name));
  }
}

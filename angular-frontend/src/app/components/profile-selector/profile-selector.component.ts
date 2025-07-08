import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { SettingsService } from '../../services/settings.service';
import { MatDialog } from '@angular/material/dialog';
import { SettingsDialogComponent } from '../settings-dialog/settings-dialog.component';
import { Profile } from '../../services/profile.interface';
import { Observable } from 'rxjs';
import { SortProfilesPipe } from '../../pipes/sort-profiles.pipe';

@Component({
  selector: 'app-profile-selector',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDividerModule,
    SortProfilesPipe,
    SettingsDialogComponent,
  ],
  templateUrl: './profile-selector.component.html',
  styleUrls: ['./profile-selector.component.scss'],
})
export class ProfileSelectorComponent {
  private settingsService = inject(SettingsService);
  private dialog = inject(MatDialog);

  profiles$: Observable<Profile[]> = this.settingsService.profiles$;
  activeProfile$: Observable<Profile | null> =
    this.settingsService.activeProfile$;

  selectProfile(profile: Profile): void {
    this.settingsService.setActiveProfile(profile);
  }

  addProfile(): void {
    this.dialog.open(SettingsDialogComponent, { data: null });
  }

  editProfile(profile: Profile, event: MouseEvent): void {
    event.stopPropagation();
    this.dialog.open(SettingsDialogComponent, { data: profile });
  }
}

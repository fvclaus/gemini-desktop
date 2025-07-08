import { Component, inject, OnInit } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  SettingsService,
  GEMINI_MODELS,
} from '../../services/settings.service';

import {
  FormlyFieldConfig,
  FormlyModule,
  FormlyFormOptions,
} from '@ngx-formly/core';
import { PersistedProfile, Profile } from '../../services/profile.interface';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

@Component({
  selector: 'app-settings-dialog',
  templateUrl: './settings-dialog.component.html',
  styleUrls: ['./settings-dialog.component.css'],
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormlyModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatDialogModule,
  ],
})
export class SettingsDialogComponent implements OnInit {
  private settingsService = inject(SettingsService);
  private dialogRef = inject(MatDialogRef<SettingsDialogComponent>);
  public data: Profile | null = inject(MAT_DIALOG_DATA);

  form = new FormGroup({});
  formModel: Partial<PersistedProfile> = {};
  options: FormlyFormOptions = {};
  fields: FormlyFieldConfig[] = [
    {
      key: 'name',
      type: 'input',
      props: {
        label: 'Profile Name',
        placeholder: 'Enter profile name',
        required: true,
      },
    },
    {
      key: 'model',
      type: 'select',
      props: {
        label: 'Model',
        placeholder: 'Select a model',
        required: true,
        options: GEMINI_MODELS.map((m) => ({
          value: m.name,
          label: m.label,
        })),
      },
    },
    {
      key: 'apiKey',
      type: 'input',
      props: {
        label: 'API Key',
        placeholder: 'Enter your API Key',
        required: true,
        type: 'password',
      },
    },
    {
      key: 'systemPrompt',
      type: 'textarea',
      props: {
        label: 'System Prompt',
        placeholder: 'Enter system prompt (optional)',
        rows: 5,
      },
    },
  ];
  isNewProfile = true;

  ngOnInit(): void {
    if (this.data) {
      this.isNewProfile = false;
      this.formModel =
        this.data !== null
          ? {
              ...this.data,
              model: this.data.model.name,
            }
          : {};
    } else {
      this.isNewProfile = true;
      // Reset form for new profile
      this.formModel = {
        name: '',
        model: 'gemini-2.5-pro-preview-05-06', // Default model
        apiKey: '',
        systemPrompt: '',
      };
      this.form.reset(this.formModel);
    }
  }

  onSave(): void {
    if (this.form.valid) {
      const profile = this.formModel as PersistedProfile;
      if (this.isNewProfile) {
        this.settingsService.addProfile(profile);
      } else {
        this.settingsService.updateProfile(profile);
      }
      this.dialogRef.close();
    }
  }

  onDelete(): void {
    if (
      this.formModel.name &&
      confirm('Are you sure you want to delete this profile?')
    ) {
      this.settingsService.deleteProfile(this.formModel.name);
      this.dialogRef.close();
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

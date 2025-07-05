import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SettingsService } from '../../services/settings.service';
import { ModalService } from '../../services/modal.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
  imports: [CommonModule, ReactiveFormsModule],
})
export class SettingsComponent {
  private fb = inject(FormBuilder);
  private settingsService = inject(SettingsService);
  private modalService = inject(ModalService);

  settingsForm: FormGroup;
  models: string[] = [];
  selectedModel: string | null = null;

  constructor() {
    const settingsService = this.settingsService;

    this.models = settingsService.getModels();
    this.settingsForm = this.fb.group({
      apiKey: [''],
      model: [''],
    });
  }

  onSave(): void {
    if (this.settingsForm.invalid) {
      return;
    }

    const apiKey = this.settingsForm.get('apiKey')?.value;

    if (apiKey) {
      this.settingsService.saveApiKey(apiKey);
    }

    this.modalService.close();
  }

  onCancel(): void {
    this.modalService.close();
  }
}

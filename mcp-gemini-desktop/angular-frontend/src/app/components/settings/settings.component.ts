import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ModelManagementService } from '../../services/model-management.service';
import { SettingsService } from '../../services/settings.service';
import { ModalService } from '../../services/modal.service';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
  imports: [CommonModule, ReactiveFormsModule]
})
export class SettingsComponent implements OnInit {
  settingsForm: FormGroup;
  models$: ModelManagementService['models$'];
  selectedModel$: ModelManagementService['selectedModel$'];
  isLoading$: ModelManagementService['isLoading$'];

  constructor(
    private fb: FormBuilder,
    private modelManagementService: ModelManagementService,
    private settingsService: SettingsService,
    private modalService: ModalService
  ) {
    this.models$ = this.modelManagementService.models$;
    this.selectedModel$ = this.modelManagementService.selectedModel$;
    this.isLoading$ = this.modelManagementService.isLoading$;
    this.settingsForm = this.fb.group({
      apiKey: [''],
      model: ['']
    });
  }

  ngOnInit(): void {
    this.selectedModel$.subscribe(model => {
      if (model) {
        this.settingsForm.get('model')?.setValue(model, { emitEvent: false });
      }
    });
  }

  onSave(): void {
    if (this.settingsForm.invalid) {
      return;
    }

    const apiKey = this.settingsForm.get('apiKey')?.value;
    const selectedModel = this.settingsForm.get('model')?.value;

    if (apiKey) {
      this.settingsService.saveApiKey(apiKey).subscribe();
    }

    if (selectedModel) {
      this.modelManagementService.changeModel(selectedModel);
    }

    this.modalService.close();
  }

  onCancel(): void {
    this.modalService.close();
  }
}

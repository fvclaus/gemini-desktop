import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
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
  models: string[] = [];
  selectedModel: string | null = null;

  constructor(
    private fb: FormBuilder,
    private settingsService: SettingsService,
    private modalService: ModalService
  ) {
    this.models = settingsService.getModels();
    this.settingsForm = this.fb.group({
      apiKey: [''],
      model: ['']
    });
  }

  ngOnInit(): void {
  }

  onSave(): void {
    if (this.settingsForm.invalid) {
      return;
    }

    const apiKey = this.settingsForm.get('apiKey')?.value;
    const selectedModel = this.settingsForm.get('model')?.value;

    if (apiKey) {
      this.settingsService.saveApiKey(apiKey);
    }


    this.modalService.close();
  }

  onCancel(): void {
    this.modalService.close();
  }
}

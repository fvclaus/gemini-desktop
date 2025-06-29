import { Component } from '@angular/core';
import { FieldArrayType } from '@ngx-formly/core';
import { NgIf, NgFor } from '@angular/common';
import { FormlyField, FormlyValidationMessage } from '@ngx-formly/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'formly-array-type',
  template: `
    <div class="mb-3">
      <legend *ngIf="props.label">{{ props.label }}</legend>
      <p *ngIf="props.description">{{ props.description }}</p>
      <div class="d-flex flex-row-reverse">
        <button mat-icon-button type="button" (click)="add()">
          <mat-icon>add</mat-icon>
        </button>
      </div>

      <div class="alert alert-danger" role="alert" *ngIf="showError && formControl.errors">
        <formly-validation-message [field]="field"></formly-validation-message>
      </div>

      <div *ngFor="let field of field.fieldGroup; let i = index" class="row align-items-start">
        <formly-field class="col" [field]="field"></formly-field>
        <div *ngIf="field.props?.['removable'] !== false" class="col-2 text-right">
          <button mat-icon-button type="button" (click)="remove(i)">
            <mat-icon>remove</mat-icon>
          </button>
        </div>
      </div>
    </div>
  `,
  standalone: true,
  imports: [NgIf, FormlyField, FormlyValidationMessage, NgFor, MatButtonModule, MatIconModule],
})
export class ArrayTypeComponent extends FieldArrayType {}
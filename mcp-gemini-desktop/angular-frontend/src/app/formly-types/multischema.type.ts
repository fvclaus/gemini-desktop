import { Component } from '@angular/core';
import { FieldType } from '@ngx-formly/core';
import { NgIf, NgFor } from '@angular/common';
import { FormlyField, FormlyValidationMessage } from '@ngx-formly/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'formly-multi-schema-type',
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title *ngIf="props.label">{{ props.label }}</mat-card-title>
        <mat-card-subtitle *ngIf="props.description">{{
          props.description
        }}</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <div
          class="alert alert-danger"
          role="alert"
          *ngIf="showError && formControl.errors"
        >
          <formly-validation-message
            [field]="field"
          ></formly-validation-message>
        </div>
        <formly-field
          *ngFor="let f of field.fieldGroup"
          [field]="f"
        ></formly-field>
      </mat-card-content>
    </mat-card>
  `,
  standalone: true,
  imports: [NgIf, FormlyField, FormlyValidationMessage, NgFor, MatCardModule],
})
export class MultiSchemaTypeComponent extends FieldType {}

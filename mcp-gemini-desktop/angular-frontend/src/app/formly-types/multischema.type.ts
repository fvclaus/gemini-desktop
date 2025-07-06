import { Component } from '@angular/core';
import { FieldType } from '@ngx-formly/core';

import { FormlyField, FormlyValidationMessage } from '@ngx-formly/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'formly-multi-schema-type',
  template: `
    <mat-card>
      <mat-card-header>
        @if (props.label) {
          <mat-card-title>{{ props.label }}</mat-card-title>
        }
        @if (props.description) {
          <mat-card-subtitle>{{
            props.description
          }}</mat-card-subtitle>
        }
      </mat-card-header>
      <mat-card-content>
        @if (showError && formControl.errors) {
          <div
            class="alert alert-danger"
            role="alert"
            >
            <formly-validation-message
              [field]="field"
            ></formly-validation-message>
          </div>
        }
        @for (f of field.fieldGroup; track f) {
          <formly-field
            [field]="f"
          ></formly-field>
        }
      </mat-card-content>
    </mat-card>
    `,
  standalone: true,
  imports: [FormlyField, FormlyValidationMessage, MatCardModule],
})
export class MultiSchemaTypeComponent extends FieldType {}

import {
  ApplicationConfig,
  provideZoneChangeDetection,
  importProvidersFrom,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { FormlyModule, FormlyFieldConfig } from '@ngx-formly/core';
import { FormlyMaterialModule } from '@ngx-formly/material';
import { MatDialogModule } from '@angular/material/dialog';

import { routes } from './app.routes';
import { ArrayTypeComponent } from './formly-types/array.type';
import { ObjectTypeComponent } from './formly-types/object.type';
import { MultiSchemaTypeComponent } from './formly-types/multischema.type';
import { NullTypeComponent } from './formly-types/null.type';

export function minItemsValidationMessage(
  error: unknown,
  field: FormlyFieldConfig,
) {
  return `should NOT have fewer than ${field.props?.['minItems']} items`;
}

export function maxItemsValidationMessage(
  error: unknown,
  field: FormlyFieldConfig,
) {
  return `should NOT have more than ${field.props?.['maxItems']} items`;
}

export function minLengthValidationMessage(
  error: unknown,
  field: FormlyFieldConfig,
) {
  return `should NOT be shorter than ${field.props?.minLength} characters`;
}

export function maxLengthValidationMessage(
  error: unknown,
  field: FormlyFieldConfig,
) {
  return `should NOT be longer than ${field.props?.maxLength} characters`;
}

export function minValidationMessage(error: unknown, field: FormlyFieldConfig) {
  return `should be >= ${field.props?.min}`;
}

export function maxValidationMessage(error: unknown, field: FormlyFieldConfig) {
  return `should be <= ${field.props?.max}`;
}

export function multipleOfValidationMessage(
  error: unknown,
  field: FormlyFieldConfig,
) {
  return `should be multiple of ${field.props?.step}`;
}

export function exclusiveMinimumValidationMessage(
  error: unknown,
  field: FormlyFieldConfig,
) {
  return `should be > ${field.props?.['exclusiveMinimum']}`;
}

export function exclusiveMaximumValidationMessage(
  error: unknown,
  field: FormlyFieldConfig,
) {
  return `should be < ${field.props?.['exclusiveMaximum']}`;
}

export function constValidationMessage(
  error: unknown,
  field: FormlyFieldConfig,
) {
  return `should be equal to constant "${field.props?.['const']}"`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function typeValidationMessage({ schemaType }: any) {
  return `should be "${schemaType[0]}".`;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimations(),
    importProvidersFrom(
      ReactiveFormsModule,
      FormlyModule.forRoot({
        validationMessages: [
          { name: 'required', message: 'This field is required' },
          { name: 'type', message: typeValidationMessage },
          { name: 'minLength', message: minLengthValidationMessage },
          { name: 'maxLength', message: maxLengthValidationMessage },
          { name: 'min', message: minValidationMessage },
          { name: 'max', message: maxValidationMessage },
          { name: 'multipleOf', message: multipleOfValidationMessage },
          {
            name: 'exclusiveMinimum',
            message: exclusiveMinimumValidationMessage,
          },
          {
            name: 'exclusiveMaximum',
            message: exclusiveMaximumValidationMessage,
          },
          { name: 'minItems', message: minItemsValidationMessage },
          { name: 'maxItems', message: maxItemsValidationMessage },
          { name: 'uniqueItems', message: 'should NOT have duplicate items' },
          { name: 'const', message: constValidationMessage },
          {
            name: 'enum',
            message: `must be equal to one of the allowed values`,
          },
        ],
        types: [
          {
            name: 'null',
            component: NullTypeComponent,
            wrappers: ['form-field'],
          },
          { name: 'array', component: ArrayTypeComponent },
          { name: 'object', component: ObjectTypeComponent },
          { name: 'multischema', component: MultiSchemaTypeComponent },
        ],
      }),
      FormlyMaterialModule,
      MatDialogModule,
    ),
  ],
};

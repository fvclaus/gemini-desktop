import { Component, NgZone, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { McpToolDefinition } from '../../../../../src/shared/types';
import { FormGroup } from '@angular/forms';
import {
  FormlyFieldConfig,
  FormlyFormOptions,
  FormlyModule,
} from '@ngx-formly/core';
import { FormlyJsonschema } from '@ngx-formly/core/json-schema';
import { ReactiveFormsModule } from '@angular/forms';
import { FormlyMaterialModule } from '@ngx-formly/material';
import { JSONSchema7 } from 'json-schema';

@Component({
  selector: 'app-tool-info-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatCardModule,
    MatIconModule,
    ReactiveFormsModule,
    FormlyModule,
    FormlyMaterialModule,
  ],
  templateUrl: './tool-info-dialog.component.html',
  styleUrls: ['./tool-info-dialog.component.css'],
})
export class ToolInfoDialogComponent {
  dialogRef = inject<MatDialogRef<ToolInfoDialogComponent>>(MatDialogRef);
  data = inject<{
    tool: McpToolDefinition;
    serverName: string;
  }>(MAT_DIALOG_DATA);
  private formlyJsonschema = inject(FormlyJsonschema);
  private zone = inject(NgZone);

  form = new FormGroup({});
  model: unknown = {};
  options: FormlyFormOptions = {};
  fields: FormlyFieldConfig[] = [];
  toolResultFormatted: string | null = null;
  schemaError: string | null = null;

  constructor() {
    if (this.isJsonSchema(this.data.tool.inputSchema)) {
      this.fields = [
        this.formlyJsonschema.toFieldConfig(this.data.tool.inputSchema, {
          map: (mappedField, mapSource) => {
            if (mapSource.title || mappedField.key) {
              mappedField.props = {
                ...mappedField.props,
                label: mapSource.title || String(mappedField.key),
              };
            }
            return mappedField;
          },
        }),
      ];
      this.fields[0].props = {
        label: 'parameter',
      };
      console.log('Fields config', this.fields);
    } else {
      this.schemaError =
        'The tool has an invalid input schema and cannot be used.';
    }
  }

  private isJsonSchema(schema: object): schema is JSONSchema7 {
    return (
      schema &&
      typeof schema === 'object' &&
      Object.prototype.hasOwnProperty.call(schema, 'type') &&
      (schema as { type?: unknown }).type === 'object'
    );
  }

  async onSubmit(model: unknown) {
    if (this.form.valid) {
      try {
        const result = await this.callTool(
          this.data.serverName,
          this.data.tool.name,
          model,
        );
        this.zone.run(() => {
          this.toolResultFormatted = JSON.stringify(result, null, 2);
        });
      } catch (error) {
        this.zone.run(() => {
          this.toolResultFormatted = `Error: ${error instanceof Error ? error.message : String(error)}`;
        });
      }
    }
  }

  async callTool(
    serverName: string,
    toolName: string,
    params: unknown,
  ): Promise<unknown> {
    return await window.electronAPI.callMcpTool(serverName, toolName, params);
  }

  onClose(): void {
    this.dialogRef.close();
  }
}

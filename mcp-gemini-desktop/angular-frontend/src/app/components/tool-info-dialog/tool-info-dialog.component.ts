import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { McpToolDefinition } from '../../../../../src/shared/types';

@Component({
  selector: 'app-tool-info-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatCardModule,
    MatIconModule
  ],
  templateUrl: './tool-info-dialog.component.html',
  styleUrls: ['./tool-info-dialog.component.css']
})
export class ToolInfoDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ToolInfoDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { tool: McpToolDefinition }
  ) {}

  get inputSchemaFormatted(): string {
    return JSON.stringify(this.data.tool.inputSchema, null, 2);
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
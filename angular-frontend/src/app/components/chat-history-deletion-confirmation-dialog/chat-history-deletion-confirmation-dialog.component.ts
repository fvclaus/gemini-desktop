import { Component, inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-chat-history-deletion-confirmation-dialog',
  templateUrl: './chat-history-deletion-confirmation-dialog.component.html',
  styleUrls: ['./chat-history-deletion-confirmation-dialog.component.css'],
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatCheckboxModule, FormsModule],
})
export class ChatHistoryDeletionConfirmationDialogComponent {
  rememberChoice = false;
  dialogRef = inject(
    MatDialogRef<ChatHistoryDeletionConfirmationDialogComponent>,
  );
  data: { title: string; message: string } = inject(MAT_DIALOG_DATA);

  onCancel(): void {
    this.dialogRef.close({ confirmed: false });
  }

  onConfirm(): void {
    this.dialogRef.close({
      confirmed: true,
      rememberChoice: this.rememberChoice,
    });
  }
}

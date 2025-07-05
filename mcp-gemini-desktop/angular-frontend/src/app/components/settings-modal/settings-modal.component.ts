import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { ModalService } from '../../services/modal.service';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-settings-modal',
  templateUrl: './settings-modal.component.html',
  styleUrls: ['./settings-modal.component.css'],
  imports: [CommonModule],
})
export class SettingsModalComponent implements OnInit, OnDestroy {
  private modalService = inject(ModalService);

  @Input() modalId = '';
  isOpen = false;
  private modalSubscription: Subscription | undefined;

  ngOnInit(): void {
    this.modalSubscription = this.modalService.currentModal$.subscribe(
      (currentModalId) => {
        this.isOpen = currentModalId === this.modalId;
      },
    );
  }

  ngOnDestroy(): void {
    this.modalSubscription?.unsubscribe();
  }

  close(): void {
    this.modalService.close();
  }
}

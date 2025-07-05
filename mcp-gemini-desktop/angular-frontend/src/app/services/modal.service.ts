import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ModalService {
  private readonly _currentModal = new BehaviorSubject<string | null>(null);
  public readonly currentModal$ = this._currentModal.asObservable();

  open(modalId: string): void {
    this._currentModal.next(modalId);
  }

  close(): void {
    this._currentModal.next(null);
  }
}

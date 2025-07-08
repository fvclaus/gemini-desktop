import {
  Component,
  Input,
  OnDestroy,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
  inject,
} from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { GeminiUsageMetadata } from '../../services/settings.service';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { OverlayModule, OverlayRef, Overlay } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-usage-metadata-display',
  standalone: true,
  imports: [
    CommonModule,
    MatChipsModule,
    CurrencyPipe,
    OverlayModule,
    MatCardModule,
  ],
  templateUrl: './usage-metadata-display.component.html',
  styleUrl: './usage-metadata-display.component.css',
})
export class UsageMetadataDisplayComponent implements OnDestroy {
  @Input() usageMetadata!: GeminiUsageMetadata;
  @Input() cost!: number;
  private _viewContainerRef = inject(ViewContainerRef);

  @ViewChild('usageDetailsOverlay') usageDetailsOverlay!: TemplateRef<unknown>;
  private overlayRef?: OverlayRef;
  private readonly destroyRef = new Subject<void>();
  private overlay = inject(Overlay);

  ngOnDestroy(): void {
    this.destroyRef.next();
    this.destroyRef.complete();
    this.closeOverlay();
  }

  showOverlay(event: MouseEvent): void {
    if (!this.overlayRef) {
      this.overlayRef = this.overlay.create({
        hasBackdrop: false,
        positionStrategy: this.overlay
          .position()
          .flexibleConnectedTo(event.target as HTMLElement)
          .withPositions([
            {
              originX: 'end',
              originY: 'center',
              overlayX: 'start',
              overlayY: 'center',
            },
            {
              originX: 'start',
              originY: 'center',
              overlayX: 'end',
              overlayY: 'center',
            },
          ]),
      });
      this.overlayRef.attach(
        new TemplatePortal(this.usageDetailsOverlay, this._viewContainerRef),
      );
    }
  }

  closeOverlay(): void {
    if (this.overlayRef) {
      this.overlayRef.detach();
      this.overlayRef.dispose();
      this.overlayRef = undefined;
    }
  }
}

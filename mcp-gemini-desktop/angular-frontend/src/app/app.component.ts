import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { ChatAreaComponent } from './components/chat-area/chat-area.component';
import { MatSidenavModule } from '@angular/material/sidenav';
import { WorkspaceComponent } from './components/sidebar/workspace/workspace.component';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { SettingsModalComponent } from './components/settings-modal/settings-modal.component';
import { SettingsComponent } from './components/settings/settings.component';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    SidebarComponent,
    ChatAreaComponent,
    MatSidenavModule,
    WorkspaceComponent,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatIcon,
    SettingsModalComponent,
    SettingsComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'GemCP Chat';

  readonly sidenavMinWidth = 250;
  readonly sidenavMaxWidth = window.innerWidth - 300;

  get sidenavWidth(): number {
    return parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width'),
      10
    );
  }

  setSidenavWidth(width: number) {
    const clampedWidth = Math.min(
      Math.max(width, this.sidenavMinWidth),
      this.sidenavMaxWidth
    );

    document.documentElement.style.setProperty('--sidebar-width', `${clampedWidth}px`);
  }

  /**
   * This stores the state of the resizing event and is updated
   * as events are fired.
   */
  resizingEvent = {
    isResizing: false,
    startingCursorX: 0,
    startingWidth: 0,
  };

  startResizing(event: MouseEvent): void {
    this.resizingEvent = {
      isResizing: true,
      startingCursorX: event.clientX,
      startingWidth: this.sidenavWidth,
    };
  }

  /*
 * This method runs when the mouse is moved anywhere in the browser
 */
@HostListener('window:mousemove', ['$event'])
updateSidenavWidth(event: MouseEvent) {
  // No need to even continue if we're not resizing
  if (!this.resizingEvent.isResizing) {
    return;
  }

  // 1. Calculate how much mouse has moved on the x-axis
  const cursorDeltaX = event.clientX - this.resizingEvent.startingCursorX;

  // 2. Calculate the new width according to initial width and mouse movement
  const newWidth = this.resizingEvent.startingWidth + cursorDeltaX;

  // 3. Set the new width
  this.setSidenavWidth(newWidth);
}

@HostListener('window:mouseup')
stopResizing() {
  this.resizingEvent.isResizing = false;
}

}

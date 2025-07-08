import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  inject,
} from '@angular/core';

import { ServerItemComponent } from './server-item/server-item.component';
import { MatListModule } from '@angular/material/list';
import { ChatService } from '../../../services/chat.service'; // Import ChatService
import { McpServerStatus } from '../../../../../../src/shared/types';
import { Subscription } from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-server-list',
  standalone: true,
  imports: [ServerItemComponent, MatListModule, MatProgressSpinnerModule],
  templateUrl: './server-list.component.html',
  styleUrl: './server-list.component.css',
})
export class ServerListComponent implements OnInit, OnDestroy {
  private chatService = inject(ChatService);
  private cdr = inject(ChangeDetectorRef);

  servers: McpServerStatus[] = [];
  isLoading = true;
  private mcpServersSubscription: Subscription | undefined;

  ngOnInit(): void {
    this.mcpServersSubscription = this.chatService.mcpServers$.subscribe(
      (servers) => {
        this.servers = servers;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    );
  }

  ngOnDestroy(): void {
    if (this.mcpServersSubscription) {
      this.mcpServersSubscription.unsubscribe();
    }
  }
}

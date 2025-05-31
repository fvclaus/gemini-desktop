import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, NgFor, NgIf } from '@angular/common';
import { ServerItemComponent } from './server-item/server-item.component';
import { MatListModule } from '@angular/material/list';
import { ChatService, Server } from '../../../services/chat.service'; // Import ChatService and Server interface
import { Subscription } from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Server interface is now imported from ChatService

@Component({
  selector: 'app-server-list',
  standalone: true,
  imports: [
    CommonModule,
    NgFor,
    NgIf,
    ServerItemComponent,
    MatListModule,
    MatProgressSpinnerModule // Add MatProgressSpinnerModule
  ],
  templateUrl: './server-list.component.html',
  styleUrl: './server-list.component.css'
})
export class ServerListComponent implements OnInit, OnDestroy {
  servers: Server[] = [];
  isLoading: boolean = true;
  private serversSubscription: Subscription | undefined;
  private connectionStatusSubscription: Subscription | undefined;

  constructor(
    private chatService: ChatService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.connectionStatusSubscription = this.chatService.backendConnectionStatus$.subscribe(status => {
      this.isLoading = status !== 'connected' && status !== 'error'; // Show loading if not connected or errored
      if (status === 'error') {
        this.servers = []; // Clear servers on backend error
      }
      this.cdr.detectChanges();
    });

    this.serversSubscription = this.chatService.servers$.subscribe(
      (fetchedServers) => {
        this.servers = fetchedServers;
        // isLoading is primarily driven by backendConnectionStatus$.
        // When servers arrive, if the status is already 'connected',
        // we ensure isLoading is false.
        // No need to directly access the subject; the observable subscription handles this.
        // The isLoading flag is set in the connectionStatusSubscription.
        // If servers are fetched, it implies connection was successful at some point.
        this.isLoading = false; // If servers are fetched, we are no longer in an initial loading state for servers.
        this.cdr.detectChanges();
      }
    );
  }

  ngOnDestroy(): void {
    if (this.serversSubscription) {
      this.serversSubscription.unsubscribe();
    }
    if (this.connectionStatusSubscription) {
      this.connectionStatusSubscription.unsubscribe();
    }
  }

  // The extractName method is not used with the current Server interface from ChatService
  // as display_name is provided directly. It can be removed.
}

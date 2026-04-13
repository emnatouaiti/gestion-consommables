import { Component, Input, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { ChatService } from '../../../services/chat.service';
import { ChatStateService, ChatPeer } from '../../../services/chat-state.service';

@Component({
  selector: 'app-thread-widget',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <div class="tw-root" *ngIf="peer">
      <div class="tw-header">
        <div>
          <div class="tw-name">{{ peer.name }}</div>
          <div class="tw-status">Fil en cours</div>
        </div>
        <button class="tw-btn" (click)="clear()">×</button>
      </div>
      <div class="tw-messages">
        <div *ngFor="let m of messages" class="tw-msg" [class.me]="isMine(m)">
          <div class="tw-bubble">{{ m.message }}</div>
          <div class="tw-time">{{ m.created_at | date:'shortTime' }}</div>
        </div>
      </div>
    </div>
    <div class="tw-empty" *ngIf="!peer">Aucune discussion active.</div>
  `,
  styleUrls: ['./thread-widget.component.css']
})
export class ThreadWidgetComponent implements OnInit, OnDestroy {
  peer: ChatPeer | null = null;
  messages: any[] = [];
  authId: number | null = null;
  private sub?: Subscription;
  private msgSub?: Subscription;

  constructor(
    private chat: ChatService,
    private state: ChatStateService,
    private cdr: ChangeDetectorRef
  ) {}

  @Input() set userId(id: number | null) {
    if (id && (!this.peer || this.peer.id !== id)) {
      // will be overridden by state subscription; keep for compatibility
    }
  }

  ngOnInit(): void {
    this.sub = this.state.active$.subscribe(peer => {
      this.peer = peer;
      this.messages = [];
      this.msgSub?.unsubscribe();
      if (peer) {
        this.msgSub = this.chat.pollMessages(peer.id, 4000).subscribe({
          next: (data) => { this.messages = data; this.cdr.detectChanges(); },
          error: () => { this.messages = []; }
        });
      }
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.msgSub?.unsubscribe();
  }

  isMine(msg: any): boolean {
    return this.authId !== null && msg.sender_id === this.authId;
  }

  clear(): void {
    this.state.setActive(null);
  }
}

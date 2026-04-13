import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ChatService } from '../../../services/chat.service';
import { ChatStateService } from '../../../services/chat-state.service';
import { ThreadWidgetComponent } from './thread-widget.component';

@Component({
  selector: 'app-mini-threads',
  standalone: true,
  imports: [CommonModule, ThreadWidgetComponent],
  template: `
    <div class="mt-root">
      <div class="mt-sidebar">
        <div class="mt-title">Discussions récentes</div>
        <div class="mt-list">
          <div
            *ngFor="let c of conversations"
            class="mt-item"
            [class.active]="activeId === c.user.id"
            (click)="open(c)"
          >
            <div class="mt-name">{{ c.user.name }}</div>
            <div class="mt-meta">
              <span class="mt-last">{{ c.last_message || '...' }}</span>
              <span class="mt-unread" *ngIf="c.unread">{{ c.unread }}</span>
            </div>
          </div>
          <div class="mt-empty" *ngIf="!conversations.length">Aucune discussion.</div>
        </div>
      </div>
      <div class="mt-thread">
        <app-thread-widget></app-thread-widget>
      </div>
    </div>
  `,
  styleUrls: ['./mini-threads.component.css']
})
export class MiniThreadsComponent implements OnInit, OnDestroy {
  conversations: any[] = [];
  activeId: number | null = null;
  private sub?: Subscription;

  constructor(
    private chat: ChatService,
    private state: ChatStateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.sub = this.chat.pollConversations(7000).subscribe({
      next: (convs) => {
        this.conversations = Array.isArray(convs) ? convs : [];
        if (!this.activeId && this.conversations.length) {
          this.open(this.conversations[0]);
        }
        this.cdr.detectChanges();
      }
    });

    this.state.active$.subscribe(peer => {
      this.activeId = peer?.id ?? null;
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  open(conv: any): void {
    this.activeId = conv?.user?.id ?? null;
    if (this.activeId) {
      this.state.setActive({ id: this.activeId, name: conv.user.name });
    }
  }
}

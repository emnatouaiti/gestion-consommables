import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, of, concat, switchMap } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class ChatService implements OnDestroy {
  private eventSource: EventSource | null = null;
  private messageReceived$ = new Subject<any>();

  constructor(private api: ApiService) {}

  ngOnDestroy(): void {
    this.disconnectStream();
  }

  conversations(): Observable<any[]> {
    return this.api.get('chat/conversations');
  }

  messages(userId: number): Observable<any[]> {
    return this.api.get(`chat/messages/${userId}`);
  }

  send(receiverId: number, message: string, attachment?: File | null): Observable<any> {
    if (attachment) {
      const form = new FormData();
      form.append('receiver_id', String(receiverId));
      form.append('message', message);
      form.append('attachment', attachment);
      return this.api.post('chat/messages', form);
    }

    return this.api.post('chat/messages', { receiver_id: receiverId, message });
  }

  users(): Observable<any[]> {
    return this.api.get('chat/users');
  }

  private connectStream(): void {
    if (this.eventSource) return;

    const token = localStorage.getItem('auth_token');
    const url = token ? `/api/chat/stream?token=${encodeURIComponent(token)}` : '/api/chat/stream';
    this.eventSource = new EventSource(url);

    this.eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.messageReceived$.next(data);
      } catch (e) {
        this.messageReceived$.next({ type: 'update' });
      }
    });

    this.eventSource.onerror = (err) => {
      console.warn('[ChatService] SSE stream error, reconnecting...', err);
      this.disconnectStream();
      setTimeout(() => this.connectStream(), 4000);
    };
  }

  private disconnectStream(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  pollConversations(periodMs = 5000): Observable<any[]> {
    this.connectStream();
    return this.conversations().pipe(
      switchMap((initial) => {
        return concat(
          of(initial),
          this.messageReceived$.pipe(
            switchMap(() => this.conversations())
          )
        );
      })
    );
  }

  pollMessages(userId: number, periodMs = 5000): Observable<any[]> {
    this.connectStream();
    return this.messages(userId).pipe(
      switchMap((initial) => {
        return concat(
          of(initial),
          this.messageReceived$.pipe(
            switchMap(() => this.messages(userId))
          )
        );
      })
    );
  }
}

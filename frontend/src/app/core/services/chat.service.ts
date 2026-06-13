import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, of, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class ChatService implements OnDestroy {
  private eventSource: EventSource | null = null;
  private messageReceived$ = new Subject<any>();

  constructor(private api: ApiService) {}

  ngOnDestroy(): void {
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

  pollConversations(periodMs = 15000): Observable<any[]> {
    return timer(0, periodMs).pipe(
      switchMap(() => this.conversations())
    );
  }

  pollMessages(userId: number, periodMs = 5000): Observable<any[]> {
    return timer(0, periodMs).pipe(
      switchMap(() => this.messages(userId))
    );
  }
}

import { Injectable } from '@angular/core';
import { Observable, timer, switchMap } from 'rxjs';
import { ApiService } from '../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class ChatService {
  constructor(private api: ApiService) {}

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

  pollConversations(periodMs = 5000): Observable<any[]> {
    return timer(0, periodMs).pipe(switchMap(() => this.conversations()));
  }

  pollMessages(userId: number, periodMs = 5000): Observable<any[]> {
    return timer(0, periodMs).pipe(switchMap(() => this.messages(userId)));
  }
}

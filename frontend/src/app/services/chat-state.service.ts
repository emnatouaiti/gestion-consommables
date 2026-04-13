import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ChatPeer {
  id: number;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class ChatStateService {
  private activeSubject = new BehaviorSubject<ChatPeer | null>(null);
  active$ = this.activeSubject.asObservable();

  setActive(peer: ChatPeer | null) {
    this.activeSubject.next(peer);
  }

  getActive(): ChatPeer | null {
    return this.activeSubject.value;
  }
}

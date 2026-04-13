import {
  Component, OnDestroy, OnInit, ChangeDetectorRef,
  ViewChild, ElementRef, AfterViewChecked
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ChatService } from '../../../services/chat.service';
import { AuthService } from '../../../core/services/auth.service';
import { ChatStateService } from '../../../services/chat-state.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  readonly maxAttachmentBytes = 2 * 1024 * 1024;
  conversations: any[] = [];
  messages: any[] = [];
  selectedUser: any = null;
  users: any[] = [];
  messageText = '';
  selectedFile: File | null = null;
  sendError = '';
  unreadCount = 0;
  loadingMessages = false;
  loadingConversations = false;
  authUserId: number | null = null;

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  private shouldScroll = false;

  private readonly AVATAR_COLORS = ['c1','c2','c3','c4','c5'];
  private convSub?: Subscription;
  private msgSub?: Subscription;

  constructor(
    private chat: ChatService,
    private auth: AuthService,
    private chatState: ChatStateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.auth.getCurrentUser().subscribe(user => {
      this.authUserId = user?.id ?? null;
      this.startConversationsPolling();
      this.loadUsers();
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  ngOnDestroy(): void {
    this.convSub?.unsubscribe();
    this.msgSub?.unsubscribe();
  }

  /* ─── Sélection conversation ─── */
  selectConversation(conv: any): void {
    this.selectedUser = { ...conv.user };
    this.chatState?.setActive?.({ id: conv.user.id, name: conv.user.name });
    this.loadMessages();
  }

  /* ─── Envoi ─── */
  send(): void {
    const text = this.messageText.trim();
    if ((!text && !this.selectedFile) || !this.selectedUser) return;
    this.sendError = '';

    this.chat.send(this.selectedUser.id, text, this.selectedFile).subscribe({
      next: () => {
        this.messageText = '';
        this.selectedFile = null;
        this.loadMessages();
        this.loadConversations();
        this.cdr.detectChanges();
      },
      error: (err) => {
        const errors = err?.errors ? Object.values(err.errors).flat().join(' ') : '';
        this.sendError = err?.message || errors || 'Envoi impossible.';
        this.cdr.detectChanges();
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length ? input.files[0] : null;
    if (file && file.size > this.maxAttachmentBytes) {
      this.selectedFile = null;
      this.sendError = 'Le fichier depasse 2 Mo. Reduisez sa taille ou compressez-le.';
      input.value = '';
      this.cdr.detectChanges();
      return;
    }

    this.selectedFile = file;
    this.sendError = '';
    input.value = '';
  }

  clearSelectedFile(): void {
    this.selectedFile = null;
  }

  /* ─── Helpers présence ─── */
  isOnline(lastSeen: string | null | undefined): boolean {
    if (!lastSeen) return false;
    const d = new Date(lastSeen).getTime();
    return !isNaN(d) && (Date.now() - d) < 5 * 60 * 1000;
  }

  /**
   * Affiche :
   *  - "En ligne"              si < 5 min
   *  - "Vu à 14:32"           si aujourd'hui mais > 5 min
   *  - "Vu hier à 14:32"      si hier
   *  - "Vu avant-hier à..."   si avant-hier
   *  - "Vu le 12/03 à 14:32"  sinon
   */
  presenceLabel(lastSeen: string | null | undefined): string {
    if (!lastSeen) return '';
    const d = new Date(lastSeen);
    if (isNaN(d.getTime())) return '';
    if (this.isOnline(lastSeen)) return 'En ligne';

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    if (diffDays === 0) return `vu à ${time}`;
    if (diffDays === 1) return `vu hier à ${time}`;
    if (diffDays === 2) return `vu avant-hier à ${time}`;
    return `vu le ${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} à ${time}`;
  }

  statusLabel(): string {
    const last = this.selectedUser?.last_seen_at;
    if (!last) return '';
    if (this.isOnline(last)) return 'En ligne';
    return this.presenceLabel(last);
  }

  /* ─── Séparateurs de jours dans les messages ─── */
  get messagesWithSeparators(): any[] {
    const result: any[] = [];
    let lastDay = '';
    let lastSenderId: number | null = null;

    for (const m of this.messages) {
      const d = new Date(m.created_at);
      const dayKey = d.toDateString();
      const dayLabel = this.smartDate(m.created_at, true);

      if (dayKey !== lastDay) {
        result.push({ isSeparator: true, label: dayLabel });
        lastDay = dayKey;
        lastSenderId = null;
      }

      const showAvatar = m.sender_id !== lastSenderId;
      result.push({ ...m, isSeparator: false, showAvatar });
      lastSenderId = m.sender_id;
    }
    return result;
  }

  /**
   * Formate une date pour les séparateurs ou les horodatages sidebar.
   * @param full  true = texte complet pour séparateur ("Aujourd'hui", "Hier"…)
   *              false = version courte pour sidebar ("14:32", "Hier", "12/03")
   */
  smartDate(dateStr: string | null | undefined, full = false): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';

    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
    const sameDay = d.toDateString() === now.toDateString();

    if (sameDay) {
      return full
        ? "Aujourd'hui"
        : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) return full ? 'Hier' : 'Hier';
    if (diffDays === 2) return full ? 'Avant-hier' : 'Avant-hier';
    if (diffDays < 7) {
      const day = d.toLocaleDateString('fr-FR', { weekday: 'long' });
      return full ? day.charAt(0).toUpperCase() + day.slice(1) : day.slice(0,3);
    }
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  }

  /* ─── Avatar helpers ─── */
  initials(name: string | null | undefined): string {
    if (!name) return '?';
    return name.trim().split(/\s+/)
      .slice(0, 2)
      .map(p => p[0].toUpperCase())
      .join('');
  }

  avatarColor(id: number | null | undefined): string {
    if (id == null) return 'c1';
    return this.AVATAR_COLORS[id % this.AVATAR_COLORS.length];
  }

  isMine(msg: any): boolean {
    return this.authUserId !== null && msg.sender_id === this.authUserId;
  }

  attachmentLabel(msg: any): string {
    return msg?.attachment_name || 'Fichier joint';
  }

  attachmentSize(size: number | null | undefined): string {
    const value = Number(size || 0);
    if (!value) return '';
    if (value < 1024) return `${value} o`;
    if (value < 1024 * 1024) return `${Math.round(value / 1024)} Ko`;
    return `${(value / (1024 * 1024)).toFixed(1)} Mo`;
  }

  lastSeenMessageLabel(): string {
    const sentMessages = [...this.messages]
      .filter((message: any) => this.isMine(message) && (message.read_at || message.is_read))
      .reverse();

    const lastSeen = sentMessages.find((message: any) => message.read_at || message.updated_at);
    const seenAt = lastSeen?.read_at || lastSeen?.updated_at;

    if (!seenAt) {
      return '';
    }

    return `Vu ${this.smartDateTime(seenAt)}`;
  }

  smartDateTime(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';

    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    if (d.toDateString() === now.toDateString()) {
      return `a ${time}`;
    }
    if (diffDays === 1) {
      return `hier a ${time}`;
    }

    return `le ${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} a ${time}`;
  }

  /* ─── Privé ─── */
  private startConversationsPolling(): void {
    this.convSub?.unsubscribe();
    this.convSub = this.chat.pollConversations().subscribe({
      next: (data) => {
        this.conversations = data;
        this.unreadCount = Array.isArray(data)
          ? data.reduce((s: number, c: any) => s + Number(c?.unread || 0), 0)
          : 0;
        if (this.selectedUser) {
          const found = data.find((c: any) => c?.user?.id === this.selectedUser.id);
          if (found?.user?.last_seen_at) {
            this.selectedUser = { ...this.selectedUser, last_seen_at: found.user.last_seen_at };
          }
        }
        this.cdr.detectChanges();
      }
    });
  }

  private loadUsers(): void {
    this.chat.users().subscribe({
      next: (list) => { this.users = list || []; this.cdr.detectChanges(); },
      error: () => { this.users = []; }
    });
  }

  private loadConversations(): void {
    this.chat.conversations().subscribe({
      next: (data) => { this.conversations = data; this.cdr.detectChanges(); }
    });
  }

  private loadMessages(): void {
    if (!this.selectedUser) return;
    this.loadingMessages = true;
    this.msgSub?.unsubscribe();
    this.msgSub = this.chat.pollMessages(this.selectedUser.id).subscribe({
      next: (data) => {
        this.messages = data;
        this.loadingMessages = false;
        this.shouldScroll = true;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingMessages = false; }
    });
  }

  private scrollToBottom(): void {
    try {
      const el = this.messagesContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }
  onEnter(event: Event): void {
    const ke = event as KeyboardEvent;
    if (!ke.shiftKey) {
      ke.preventDefault();
      this.send();
    }
  }
}

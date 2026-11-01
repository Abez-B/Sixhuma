import type { Participant, ChatMessage } from 'sixhuma-core';

export type { ChatMessage };

function convKey(a: string, b: string) {
  return [a, b].sort().join('|');
}

export class ChatStore {
  globalMessages = $state<ChatMessage[]>([]);
  dms = $state<Record<string, ChatMessage[]>>({});
  unreadDms = $state<string[]>([]);
  unreadGlobalCount = $state<number>(0);
  isChatOpen = $state<boolean>(false);

  getDmMessages(a: string, b: string): ChatMessage[] {
    const key = convKey(a, b);
    return this.dms[key] ?? [];
  }

  setChatOpen(isOpen: boolean) {
    this.isChatOpen = isOpen;
    if (isOpen) {
      this.unreadGlobalCount = 0;
    }
  }

  handleIncomingGlobal(msg: ChatMessage, selfPeerId?: string | null) {
    if (this.globalMessages.some(m => m.id === msg.id)) return;
    this.globalMessages = [...this.globalMessages, msg];
    if (selfPeerId && msg.peerId !== selfPeerId && !this.isChatOpen) {
      this.unreadGlobalCount++;
    }
  }

  handleIncomingDm(msg: ChatMessage, selfPeerId?: string | null) {
    const targetPeer = msg.toPeerId || ((msg.peerId === selfPeerId) ? '' : msg.peerId);
    if (!targetPeer) return;
    const key = convKey(msg.peerId, targetPeer);
    const msgs = this.dms[key] ?? [];
    if (msgs.some(m => m.id === msg.id)) return;
    this.dms = {
      ...this.dms,
      [key]: [...msgs, msg],
    };
    if (selfPeerId && msg.peerId !== selfPeerId) {
      if (!this.unreadDms.includes(key)) {
        this.unreadDms = [...this.unreadDms, key];
      }
    }
  }

  seedGlobal(messages: ChatMessage[]) {
    const globalList: ChatMessage[] = [];
    const newDms = { ...this.dms };

    for (const m of messages) {
      if (m.toPeerId) {
        const key = convKey(m.peerId, m.toPeerId);
        const existing = newDms[key] ?? [];
        if (!existing.some(x => x.id === m.id)) {
          newDms[key] = [...existing, m];
        }
      } else {
        globalList.push(m);
      }
    }

    const map = new Map<string, ChatMessage>();
    for (const m of this.globalMessages) map.set(m.id, m);
    for (const m of globalList) map.set(m.id, m);

    this.globalMessages = Array.from(map.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    this.dms = newDms;
  }

  markDmRead(a: string, b: string) {
    const key = convKey(a, b);
    if (this.unreadDms.includes(key)) {
      this.unreadDms = this.unreadDms.filter(k => k !== key);
    }
  }

  postGlobal(msg: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage {
    const full = this._make(msg);
    this.globalMessages = [...this.globalMessages, full];
    return full;
  }

  postDm(
    from: string,
    to: string,
    msg: Omit<ChatMessage, 'id' | 'timestamp'>,
    markUnread = false,
  ): ChatMessage {
    const key = convKey(from, to);
    const full = this._make(msg);
    const existing = this.dms[key] ?? [];
    this.dms = {
      ...this.dms,
      [key]: [...existing, full],
    };
    if (markUnread && !this.unreadDms.includes(key)) {
      this.unreadDms = [...this.unreadDms, key];
    }
    return full;
  }

  private _make(msg: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage {
    return {
      ...msg,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
  }

  // Legacy shim
  seed(messages: ChatMessage[]) { this.seedGlobal(messages); }
  send(msg: Omit<ChatMessage, 'id' | 'timestamp'>) { return this.postGlobal(msg); }
}

export const chatStore = new ChatStore();

// ── Mock auto-reply ──────────────────────────────────────────────────────────

const MOCK_REPLIES = [
  'Hey! Happy to connect 👋',
  'Great to meet you at this event!',
  "Thanks for reaching out! What are you working on?",
  "Definitely — let's chat more after the session.",
  "Cool! I'd love to hear more about what you're building.",
  "Interesting! Let's connect on LinkedIn too 🚀",
  "Absolutely, sounds great!",
  "Nice to meet you! What brings you to this event?",
];

export function scheduleMockReply(from: Participant, toId: string, delayMs: number) {
  setTimeout(() => {
    let photo = `https://api.dicebear.com/7.x/thumbs/svg?seed=${from.peerId}`;
    try {
      const p = JSON.parse(from.json ?? '{}');
      if (p.photo) photo = p.photo as string;
    } catch { /* noop */ }
    chatStore.postDm(
      from.peerId,
      toId,
      {
        peerId: from.peerId,
        displayName: from.displayName,
        text: MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)],
        avatarUrl: photo,
      },
      true, // markUnread — triggers notification
    );
  }, delayMs);
}

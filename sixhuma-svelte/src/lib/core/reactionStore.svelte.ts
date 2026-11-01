export interface Reaction {
  id: string;
  peerId: string;
  displayName: string;
  emoji: string;
  timestamp: number;
  avatarUrl?: string;
}

const TTL = 1800; // ms — reaction stays visible

export class ReactionStore {
  reactions = $state<Reaction[]>([]);

  get active(): Reaction[] {
    const now = Date.now();
    return this.reactions.filter(r => now - r.timestamp < TTL);
  }

  fire(r: Omit<Reaction, 'id' | 'timestamp'>) {
    const full: Reaction = {
      ...r,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      timestamp: Date.now(),
    };
    this.reactions = [...this.reactions.filter(x => Date.now() - x.timestamp < TTL), full];
    setTimeout(() => {
      this.reactions = this.reactions.filter(x => x.id !== full.id);
    }, TTL + 300);
  }
}

export const reactionStore = new ReactionStore();

// ── Mock auto-fire from other participants ────────────────────────────────────
const MOCK_EMOJIS = ['👋', '👏', '🙋', '❤️', '🎉'];

export function scheduleMockReactions(
  participants: Array<{ peerId: string; displayName: string; avatarUrl?: string }>,
  selfPeerId: string,
) {
  const others = participants.filter(p => p.peerId !== selfPeerId);
  if (!others.length) return;

  const count = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const delay = 3000 + Math.random() * 17000;
    setTimeout(() => {
      const p = others[Math.floor(Math.random() * others.length)];
      reactionStore.fire({
        peerId: p.peerId,
        displayName: p.displayName,
        emoji: MOCK_EMOJIS[Math.floor(Math.random() * MOCK_EMOJIS.length)],
        avatarUrl: p.avatarUrl,
      });
    }, delay);
  }
}

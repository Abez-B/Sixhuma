<script lang="ts">
  import type { Participant } from 'sixhuma-core';
  import { parseProfile } from 'sixhuma-core';
  import { reactionStore, scheduleMockReactions } from '../core/reactionStore.svelte';

  const IS_MOCK = typeof import.meta !== 'undefined' && import.meta.env?.VITE_MOCK_MODE === 'true';

  const EMOJIS = [
    { emoji: '👋', label: 'Wave' },
    { emoji: '👏', label: 'Clap' },
    { emoji: '🙋', label: 'Raise hand' },
    { emoji: '❤️', label: 'Love' },
    { emoji: '🎉', label: 'Celebrate' },
  ];

  interface Props {
    selfPeerId?: string | null;
    selfName?: string;
    selfAvatar?: string;
    participants?: Participant[];
    onFire?: (emoji: string) => void;
    showBar?: boolean;
    showFloats?: boolean;
  }

  let {
    selfPeerId,
    selfName,
    selfAvatar,
    participants = [],
    onFire,
    showBar = true,
    showFloats = true,
  }: Props = $props();

  let fired = $state<string | null>(null);
  let mockSeeded = false;

  $effect(() => {
    if (!IS_MOCK || mockSeeded || !selfPeerId) return;
    mockSeeded = true;
    const others = participants
      .filter((p) => p.peerId !== selfPeerId)
      .map((p) => {
        const prof = parseProfile(p.json);
        return { peerId: p.peerId, displayName: p.displayName, avatarUrl: prof?.photo };
      });
    scheduleMockReactions(others, selfPeerId);
  });

  function handleFire(emoji: string) {
    if (!selfPeerId) return;
    reactionStore.fire({
      peerId: selfPeerId,
      displayName: selfName || 'You',
      emoji,
      avatarUrl: selfAvatar,
    });
    onFire?.(emoji);
    fired = emoji;
    setTimeout(() => (fired = null), 600);
  }

  // Animation helpers
  function floatUp(node: Element, { duration = 350 }) {
    return {
      duration,
      css: (t: number) => {
        const eased = 1 - Math.pow(1 - t, 3);
        return `
          opacity: ${t};
          transform: translateY(${-70 * eased}px) scale(${0.6 + 0.4 * eased});
        `;
      },
    };
  }

  function floatOut(node: Element, { duration = 350 }) {
    return {
      duration,
      css: (t: number) => {
        const eased = Math.pow(t, 3);
        return `
          opacity: ${t};
          transform: translateY(${-110 + 40 * t}px) scale(${0.8 + 0.2 * t});
        `;
      },
    };
  }
</script>

{#if showFloats}
  <div class="reaction-floats" aria-live="polite" aria-atomic="false">
    {#each reactionStore.active as r (r.id)}
      <div
        class="reaction-float"
        in:floatUp={{ duration: 350 }}
        out:floatOut={{ duration: 350 }}
      >
        <div class="reaction-float-emoji">{r.emoji}</div>
        <div class="reaction-float-name">{r.displayName.split(' ')[0]}</div>
      </div>
    {/each}
  </div>
{/if}

{#if showBar}
  <div class="reaction-bar">
    {#each EMOJIS as { emoji, label } (emoji)}
      <button
        class={`reaction-btn ${fired === emoji ? 'reaction-btn-fired' : ''}`}
        onclick={() => handleFire(emoji)}
        title={label}
        aria-label={label}
      >
        {emoji}
      </button>
    {/each}
  </div>
{/if}

<style>
  .reaction-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(15, 17, 23, 0.88);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    padding: 8px 16px;
    border-radius: 9999px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45), 0 1px 3px rgba(0, 0, 0, 0.2);
    position: fixed;
    bottom: calc(24px + env(safe-area-inset-bottom, 0px));
    left: 50%;
    transform: translateX(-50%);
    z-index: 450;
    user-select: none;
    -webkit-user-select: none;
  }

  .reaction-btn {
    background: transparent;
    border: none;
    font-size: 24px;
    cursor: pointer;
    width: 40px;
    height: 40px;
    min-width: 40px;
    min-height: 40px;
    padding: 0;
    border-radius: 50%;
    transition:
      transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1),
      background 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    touch-action: manipulation;
  }

  .reaction-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    transform: scale(1.18);
  }

  .reaction-btn:active {
    background: rgba(255, 255, 255, 0.18);
    transform: scale(0.92);
  }

  .reaction-btn-fired {
    animation: pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes pop {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.35);
    }
    100% {
      transform: scale(1);
    }
  }

  .reaction-floats {
    position: fixed;
    bottom: calc(84px + env(safe-area-inset-bottom, 0px));
    left: 50%;
    transform: translateX(-50%);
    pointer-events: none;
    z-index: 451;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .reaction-float {
    position: absolute;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
  }

  .reaction-float-emoji {
    font-size: 32px;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4));
  }

  .reaction-float-name {
    font-size: 11px;
    font-weight: 600;
    background: rgba(0, 0, 0, 0.7);
    padding: 2px 7px;
    border-radius: 4px;
    color: #fff;
    margin-top: 4px;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }

  @media (max-width: 768px) {
    .reaction-bar {
      bottom: calc(16px + env(safe-area-inset-bottom, 0px));
      gap: 8px;
      padding: 6px 14px;
      border-radius: 9999px;
    }
    .reaction-btn {
      font-size: 20px;
      width: 36px;
      height: 36px;
      min-width: 36px;
      min-height: 36px;
      padding: 0;
    }
    .reaction-floats {
      bottom: calc(72px + env(safe-area-inset-bottom, 0px));
    }
  }
</style>

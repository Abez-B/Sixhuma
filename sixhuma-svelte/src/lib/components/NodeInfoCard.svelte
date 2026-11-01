<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { type Participant, parseProfile } from 'sixhuma-core';

  const ensureUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://${url}`;
  };

  const ROLE_COLORS: Record<string, string> = {
    host: 'rgba(255,215,0,0.12)',
    speaker: 'rgba(59,130,246,0.12)',
    organizer: 'rgba(139,92,246,0.12)',
    attendee: 'rgba(20,184,166,0.1)',
  };
  const ROLE_TEXT: Record<string, string> = {
    host: '#FFD700',
    speaker: '#60a5fa',
    organizer: '#a78bfa',
    attendee: '#2dd4bf',
  };
  const ROLE_BORDER: Record<string, string> = {
    host: 'rgba(255,215,0,0.3)',
    speaker: 'rgba(59,130,246,0.3)',
    organizer: 'rgba(139,92,246,0.3)',
    attendee: 'rgba(20,184,166,0.25)',
  };

  interface Props {
    participant: Participant;
    visited: boolean;
    position: { x: number; y: number } | null;
    onClose: () => void;
    onMarkVisited: () => void;
    onMessage?: () => void;
  }

  let {
    participant,
    visited,
    position,
    onClose,
    onMarkVisited,
    onMessage,
  }: Props = $props();

  let profile = $derived(parseProfile(participant.json));

  let isMobile = $state(false);
  $effect(() => {
    isMobile = window.innerWidth < 768;
    const check = () => (isMobile = window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  });

  let roleKey = $derived(participant.role?.toLowerCase() || 'attendee');

  $effect(() => {
    if (!isMobile) return;
    window.history.pushState({ nodeInfoOpen: true }, '');
    const handlePop = () => onClose();
    window.addEventListener('popstate', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
      if (window.history.state?.nodeInfoOpen) {
        window.history.back();
      }
    };
  });

  let sheetElement: HTMLDivElement | undefined = $state();
  let dragStartY: number | null = null;
  let dragCurrentY = 0;

  function handleTouchStart(e: TouchEvent) {
    dragStartY = e.touches[0].clientY;
    dragCurrentY = 0;
  }

  function handleTouchMove(e: TouchEvent) {
    if (dragStartY === null) return;
    const dy = e.touches[0].clientY - dragStartY;
    if (dy < 0) return;
    dragCurrentY = dy;
    if (sheetElement) {
      sheetElement.style.transform = `translateY(${dy}px)`;
      sheetElement.style.transition = 'none';
    }
  }

  function handleTouchEnd() {
    if (dragStartY === null) return;
    const threshold = 120;
    if (dragCurrentY > threshold) {
      onClose();
    } else {
      if (sheetElement) {
        sheetElement.style.transform = '';
        sheetElement.style.transition = '';
      }
    }
    dragStartY = null;
    dragCurrentY = 0;
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="nodeinfo-overlay"
  onclick={onClose}
  in:fade={{ duration: 180 }}
  out:fade={{ duration: 180 }}
  style={isMobile
    ? 'position: fixed; inset: 0; background-color: rgba(0,0,0,0.65); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); display: flex; align-items: flex-end; z-index: 2000;'
    : ''}
>
  <div
    bind:this={sheetElement}
    class="nodeinfo-panel"
    onclick={(e) => e.stopPropagation()}
    style={isMobile
      ? 'width: 100%; max-width: none; max-height: 85vh; box-shadow: 0 -16px 48px rgba(0,0,0,0.7); border-radius: 20px 20px 0 0;'
      : `position: fixed; left: ${Math.max(16, Math.min((position?.x || window.innerWidth / 2) - 150, window.innerWidth - 326))}px; top: ${Math.max(16, Math.min((position?.y || window.innerHeight / 2) - 140, window.innerHeight - 440))}px; z-index: 1001; box-shadow: 0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.07); width: 310px; max-height: min(85vh, 500px);`}
    in:fly={isMobile ? { y: 400, duration: 320 } : { y: 12, duration: 220 }}
    out:fly={isMobile ? { y: 400, duration: 320 } : { y: 12, duration: 220 }}
  >
    {#if isMobile}
      <div
        class="nodeinfo-drag-handle"
        aria-hidden="true"
        ontouchstart={handleTouchStart}
        ontouchmove={handleTouchMove}
        ontouchend={handleTouchEnd}
      >
        <div class="nodeinfo-drag-pill"></div>
      </div>
    {/if}

    <button class="nodeinfo-close" onclick={onClose} aria-label="Close">✕</button>

    <div
      class="nodeinfo-head"
      ontouchstart={isMobile ? handleTouchStart : undefined}
      ontouchmove={isMobile ? handleTouchMove : undefined}
      ontouchend={isMobile ? handleTouchEnd : undefined}
    >
      <div
        class="nodeinfo-initial"
        style="
          background: {visited ? 'rgba(16,185,129,0.12)' : (ROLE_COLORS[roleKey] ?? 'rgba(255,255,255,0.06)')};
          border-color: {visited ? 'rgba(16,185,129,0.3)' : (ROLE_BORDER[roleKey] ?? 'rgba(255,255,255,0.1)')};
        "
      >
        {#if profile?.photo}
          <img src={profile.photo} alt={participant.displayName} class="nodeinfo-avatar" />
        {:else}
          <span style="font-size: 24px; color: {ROLE_TEXT[roleKey] ?? '#f5f5f5'};">
            {participant.displayName.charAt(0).toUpperCase()}
          </span>
        {/if}
      </div>

      <div class="nodeinfo-name-block">
        <div class="nodeinfo-name">{participant.displayName}</div>
        <span
          class="nodeinfo-role-pill"
          style="
            background: {ROLE_COLORS[roleKey] ?? 'rgba(255,255,255,0.06)'};
            color: {ROLE_TEXT[roleKey] ?? '#888'};
            border-color: {ROLE_BORDER[roleKey] ?? 'rgba(255,255,255,0.1)'};
          "
        >
          {participant.role}
        </span>
        {#if visited}
          <span class="nodeinfo-visited-badge">✓ Visited</span>
        {/if}
      </div>
    </div>

    <!-- Scrollable content area for bio, tags, links -->
    <div class="nodeinfo-content-scroll">
      <p class="nodeinfo-bio">
        {profile?.bio || 'No bio provided.'}
      </p>

      {#if profile?.tags && profile.tags.length > 0}
        <div style="display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 0;">
          {#each profile.tags as t}
            <span
              style="padding: 3px 9px; border-radius: 4px; font-size: 11px; background: rgba(99, 102, 241, 0.08); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.2);"
            >
              {t}
            </span>
          {/each}
        </div>
      {/if}

      {#if profile?.linkedIn || profile?.github}
        <div class="nodeinfo-links">
          {#if profile?.linkedIn}
            <a
              href={ensureUrl(profile.linkedIn)}
              target="_blank"
              rel="noopener noreferrer"
              class="nodeinfo-link nodeinfo-link-li"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
                />
              </svg>
              LinkedIn
            </a>
          {/if}
          {#if profile?.github}
            <a
              href={ensureUrl(profile.github)}
              target="_blank"
              rel="noopener noreferrer"
              class="nodeinfo-link nodeinfo-link-gh"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
                />
              </svg>
              GitHub
            </a>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Pinned footer actions -->
    <div class="nodeinfo-actions">
      {#if onMessage}
        <button
          class="nodeinfo-msg-btn"
          onclick={() => {
            onMessage();
            onClose();
          }}
        >
          💬 Message
        </button>
      {/if}
      <button class="nodeinfo-visit-btn" onclick={onMarkVisited}>
        {visited ? 'Remove Visit' : 'Mark as Visited'}
      </button>
    </div>
  </div>
</div>

<style>
  .nodeinfo-overlay {
    pointer-events: none;
  }

  .nodeinfo-panel {
    pointer-events: all;
    background: rgba(10, 10, 18, 0.95);
    backdrop-filter: blur(32px);
    -webkit-backdrop-filter: blur(32px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 18px;
    color: #fff;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: hidden;
    box-sizing: border-box;
  }

  .nodeinfo-drag-handle {
    display: flex;
    justify-content: center;
    padding: 4px 0 8px;
    margin: -8px 0 0;
    cursor: grab;
    touch-action: none;
    flex-shrink: 0;
  }

  .nodeinfo-drag-pill {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.25);
  }

  .nodeinfo-close {
    position: absolute;
    top: 12px;
    right: 12px;
    background: rgba(255, 255, 255, 0.08);
    border: none;
    color: rgba(255, 255, 255, 0.5);
    width: 28px;
    height: 28px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    transition:
      background 0.15s,
      color 0.15s;
  }
  .nodeinfo-close:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
  }

  .nodeinfo-head {
    display: flex;
    align-items: center;
    gap: 14px;
    padding-right: 32px;
    flex-shrink: 0;
  }

  .nodeinfo-initial {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    flex-shrink: 0;
    overflow: hidden;
  }

  .nodeinfo-avatar {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
  }

  .nodeinfo-name-block {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .nodeinfo-name {
    font-size: 15px;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nodeinfo-role-pill {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 6px;
    border: 1px solid transparent;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    align-self: flex-start;
  }

  .nodeinfo-visited-badge {
    display: inline-block;
    font-size: 11px;
    color: #10b981;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.2);
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 500;
  }

  .nodeinfo-content-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-right: 4px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
  }

  .nodeinfo-content-scroll::-webkit-scrollbar {
    width: 4px;
  }
  .nodeinfo-content-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .nodeinfo-content-scroll::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.25);
    border-radius: 4px;
  }
  .nodeinfo-content-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.4);
  }

  .nodeinfo-bio {
    font-size: 13px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.7);
    margin: 0;
    padding-top: 6px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: break-word;
  }

  .nodeinfo-links {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .nodeinfo-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
    padding: 5px 10px;
    border-radius: 6px;
    text-decoration: none;
    transition:
      opacity 0.15s,
      background 0.15s;
  }
  .nodeinfo-link:hover {
    opacity: 0.85;
  }

  .nodeinfo-link-li {
    background: rgba(10, 102, 194, 0.18);
    color: #60a5fa;
    border: 1px solid rgba(10, 102, 194, 0.3);
  }

  .nodeinfo-link-gh {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .nodeinfo-actions {
    display: flex;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
  }

  .nodeinfo-msg-btn {
    flex: 1;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.3);
    color: #818cf8;
    padding: 9px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }
  .nodeinfo-msg-btn:hover {
    background: rgba(99, 102, 241, 0.25);
    color: #a5b4fc;
  }

  .nodeinfo-visit-btn {
    flex: 1;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
    padding: 9px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }
  .nodeinfo-visit-btn:hover {
    background: rgba(16, 185, 129, 0.12);
    border-color: rgba(16, 185, 129, 0.25);
    color: #10b981;
  }
</style>

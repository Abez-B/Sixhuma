<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { type Participant, parseProfile } from 'sixhuma-core';
  import { exportContactsAsVCard } from '$lib/utils/contactExport';

  const ensureUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://${url}`;
  };

  const ROLE_COLORS: Record<string, string> = {
    host: '#F5B82E',
    speaker: '#60a5fa',
    organizer: '#a78bfa',
    attendee: '#2dd4bf',
  };

  const ROLE_BADGE_BG: Record<string, string> = {
    host: 'rgba(245, 184, 46, 0.15)',
    speaker: 'rgba(96, 165, 250, 0.15)',
    organizer: 'rgba(167, 139, 250, 0.15)',
    attendee: 'rgba(45, 212, 191, 0.15)',
  };

  interface Props {
    participant: Participant;
    visited: boolean;
    position?: { x: number; y: number } | null;
    onClose: () => void;
    onMarkVisited: () => void;
    onMessage?: () => void;
  }

  let {
    participant,
    visited,
    position = null,
    onClose,
    onMarkVisited,
    onMessage,
  }: Props = $props();

  let profile = $derived(parseProfile(participant.json));
  let roleKey = $derived(participant.role?.toLowerCase() || 'attendee');
  let roleColor = $derived(ROLE_COLORS[roleKey] ?? '#E8742A');
  let roleBg = $derived(ROLE_BADGE_BG[roleKey] ?? 'rgba(232, 116, 42, 0.15)');

  let imageError = $state(false);

  // Keyboard accessibility: Escape closes the modal
  function handleWindowKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'v' || e.key === 'V') {
      // Shortcut to mark as visited
      e.preventDefault();
      onMarkVisited();
    } else if ((e.key === 'm' || e.key === 'M') && onMessage) {
      // Shortcut to message
      e.preventDefault();
      onMessage();
      onClose();
    }
  }

  function handleExportCard() {
    exportContactsAsVCard([participant], new Set([participant.peerId]), {
      eventName: 'Sixhuma Contact',
    });
  }
</script>

<svelte:window onkeydown={handleWindowKeyDown} />

<!-- Full-screen accessible backdrop -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="nodecard-backdrop"
  onclick={onClose}
  in:fade={{ duration: 150 }}
  out:fade={{ duration: 150 }}
  aria-hidden="true"
></div>

<!-- Modal Dialog Container -->
<div
  class="nodecard-wrapper"
  role="dialog"
  aria-modal="true"
  tabindex="-1"
  aria-labelledby="nodecard-attendee-name"
  in:scale={{ start: 0.94, duration: 200 }}
  out:scale={{ start: 0.94, duration: 150 }}
  onclick={(e) => e.stopPropagation()}
  onkeydown={(e) => e.stopPropagation()}
>
  <!-- Card Header / Name Box -->
  <div class="nodecard-name-box">
    <div id="nodecard-attendee-name" class="nodecard-name">
      {participant.displayName}
    </div>
    <div class="nodecard-role-pill" style="color: {roleColor}; background: {roleBg}; border-color: {roleColor};">
      {participant.role || 'Attendee'}
    </div>
  </div>

  <!-- Card Body Box -->
  <div class="nodecard-body-box">
    <!-- Top Status / Level Row -->
    <div class="nodecard-status-bar">
      <div class="nodecard-level">
        <span class="nodecard-level-label">STATUS</span>
        <span class="nodecard-level-value" style="color: {roleColor};">
          {participant.role === 'Host' ? '★ Host' : participant.role === 'Speaker' ? '🎙 Speaker' : participant.role === 'Organizer' ? '⚡ Organizer' : '✦ Active'}
        </span>
      </div>

      <button
        type="button"
        class="nodecard-visit-badge"
        class:is-visited={visited}
        onclick={onMarkVisited}
        aria-label={visited ? 'Participant is visited. Click to mark as unvisited' : 'Click to mark participant as visited'}
      >
        {#if visited}
          <span class="nodecard-badge-dot visited-dot"></span>
          <span class="nodecard-badge-text">✓ Visited</span>
        {:else}
          <span class="nodecard-badge-dot unvisited-dot"></span>
          <span class="nodecard-badge-text">○ Unvisited</span>
        {/if}
      </button>
    </div>

    <!-- Image Area -->
    <div class="nodecard-image-container">
      {#if profile?.photo && !imageError}
        <img
          src={profile.photo}
          alt={participant.displayName}
          class="nodecard-avatar-img"
          style="border-color: {visited ? '#10b981' : roleColor};"
          onerror={() => (imageError = true)}
        />
      {:else}
        <!-- Stylized Indaba attendee node placeholder -->
        <div
          class="nodecard-avatar-fallback"
          style="border-color: {visited ? '#10b981' : roleColor}; background: {roleBg};"
        >
          <svg viewBox="0 0 100 100" class="nodecard-svg-mesh" aria-hidden="true">
            <circle cx="50" cy="50" r="32" fill="none" stroke={roleColor} stroke-width="1.5" stroke-dasharray="3 3" opacity="0.6" />
            <line x1="50" y1="20" x2="50" y2="80" stroke={roleColor} stroke-width="1.5" opacity="0.4" />
            <line x1="20" y1="50" x2="80" y2="50" stroke={roleColor} stroke-width="1.5" opacity="0.4" />
            <circle cx="50" cy="50" r="18" fill={roleColor} opacity="0.8" />
            <circle cx="50" cy="20" r="5" fill="#fff" />
            <circle cx="50" cy="80" r="5" fill="#fff" />
            <circle cx="20" cy="50" r="5" fill="#fff" />
            <circle cx="80" cy="50" r="5" fill="#fff" />
          </svg>
          <span class="nodecard-initial" style="color: #fff;">
            {participant.displayName.charAt(0).toUpperCase()}
          </span>
        </div>
      {/if}
    </div>

    <!-- Hobby / Headline -->
    <div class="nodecard-headline">
      {participant.role === 'Host' ? 'Event Host & Curator' : `${participant.role || 'Attendee'} @ Sixhuma`}
    </div>

    <!-- Bio (Scrollable) -->
    <div class="nodecard-bio">
      {profile?.bio || 'Gathering under the Indaba tree to connect, share knowledge, and explore ideas.'}
    </div>

    <!-- Tags (if available) -->
    {#if profile?.tags && profile.tags.length > 0}
      <div class="nodecard-tags-list">
        {#each profile.tags as tag}
          <span class="nodecard-tag-pill">#{tag}</span>
        {/each}
      </div>
    {/if}

    <!-- Social links (LinkedIn / GitHub) -->
    {#if profile?.linkedIn || profile?.github}
      <div class="nodecard-social-links">
        {#if profile?.linkedIn}
          <a
            href={ensureUrl(profile.linkedIn)}
            target="_blank"
            rel="noopener noreferrer"
            class="nodecard-social-btn nodecard-li"
            aria-label="View LinkedIn profile"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            LinkedIn
          </a>
        {/if}
        {#if profile?.github}
          <a
            href={ensureUrl(profile.github)}
            target="_blank"
            rel="noopener noreferrer"
            class="nodecard-social-btn nodecard-gh"
            aria-label="View GitHub profile"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            GitHub
          </a>
        {/if}
      </div>
    {/if}

    <!-- High-accessibility Bottom Action Buttons -->
    <div class="nodecard-actions">
      <!-- Main Visited Toggle Button -->
      <button
        type="button"
        class="nodecard-btn nodecard-btn-visit"
        class:is-visited={visited}
        onclick={onMarkVisited}
        aria-label={visited ? 'Remove from visited list' : 'Mark participant as visited'}
      >
        {#if visited}
          <span class="btn-icon">✓</span>
          <span>Marked as Visited</span>
        {:else}
          <span class="btn-icon">+</span>
          <span>Mark as Visited</span>
        {/if}
      </button>

      <!-- Message Button (if enabled) -->
      {#if onMessage}
        <button
          type="button"
          class="nodecard-btn nodecard-btn-msg"
          onclick={() => {
            onMessage();
            onClose();
          }}
          aria-label="Send direct message to participant"
        >
          <span class="btn-icon">💬</span>
          <span>Message</span>
        </button>
      {/if}
    </div>
  </div>

  <!-- Unique Side Action Tabs Ribbon (Matching the user's design reference) -->
  <aside class="sideBtn-bar" aria-label="Quick Actions">
    <!-- Visit Action Side Button -->
    <button
      type="button"
      class="sideBtn sideBtn-visit"
      class:is-visited={visited}
      onclick={onMarkVisited}
      title={visited ? 'Remove visited status (V)' : 'Mark as visited (V)'}
      aria-label={visited ? 'Marked visited' : 'Mark as visited'}
    >
      <span>{visited ? '✓' : 'V'}</span>
    </button>

    <!-- Message Action Side Button -->
    {#if onMessage}
      <button
        type="button"
        class="sideBtn sideBtn-msg"
        onclick={() => {
          onMessage();
          onClose();
        }}
        title="Send direct message (M)"
        aria-label="Send message"
      >
        <span>M</span>
      </button>
    {/if}

    <!-- Trade / Export vCard Action Side Button -->
    <button
      type="button"
      class="sideBtn sideBtn-export"
      onclick={handleExportCard}
      title="Save contact card (E)"
      aria-label="Export contact"
    >
      <span>E</span>
    </button>

    <!-- Close Side Button -->
    <button
      type="button"
      class="sideBtn sideBtn-close"
      onclick={onClose}
      title="Close card (Esc)"
      aria-label="Close card"
    >
      <span>C</span>
    </button>
  </aside>
</div>

<style>
  /* ── 1. Full-Screen Backdrop ────────────────────────────────────────────── */
  .nodecard-backdrop {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(12, 10, 9, 0.75);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 9990;
    cursor: pointer;
  }

  /* ── 2. Centered Card Container ─────────────────────────────────────────── */
  .nodecard-wrapper {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 290px;
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 40px);
    z-index: 10000;
    font-family: inherit;
    user-select: none;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
  }

  /* ── 3. Name Header Box ─────────────────────────────────────────────────── */
  .nodecard-name-box {
    text-align: center;
    background: #1e1916;
    border: 2px solid #e8742a;
    border-radius: 8px;
    padding: 10px 14px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5), 0 0 12px rgba(232, 116, 42, 0.25);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .nodecard-name {
    font-size: 19px;
    font-weight: 700;
    color: #ffffff;
    line-height: 1.25;
    letter-spacing: -0.01em;
    word-break: break-word;
  }

  .nodecard-role-pill {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 8px;
    border-radius: 9999px;
    border: 1px solid currentColor;
  }

  /* ── 4. Main Body Box ───────────────────────────────────────────────────── */
  .nodecard-body-box {
    margin-top: 10px;
    background: #171311;
    border: 2px solid rgba(232, 116, 42, 0.5);
    border-radius: 8px;
    padding: 14px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-sizing: border-box;
  }

  /* ── 5. Status / Level Row ──────────────────────────────────────────────── */
  .nodecard-status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .nodecard-level {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 600;
  }

  .nodecard-level-label {
    color: rgba(255, 255, 255, 0.4);
    letter-spacing: 0.05em;
  }

  .nodecard-level-value {
    font-weight: 700;
  }

  .nodecard-visit-badge {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    padding: 3px 8px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
    transition: all 0.15s ease;
  }

  .nodecard-visit-badge:hover {
    background: rgba(232, 116, 42, 0.15);
    border-color: rgba(232, 116, 42, 0.4);
    color: #f5b82e;
  }

  .nodecard-visit-badge.is-visited {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.4);
    color: #34d399;
  }

  .nodecard-badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .unvisited-dot {
    background: #9ca3af;
  }

  .visited-dot {
    background: #10b981;
    box-shadow: 0 0 6px #10b981;
  }

  /* ── 6. Profile Image / Avatar ──────────────────────────────────────────── */
  .nodecard-image-container {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 4px 0;
  }

  .nodecard-avatar-img {
    width: 110px;
    height: 110px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid #e8742a;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5), 0 0 16px rgba(232, 116, 42, 0.25);
  }

  .nodecard-avatar-fallback {
    width: 110px;
    height: 110px;
    border-radius: 50%;
    border: 3px solid #e8742a;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5), 0 0 16px rgba(232, 116, 42, 0.25);
  }

  .nodecard-svg-mesh {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .nodecard-initial {
    font-size: 38px;
    font-weight: 800;
    z-index: 1;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
  }

  /* ── 7. Headline & Bio ──────────────────────────────────────────────────── */
  .nodecard-headline {
    text-align: center;
    font-weight: 700;
    font-size: 14px;
    color: #f5b82e;
    line-height: 1.3;
    padding: 0 4px;
  }

  .nodecard-bio {
    max-height: 84px;
    text-align: center;
    font-size: 12px;
    line-height: 1.45;
    color: rgba(255, 255, 255, 0.75);
    overflow-y: auto;
    padding: 0 4px;
    scrollbar-width: thin;
    scrollbar-color: rgba(232, 116, 42, 0.3) transparent;
  }

  /* ── 8. Tags & Social Links ─────────────────────────────────────────────── */
  .nodecard-tags-list {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px;
  }

  .nodecard-tag-pill {
    font-size: 10px;
    font-weight: 500;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(245, 184, 46, 0.1);
    color: #f5b82e;
    border: 1px solid rgba(245, 184, 46, 0.25);
  }

  .nodecard-social-links {
    display: flex;
    justify-content: center;
    gap: 6px;
  }

  .nodecard-social-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 500;
    padding: 4px 8px;
    border-radius: 6px;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .nodecard-li {
    background: rgba(10, 102, 194, 0.15);
    color: #60a5fa;
    border: 1px solid rgba(10, 102, 194, 0.35);
  }
  .nodecard-li:hover {
    background: rgba(10, 102, 194, 0.25);
    border-color: #60a5fa;
  }

  .nodecard-gh {
    background: rgba(255, 255, 255, 0.07);
    color: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.15);
  }
  .nodecard-gh:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.35);
  }

  /* ── 9. High-Accessibility Action Buttons ────────────────────────────────── */
  .nodecard-actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 4px;
  }

  .nodecard-btn {
    width: 100%;
    min-height: 40px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: all 0.15s ease;
    border: 1px solid transparent;
  }

  .nodecard-btn:focus-visible {
    outline: 2px solid #f5b82e;
    outline-offset: 2px;
  }

  .nodecard-btn-visit {
    background: rgba(232, 116, 42, 0.18);
    border-color: #e8742a;
    color: #ffffff;
  }

  .nodecard-btn-visit:hover {
    background: #e8742a;
    color: #ffffff;
    box-shadow: 0 0 12px rgba(232, 116, 42, 0.4);
  }

  .nodecard-btn-visit.is-visited {
    background: rgba(16, 185, 129, 0.2);
    border-color: #10b981;
    color: #34d399;
  }

  .nodecard-btn-visit.is-visited:hover {
    background: #10b981;
    color: #ffffff;
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.4);
  }

  .nodecard-btn-msg {
    background: rgba(96, 165, 250, 0.15);
    border-color: rgba(96, 165, 250, 0.4);
    color: #93c5fd;
  }

  .nodecard-btn-msg:hover {
    background: rgba(96, 165, 250, 0.3);
    color: #ffffff;
  }

  /* ── 10. Distinct Side Button Ribbon (Matching User's Reference) ────────── */
  .sideBtn-bar {
    position: absolute;
    top: 55px;
    right: -44px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 10001;
  }

  .sideBtn {
    width: 44px;
    height: 30px;
    position: relative;
    background: #2b221d;
    border: 1.5px solid rgba(232, 116, 42, 0.6);
    border-radius: 3px;
    cursor: pointer;
    user-select: none;
    overflow: hidden;
    padding: 0;
    transition: all 0.15s ease;
  }

  /* Triangular flag notch cutting into left of the button */
  .sideBtn:after {
    content: "";
    position: absolute;
    left: 0;
    bottom: 0;
    width: 0;
    height: 0;
    border-left: 14px solid #171311; /* blends with card body background */
    border-top: 15px solid transparent;
    border-bottom: 15px solid transparent;
  }

  .sideBtn:hover {
    background: #e8742a;
    border-color: #f5b82e;
    transform: translateX(3px);
  }

  .sideBtn:active {
    background-color: #b45309;
    transform: translateX(1px);
  }

  .sideBtn.is-visited {
    background: #064e3b;
    border-color: #10b981;
  }
  .sideBtn.is-visited:hover {
    background: #059669;
  }

  .sideBtn span {
    font-weight: 700;
    font-size: 13px;
    color: #ffffff;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(15%, -50%);
    pointer-events: none;
  }

  .sideBtn.is-visited span {
    color: #34d399;
  }

  .sideBtn:focus-visible {
    outline: 2px solid #f5b82e;
    outline-offset: 2px;
  }

  /* ── 11. Mobile Breakpoint Adjustments ───────────────────────────────────── */
  @media (max-width: 440px) {
    .nodecard-wrapper {
      width: 270px;
    }
    .sideBtn-bar {
      right: -38px;
    }
    .sideBtn {
      width: 38px;
      height: 28px;
    }
    .sideBtn:after {
      border-left-width: 11px;
      border-top-width: 14px;
      border-bottom-width: 14px;
    }
  }
</style>

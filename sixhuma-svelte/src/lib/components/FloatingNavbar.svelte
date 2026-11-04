<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { fly } from 'svelte/transition';
  import Logo from './Logo.svelte';
  import ConnectionDot from './ConnectionDot.svelte';
  import { soundService } from '../utils/soundService';
  import { copyToClipboard } from '../utils/clipboard';
  import '../styles/FloatingNavbar.css';

  interface Props {
    variant?: 'landing' | 'join' | 'waiting' | 'meeting' | 'host';
    meetingCode?: string;
    onJoinClick?: () => void;
    onCreateClick?: () => void;
  }

  let {
    variant = 'landing',
    meetingCode,
    onJoinClick,
    onCreateClick,
  }: Props = $props();

  let copied = $state(false);
  let muted = $state(false);
  let isMobile = $state(false);

  $effect(() => {
    muted = soundService.isMuted();
    isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

    const handleResize = () => {
      isMobile = window.innerWidth < 768;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });

  async function handleCopyCode() {
    if (!meetingCode) return;
    const success = await copyToClipboard(meetingCode);
    if (success) {
      copied = true;
      setTimeout(() => (copied = false), 2000);
    }
  }

  function toggleSound() {
    muted = soundService.toggleMute();
  }

  function scrollToSection(id: string) {
    const homePath = base || '/';
    if (page.url.pathname !== homePath && page.url.pathname !== `${homePath}/`) {
      goto(homePath);
      setTimeout(() => {
        const el = document.getElementById(id);
        el?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return;
    }
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: 'smooth' });
  }

  function handleBrandClick() {
    goto(base || '/');
  }

  function handleExit() {
    const isHost =
      variant === 'host' ||
      (meetingCode && localStorage.getItem(`meetmesh_host_${meetingCode.toUpperCase()}`)) ||
      sessionStorage.getItem('meetmesh_is_host') === 'true';

    if (isHost) {
      const confirmed = window.confirm(
        'You are the host of this event. Your host node will remain in the room. Return to home?'
      );
      if (!confirmed) return;
    }
    goto(base || '/');
  }
</script>

<header class="fn-wrapper" in:fly={{ y: -28, duration: 350 }}>
  <nav class="fn-container" aria-label="Main Navigation">
    <!-- Brand -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
    <div class="fn-brand" onclick={handleBrandClick} role="button" tabindex="0">
      <div class="fn-brand-logo">
        <Logo size={isMobile ? 22 : 26} />
      </div>
      <div class="fn-brand-title">
        <span class="fn-wordmark">we-inai</span>
      </div>
    </div>

    <!-- Center navigation -->
    <div class="fn-nav-items">
      {#if variant === 'landing'}
        <button
          type="button"
          class="fn-nav-btn"
          onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          Overview
        </button>
        <button
          type="button"
          class="fn-nav-btn"
          onclick={() => scrollToSection('landing-panel-section')}
        >
          Join / Host
        </button>
        <button
          type="button"
          class="fn-nav-btn"
          onclick={() => scrollToSection('mesh-preview-section')}
        >
          Radar
        </button>
      {:else if meetingCode}
        <div class="fn-room-badge">
          <span>Room:</span>
          <span class="fn-room-code">{meetingCode.toUpperCase()}</span>
          <button
            type="button"
            class="fn-room-copy-btn"
            onclick={handleCopyCode}
            title="Copy Meeting Code"
            aria-label="Copy meeting code"
          >
            {#if copied}
              <span style="font-size: 11px; color: #10b981;">✓ Copied</span>
            {:else}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            {/if}
          </button>
        </div>
      {/if}
    </div>

    <!-- Right actions -->
    <div class="fn-right">
      {#if variant !== 'landing'}
        <button
          type="button"
          class="fn-sound-btn"
          onclick={toggleSound}
          title={muted ? 'Audio muted (click to unmute)' : 'Audio active (click to mute)'}
          aria-label={muted ? 'Audio muted' : 'Audio active'}
        >
          {#if muted}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          {:else}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          {/if}
        </button>

        <div class="fn-status">
          <ConnectionDot />
          {#if !isMobile}
            <span class="fn-status-text">Connected</span>
          {/if}
        </div>
      {/if}

      {#if variant === 'landing'}
        <button
          type="button"
          class="fn-cta-btn"
          onclick={() => {
            if (onJoinClick) {
              onJoinClick();
            } else {
              scrollToSection('landing-panel-section');
            }
          }}
        >
          <span>Enter Code</span>
          <span class="fn-cta-arrow">→</span>
        </button>
      {:else}
        <button type="button" class="fn-ghost-btn" onclick={handleExit}>
          Exit
        </button>
      {/if}
    </div>
  </nav>
</header>

<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { normalizeMeetingCode, isValidMeetingCode } from 'sixhuma-core';
  import { meshClient } from '$lib/core/meshClient.svelte';
  import Logo from '$lib/components/Logo.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import SpringMeshPreview from '$lib/components/SpringMeshPreview.svelte';
  import ShimmerButton from '$lib/components/ShimmerButton.svelte';
  import ConnectionDot from '$lib/components/ConnectionDot.svelte';
  import BackgroundPattern from '$lib/components/BackgroundPattern.svelte';
  import '$lib/styles/MeshVisual.css';
  import '$lib/styles/meetmesh-upgraded.css';

  let tab: 'join' | 'create' = $state('join');
  let eventName = $state('');
  let joinCode = $state('');
  let busy = $state(false);
  let error = $state('');
  let starCount = $state<number | null>(null);

  onMount(() => {
    // Fetch live GitHub star count
    fetch('https://api.github.com/repos/Abez-B/Sixhuma')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.stargazers_count === 'number') {
          starCount = data.stargazers_count;
        }
      })
      .catch(() => {});

    // Initial tab based on query param or default to join
    const codeParam = page.url.searchParams.get('code');
    if (codeParam) {
      tab = 'join';
      joinCode = codeParam.toUpperCase();
    }

    try {
      const cached = localStorage.getItem('meetmesh_host_setup_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.eventName) eventName = parsed.eventName;
      }
    } catch {}

    meshClient.connect().catch((err) => {
      console.error('[LandingPage] Connection check:', err);
    });
  });

  function handleJoin() {
    const normalized = normalizeMeetingCode(joinCode);
    if (!isValidMeetingCode(normalized)) {
      error = 'Invalid meeting code (4 characters, letters and digits)';
      return;
    }
    busy = true;
    error = '';
    goto(`/join/${normalized}`);
  }

  function handleHostSetup() {
    const trimmed = eventName.trim();
    if (trimmed) {
      try {
        const cached = localStorage.getItem('meetmesh_host_setup_cache') || '{}';
        const parsed = JSON.parse(cached);
        parsed.eventName = trimmed;
        localStorage.setItem('meetmesh_host_setup_cache', JSON.stringify(parsed));
      } catch {}
      goto(`/host?event=${encodeURIComponent(trimmed)}`);
    } else {
      goto('/host');
    }
  }
</script>

<svelte:head>
  <title>Sixhuma | Live Event Mesh Directory</title>
</svelte:head>

<div class="mm-root">
  <BackgroundPattern />

  <header class="mm-top-brand">
    <div class="mm-top-brand-inner">
      <a href="/" class="mm-top-brand-left">
        <Logo size={28} />
        <span class="mm-top-brand-name">Sixhuma</span>
      </a>
      <div class="mm-top-brand-right">
        <a
          href="https://github.com/Abez-B/Sixhuma"
          target="_blank"
          rel="noopener noreferrer"
          class="mm-star-badge"
          title="Star Sixhuma on GitHub"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          <span>GitHub</span>
          <span class="mm-star-glyph">★</span>
          {#if starCount !== null}
            <span class="mm-star-count">{starCount}</span>
          {/if}
        </a>
      </div>
    </div>
  </header>

  <div class="mm-page">
    <div class="mm-hero">
      <!-- 1. Left Copy Section -->
      <section class="mm-copy">
        <div class="mm-eyebrow">
          <div class="mm-eyebrow-dot"></div>
          Live event directory
        </div>

        <h1 class="mm-title">
          Connect with everyone <em>in the room.</em>
        </h1>

        <p class="mm-subtitle">
          Sixhuma gives your event an interactive participant directory. Attendees enter a 4-letter
          code or scan a QR to view profiles, roles, and contacts in real time.
        </p>

        <div class="mm-meta-row">
          <ConnectionDot />
          <span class="mm-status-pill">Live directory active</span>
        </div>

        <div class="mm-proof-grid mm-desktop-proof">
          {#each [['No app', 'Works in any browser'], ['~2 seconds', 'Code or QR entry'], ['Real time', 'Profiles, roles & chat']] as [val, lbl]}
            <div class="mm-proof-card">
              <span class="mm-proof-val">{val}</span>
              <span class="mm-proof-lbl">{lbl}</span>
            </div>
          {/each}
        </div>

        <p class="mm-hint mm-desktop-proof">
          Built for meetups, founder dinners, conferences, and demo days.
        </p>
      </section>

      <!-- 2. Right Column: Info entry box on top + Interactive Attendee Radar at the bottom -->
      <div class="mm-hero-right">
        <!-- Info Entry Box (Enter or Host a Room) -->
        <div class="mm-panel" id="landing-panel-section">
          <div class="mm-panel-card">
            <div class="mm-panel-top">
              <div>
                <p class="mm-panel-title">Enter or Host a Room</p>
                <p class="mm-panel-desc">Join an active event or create a new room for attendees.</p>
              </div>
              <span class="mm-instant-badge">No app needed</span>
            </div>

            <div class="mm-tabs">
              <button
                class={`mm-tab ${tab === 'join' ? 'active' : ''}`}
                onclick={() => {
                  tab = 'join';
                  error = '';
                }}
              >
                Join Room
              </button>
              <button
                class={`mm-tab ${tab === 'create' ? 'active' : ''}`}
                onclick={() => {
                  tab = 'create';
                  error = '';
                }}
              >
                Host Room
              </button>
            </div>

            <div class="mm-tab-body">
              {#if tab === 'join'}
                <div class="mm-tab-content">
                  <div class="mm-field">
                    <label class="mm-label" for="join-input-code">Meeting code</label>
                    <input
                      id="join-input-code"
                      class="mm-input-upgraded mm-input-code"
                      placeholder="A3B7"
                      bind:value={joinCode}
                      oninput={(e) => {
                        joinCode = e.currentTarget.value.toUpperCase();
                        error = '';
                      }}
                      maxlength={4}
                      inputmode="text"
                      autocapitalize="characters"
                      autocorrect="off"
                      spellcheck={false}
                      onkeydown={(e) => e.key === 'Enter' && handleJoin()}
                    />
                  </div>

                  <div class="z-10 flex items-center justify-center w-full mt-2.5">
                    <ShimmerButton
                      onclick={handleJoin}
                      disabled={!joinCode || joinCode.length < 4 || busy}
                      class="shadow-2xl w-full"
                    >
                      <span
                        class="whitespace-pre-wrap text-center text-sm font-semibold leading-none tracking-tight text-white lg:text-base flex items-center justify-center gap-1.5"
                      >
                        <span>{busy ? 'Joining...' : 'Enter Room'}</span>
                        <span class="text-base">→</span>
                      </span>
                    </ShimmerButton>
                  </div>

                  <p class="mm-form-note">
                    Enter the 4-letter code or scan the room QR code to join immediately.
                  </p>
                </div>
              {:else}
                <div class="mm-tab-content">
                  <div class="mm-field">
                    <label class="mm-label" for="event-name-input">Event name</label>
                    <input
                      id="event-name-input"
                      class="mm-input-upgraded"
                      placeholder="e.g. Y Combinator Demo Day"
                      bind:value={eventName}
                      oninput={() => (error = '')}
                      onkeydown={(e) => e.key === 'Enter' && handleHostSetup()}
                    />
                  </div>

                  <div class="z-10 flex items-center justify-center w-full mt-2.5">
                    <ShimmerButton
                      id="create-meeting-btn"
                      onclick={handleHostSetup}
                      class="shadow-2xl w-full"
                    >
                      <span
                        class="whitespace-pre-wrap text-center text-sm font-semibold leading-none tracking-tight text-white lg:text-base flex items-center justify-center gap-1.5"
                      >
                        <span>Host a Room</span>
                        <span class="text-base">→</span>
                      </span>
                    </ShimmerButton>
                  </div>

                  <p class="mm-form-note">
                    Set up your host badge, attendee radar, and live stage QR code in the next step.
                  </p>
                </div>
              {/if}

              {#if error}
                <div class="mm-error">
                  {error}
                </div>
              {/if}
            </div>

            <div class="mm-bottom-strip">
              <span class="mm-strip-tag">Instant QR Code</span>
              <span class="mm-strip-tag">vCard (.vcf) Export</span>
              <span class="mm-strip-tag">Real-Time Chat</span>
            </div>
          </div>
        </div>

        <!-- Interactive attendee radar shown separately, always visible -->
        <div class="mm-visual" id="mesh-preview-section">
          <div class="mm-visual-card">
            <div class="mm-visual-header">
              <span>Interactive attendee radar</span>
              <span class="mm-visual-badge">
                <span class="mm-visual-live-dot"></span>
                Live Preview
              </span>
            </div>

            <div class="mm-solar" style="position: relative;">
              <SpringMeshPreview />
            </div>

            <div class="mm-legend">
              <span class="mm-legend-item">
                <i
                  class="mm-legend-dot"
                  style="background: #f59e0b; box-shadow: 0 0 6px rgba(245,158,11,0.4);"
                ></i>
                Host
              </span>
              <span class="mm-legend-item">
                <i class="mm-legend-dot" style="background: #3b82f6;"></i>
                Speaker
              </span>
              <span class="mm-legend-item">
                <i class="mm-legend-dot" style="background: #8b5cf6;"></i>
                Organizer
              </span>
              <span class="mm-legend-item">
                <i class="mm-legend-dot" style="background: #10b981;"></i>
                Attendee
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <Footer />
</div>

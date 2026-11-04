<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { v4 as uuid } from 'uuid';
  import { meshClient } from '$lib/core/meshClient.svelte';
  import MeshGraph from '$lib/components/MeshGraph.svelte';
  import SkeletonPage from '$lib/components/SkeletonPage.svelte';
  import TooltipButton from '$lib/components/TooltipButton.svelte';
  import Logo from '$lib/components/Logo.svelte';
  import QRCode from '$lib/components/QRCode.svelte';
  import { copyToClipboard } from '$lib/utils/clipboard';
  import '$lib/styles/meetmesh-upgraded.css';

  const EMPTY_SET = new Set<string>();

  let pathCode = $derived(page.params.code?.toUpperCase() ?? '');
  let error = $state<string | null>(null);
  let isAttempting = $state(false);
  let copied = $state(false);
  let isFullscreen = $state(false);

  let room = $derived(meshClient.state.room);
  let phase = $derived(meshClient.state.phase);
  let connectionStatus = $derived(meshClient.connectionStatus);

  async function handleCopyLink() {
    if (!joinUrl) return;
    const success = await copyToClipboard(joinUrl);
    if (success) {
      copied = true;
      setTimeout(() => (copied = false), 2000);
    }
  }

  function toggleFullscreen() {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        isFullscreen = true;
      }).catch((err) => {
        console.warn('Fullscreen request rejected:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        isFullscreen = false;
      }).catch((err) => {
        console.warn('Exit fullscreen rejected:', err);
      });
    }
  }

  let participants = $derived(
    room
      ? Object.values(room.participants).filter(
          (p) =>
            !p.peerId.startsWith('present-') &&
            (p.role as string) !== 'Presentation' &&
            !p.displayName?.toLowerCase().includes('presentation')
        )
      : []
  );

  async function join() {
    if (!pathCode || isAttempting) return;

    try {
      error = null;
      isAttempting = true;
      if (meshClient.connectionStatus !== 'connected') {
        await meshClient.connect();
      }
      const peerId = 'present-' + uuid().split('-')[0];
      await meshClient.joinMeeting(pathCode, 'Presentation View', peerId);
    } catch (err: any) {
      error = err?.message || 'Failed to join meeting. Please check the code.';
    } finally {
      isAttempting = false;
    }
  }

  onMount(() => {
    meshClient
      .connect()
      .then(() => join())
      .catch((err) => {
        error = `Connection failed: ${err?.message || 'Is the server running?'}`;
      });

    const handleError = (payload: { code: string; detail: string }) => {
      if (payload.code === 'NOT_FOUND') {
        error = `Meeting "${pathCode}" not found.`;
      } else {
        error = payload.detail || 'An unexpected error occurred.';
      }
    };

    const handleFsChange = () => {
      isFullscreen = Boolean(typeof document !== 'undefined' && document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);

    meshClient.on('Error', handleError);
    return () => {
      meshClient.off('Error', handleError);
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  });

  $effect(() => {
    if (
      pathCode &&
      (!room || room.meetingCode !== pathCode) &&
      !isAttempting &&
      connectionStatus === 'connected'
    ) {
      const timer = setTimeout(() => {
        join();
      }, 300);
      return () => clearTimeout(timer);
    }
  });

  let joinUrl = $derived(
    typeof window !== 'undefined' ? `${window.location.origin}${base}/join/${pathCode}` : ''
  );
  let displayUrl = $derived(
    typeof window !== 'undefined' ? `${window.location.host}${base}/join/${pathCode}` : ''
  );
</script>

<svelte:head>
  <title>Presentation | {room?.eventName ?? pathCode}</title>
</svelte:head>

{#if phase === 'ended'}
  <div
    class="pp-root"
    style="align-items: center; justify-content: center; text-align: center; min-height: 100vh;"
  >
    <div>
      <div style="margin-bottom: 24px; display: flex; justify-content: center;">
        <Logo size={48} />
      </div>
      <h2 style="font-size: 2rem; font-weight: 800; color: #f5f5f5; margin-bottom: 12px;">
        Meeting Ended
      </h2>
      <p style="color: #888; margin-bottom: 32px;">This presentation session has concluded.</p>
      <TooltipButton text="Back to Home" onclick={() => goto(base || '/')} variant="primary" />
    </div>
  </div>
{:else if error}
  <div
    class="pp-root"
    style="align-items: center; justify-content: center; text-align: center; min-height: 100vh;"
  >
    <div style="padding: 24px;">
      <div style="font-size: 4rem; margin-bottom: 20px;">⚠️</div>
      <h2 style="font-size: 2rem; font-weight: 800; color: #ff4d4d; margin-bottom: 12px;">
        Presentation Error
      </h2>
      <p style="color: #888; margin-bottom: 32px; max-width: 400px;">{error}</p>
      <div style="display: flex; gap: 16px; justify-content: center;">
        <TooltipButton text="Retry Connection" onclick={join} variant="success" />
        <TooltipButton text="Go Home" onclick={() => goto(base || '/')} />
      </div>
    </div>
  </div>
{:else if phase === 'waiting'}
  <div
    class="pp-root"
    style="align-items: center; justify-content: center; min-height: 100vh;"
  >
    <div style="text-align: center; padding: 40px 24px;">
      <div style="margin-bottom: 32px; display: flex; justify-content: center;">
        <div class="pp-rings-large">
          <div class="pp-ring-large"></div>
          <div class="pp-ring-large"></div>
          <div class="pp-ring-large"></div>
          <div style="font-size: 4rem; position: relative; z-index: 2;">📺</div>
        </div>
      </div>
      <h2
        style="color: #f5f5f5; margin-bottom: 16px; fontSize: 1.8rem; font-weight: 800; letter-spacing: -0.02em;"
      >
        Screen Linked Successfully
      </h2>
      <p
        style="max-width: 480px; margin: 0 auto 32px; color: #888; font-size: 0.95rem; line-height: 1.6;"
      >
        To begin the presentation, the Host must <strong style="color: #d4d4d4;">Admit</strong> the
        "Presentation View" from their dashboard.
      </p>
      <div class="pp-event-kicker" style="margin: 0;">
        <div class="pp-live-dot"></div>
        Waiting for admission...
      </div>
    </div>
  </div>
{:else if !room || room.meetingCode !== pathCode}
  <SkeletonPage type="presentation" />
{:else}
  <div class="pp-root">
    <div class="pp-left">
      <div>
        <div class="pp-brand">
          <Logo size={28} />
          <span class="pp-brand-name">Sixhuma</span>
        </div>

        <div class="pp-event-kicker">
          <div class="pp-live-dot"></div>
          Live Session
        </div>

        <h1 class="pp-title">{room.eventName}</h1>
        {#if room.subtitle}
          <p class="pp-subtitle">{room.subtitle}</p>
        {/if}

        <div class="pp-count">
          <span class="pp-count-num">{participants.length}</span>
          <div class="pp-count-label">
            Participant{participants.length !== 1 ? 's' : ''} connected
          </div>
        </div>

        <div class="pp-qr-section">
          <span class="pp-qr-label">Scan to join event</span>
          <div class="pp-qr-card">
            <div class="pp-qr-box">
              <QRCode
                value={joinUrl}
                size={260}
                bgColor="#ffffff"
                fgColor="#000000"
                level="M"
                margin={1}
              />
            </div>
            <div class="pp-qr-info">
              <span class="pp-code">{pathCode}</span>
              <div class="pp-join-link">{displayUrl}</div>
              {#if room.description}
                <p class="pp-description">{room.description}</p>
              {/if}
            </div>
          </div>
        </div>

        <div class="pp-actions-panel">
          <div class="pp-actions-row">
            <button
              type="button"
              class="pp-btn"
              onclick={handleCopyLink}
              title="Copy participant join link"
            >
              {#if copied}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#10b981"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span style="color: #10b981;">Copied!</span>
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
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>Copy Link</span>
              {/if}
            </button>

            <button
              type="button"
              class="pp-btn"
              onclick={toggleFullscreen}
              title="Toggle fullscreen presentation"
            >
              {#if isFullscreen}
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
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                </svg>
                <span>Exit Fullscreen</span>
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
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
                <span>Fullscreen</span>
              {/if}
            </button>
          </div>

          <button
            type="button"
            class="pp-btn pp-btn-subtle"
            onclick={() => goto(`${base}/manage/${pathCode}`)}
            title="Go to Host Dashboard"
          >
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
              <rect x="3" y="3" width="7" height="9" />
              <rect x="14" y="3" width="7" height="5" />
              <rect x="14" y="12" width="7" height="9" />
              <rect x="3" y="16" width="7" height="5" />
            </svg>
            <span>Host Dashboard</span>
          </button>
        </div>
      </div>
    </div>

    <div class="pp-right">
      <div class="pp-stats-strip">
        <div class="pp-stat">
          <span>Peers</span>
          <strong>{participants.length}</strong>
        </div>
      </div>

      <MeshGraph
        {participants}
        visitedNodes={EMPTY_SET}
        hostPeerId={room.hostPeerId}
        disableInteractions={true}
        onNodeClick={() => {}}
      />
    </div>
  </div>
{/if}

<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { scale, fly } from 'svelte/transition';
  import { meshClient } from '$lib/core/meshClient.svelte';
  import WaitingList from '$lib/components/WaitingList.svelte';
  import MeetingCodeCard from '$lib/components/MeetingCodeCard.svelte';
  import ConnectionDot from '$lib/components/ConnectionDot.svelte';
  import Logo from '$lib/components/Logo.svelte';
  import SpaceBackground from '$lib/components/SpaceBackground.svelte';
  import '$lib/styles/meetmesh-upgraded.css';

  let pathCode = $derived(page.params.code?.toUpperCase() ?? '');

  let isKicked = $state(false);

  onMount(() => {
    const upperCode = pathCode.toUpperCase();
    if (
      sessionStorage.getItem(`meetmesh_kicked_${upperCode}`) === 'true' ||
      localStorage.getItem(`meetmesh_kicked_${upperCode}`) === 'true'
    ) {
      isKicked = true;
    }

    const onKicked = () => {
      if (upperCode) {
        localStorage.setItem(`meetmesh_kicked_${upperCode}`, 'true');
        sessionStorage.setItem(`meetmesh_kicked_${upperCode}`, 'true');
      }
      isKicked = true;
      meshClient.disconnect();
    };

    const onError = (payload: { code: string; detail: string }) => {
      if (
        payload.code === 'KICKED' ||
        payload.code === 'REMOVED' ||
        payload.detail?.toLowerCase().includes('removed')
      ) {
        onKicked();
      }
    };

    meshClient.on('Kicked', onKicked);
    meshClient.on('Error', onError);

    return () => {
      meshClient.off('Kicked', onKicked);
      meshClient.off('Error', onError);
    };
  });

  $effect(() => {
    if (isKicked) return;
    const room = meshClient.state.room;
    if (meshClient.state.phase === 'active' && room?.meetingCode) {
      goto(`/meeting/${room.meetingCode}`);
      return;
    }

    if (meshClient.state.phase === 'idle' && meshClient.connectionStatus === 'disconnected') {
      const peerId = sessionStorage.getItem('meetmesh_peer_id');
      const lastName = sessionStorage.getItem('meetmesh_last_name');
      const lastJson = sessionStorage.getItem('meetmesh_last_profile_json') || '{}';
      const isHost = sessionStorage.getItem('meetmesh_is_host') === 'true';

      if (pathCode && peerId && (lastName || isHost)) {
        meshClient
          .connect()
          .then(() =>
            meshClient.joinMeeting(pathCode, lastName || 'Host', peerId, lastJson).catch(console.error)
          )
          .catch(console.error);
      } else if (pathCode) {
        goto(`/join/${pathCode}`);
      }
    }
  });

  let isHost = $derived(
    meshClient.state.room?.hostPeerId === meshClient.state.selfPeerId ||
      sessionStorage.getItem('meetmesh_is_host') === 'true'
  );

  function admit(peerId: string) {
    if (meshClient.state.room) {
      meshClient.admitParticipant(meshClient.state.room.meetingCode, peerId);
    }
  }
</script>

<svelte:head>
  <title>Waiting Room | {pathCode}</title>
</svelte:head>

{#if isKicked}
  <div
    class="wr-root"
    style="display: flex; align-items: center; justify-content: center; text-align: center; padding: 24px; min-height: 100vh;"
  >
    <div
      style="
        max-width: 440px;
        width: 100%;
        background: rgba(18, 19, 26, 0.95);
        border: 1px solid rgba(239, 68, 68, 0.25);
        border-radius: 20px;
        padding: 44px 28px;
        box-shadow: 0 24px 64px rgba(0,0,0,0.8);
      "
    >
      <div
        style="
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          color: #ef4444;
        "
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
      </div>
      <h2
        style="font-size: 1.45rem; font-weight: 700; color: #f8fafc; margin: 0 0 10px; letter-spacing: -0.02em;"
      >
        You have been removed
      </h2>
      <p style="font-size: 0.9rem; color: #94a3b8; line-height: 1.6; margin: 0 0 28px;">
        You have been removed from this room by the host.
      </p>
      <button
        type="button"
        onclick={() => {
          localStorage.removeItem(`meetmesh_kicked_${pathCode}`);
          sessionStorage.removeItem(`meetmesh_kicked_${pathCode}`);
          goto('/');
        }}
        style="
          padding: 11px 26px;
          border-radius: 8px;
          background: #f8fafc;
          color: #0f172a;
          font-weight: 600;
          font-size: 13px;
          border: none;
          cursor: pointer;
        "
      >
        Back to Home
      </button>
    </div>
  </div>
{:else if !isHost}
  <div class="wr-root">
    <header class="jp-top-bar" style="position: absolute; top: 0; left: 0; right: 0;">
      <a href="/" class="jp-back-home">
        <Logo size={22} />
        <span class="jp-back-name">Sixhuma</span>
        <span class="jp-back-arrow">· Room {pathCode}</span>
      </a>
    </header>

    <div class="wr-lobby">
      <SpaceBackground />
      <div class="wr-lobby-card" in:scale={{ duration: 400, start: 0.96 }}>
        <div class="wr-status-tag">
          <div class="wr-pulse"></div>
          Waiting for admission
        </div>

        <div class="wr-rings">
          <div class="wr-ring"></div>
          <div class="wr-ring"></div>
          <div class="wr-ring"></div>
          <div class="wr-lobby-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 22h14" />
              <path d="M5 2h14" />
              <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
              <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
            </svg>
          </div>
        </div>

        <h2 class="wr-lobby-title">You're in the lobby</h2>
        <p class="wr-lobby-sub">The host will let you in shortly. Hang tight.</p>

        <div class="wr-lobby-meta">
          <ConnectionDot />
          <span class="wr-lobby-sep">·</span>
          <span>Connected to host</span>
        </div>
      </div>
    </div>
  </div>
{:else}
  <div class="wr-root">
    <header class="jp-top-bar" style="margin-bottom: 16px;">
      <a href="/" class="jp-back-home">
        <Logo size={22} />
        <span class="jp-back-name">Sixhuma</span>
        <span class="jp-back-arrow">· Room {pathCode}</span>
      </a>
    </header>

    <div class="wr-host" in:fly={{ y: 12, duration: 350 }}>
      <div class="wr-host-head">
        <h2 class="wr-host-title">{meshClient.state.room?.eventName ?? 'Waiting Room'}</h2>
        <div class="wr-nav-dot-wrap">
          <div class="wr-pulse"></div>
          <span style="font-size: 11px;">Live</span>
        </div>
      </div>

      {#if meshClient.state.room}
        <div class="wr-code-card">
          <div class="wr-code-block">
            <span class="wr-code-label">Meeting code</span>
            <div class="wr-code-value">{meshClient.state.room.meetingCode}</div>
            <div class="wr-share-link">meetmesh.app/join/{meshClient.state.room.meetingCode}</div>
          </div>
          <div class="wr-qr-placeholder">▦</div>
        </div>
      {/if}

      <div class="wr-waiting-card">
        <div class="wr-waiting-head">
          <span class="wr-waiting-title">Waiting Room</span>
          <span class="wr-waiting-count">{meshClient.state.waitingRoom.length} pending</span>
        </div>

        <WaitingList waitingPeers={meshClient.state.waitingRoom} onAdmit={admit} />

        {#if meshClient.state.waitingRoom.length === 0}
          <div class="wr-empty">
            No one is waiting yet. Share the code above to invite attendees.
          </div>
        {/if}
      </div>

      {#if meshClient.state.room}
        <div style="margin-top: 16px;">
          <MeetingCodeCard
            code={meshClient.state.room.meetingCode}
            eventName={meshClient.state.room.eventName}
          />
        </div>
      {/if}
    </div>
  </div>
{/if}

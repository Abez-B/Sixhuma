<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { v4 as uuid } from 'uuid';
  import { parseProfile, type Participant } from 'sixhuma-core';
  import { meshClient } from '$lib/core/meshClient.svelte';
  import { toast } from '$lib/core/toast.svelte';
  import { copyToClipboard } from '$lib/utils/clipboard';
  import { chatStore } from '$lib/core/chatStore.svelte';
  import Logo from '$lib/components/Logo.svelte';
  import ConnectionDot from '$lib/components/ConnectionDot.svelte';
  import MeshGraph from '$lib/components/MeshGraph.svelte';
  import SkeletonPage from '$lib/components/SkeletonPage.svelte';
  import WaitingList from '$lib/components/WaitingList.svelte';
  import ParticipantGrid from '$lib/components/ParticipantGrid.svelte';
  import ChatPanel from '$lib/components/ChatPanel.svelte';
  import NodeInfoCard from '$lib/components/NodeInfoCard.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import QRCode from '$lib/components/QRCode.svelte';
  import ReactionLayer from '$lib/components/ReactionLayer.svelte';
  import '$lib/styles/meetmesh-upgraded.css';
  import '$lib/styles/chat.css';

  let pathCode = $derived(page.params.code?.toUpperCase() ?? '');

  let visitedNodes = $state(new Set<string>());
  let selectedNodeId = $state<string | null>(null);
  let selectedNodePos = $state<{ x: number; y: number } | null>(null);
  let searchInput = $state('');
  let searchTerm = $state('');
  let showCloseConfirm = $state(false);
  let showBroadcastModal = $state(false);
  let broadcastText = $state('');
  let broadcasting = $state(false);
  let showChat = $state(false);
  let chatDmPeerId = $state<string | null>(null);
  let isMobile = $state(false);
  let linkCopied = $state(false);
  let activeMobileTab = $state<'controls' | 'radar'>('controls');

  // Elapsed time tracker
  let elapsed = $state('00m 00s');

  onMount(() => {
    isMobile = window.innerWidth <= 900;
    const checkMobile = () => {
      isMobile = window.innerWidth <= 900;
    };
    window.addEventListener('resize', checkMobile);

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'You are the host of this event. Are you sure you want to leave?';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    // Tab visibility recovery
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && pathCode) {
        meshClient.heartbeat(pathCode).catch(() => {
          meshClient.connect().catch(console.error);
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  });

  // Reconnection effect
  $effect(() => {
    if (!pathCode || (meshClient.state.room && meshClient.state.phase !== 'idle')) return;

    let cancelled = false;

    const reconnect = async () => {
      try {
        await meshClient.connect();
        if (cancelled) return;

        const hostPeerForRoom = localStorage.getItem(`meetmesh_host_${pathCode}`);
        const peerId =
          hostPeerForRoom ||
          sessionStorage.getItem('meetmesh_peer_id') ||
          localStorage.getItem('meetmesh_peer_id') ||
          uuid();
        const lastName =
          sessionStorage.getItem('meetmesh_last_name') ||
          localStorage.getItem('meetmesh_last_name') ||
          'Host';
        const lastJson =
          sessionStorage.getItem('meetmesh_last_profile_json') ||
          localStorage.getItem('meetmesh_last_profile_json') ||
          '{}';

        const hostSecret =
          sessionStorage.getItem(`meetmesh_secret_${pathCode}`) ||
          localStorage.getItem(`meetmesh_secret_${pathCode}`) ||
          undefined;

        sessionStorage.setItem('meetmesh_peer_id', peerId);
        localStorage.setItem('meetmesh_peer_id', peerId);
        localStorage.setItem(`meetmesh_host_${pathCode}`, peerId);
        localStorage.setItem(`meetmesh_peer_${pathCode}`, peerId);
        sessionStorage.setItem('meetmesh_is_host', 'true');
        sessionStorage.setItem('meetmesh_last_name', lastName);
        localStorage.setItem('meetmesh_last_name', lastName);
        localStorage.setItem(`meetmesh_name_${pathCode}`, lastName);
        sessionStorage.setItem('meetmesh_last_profile_json', lastJson);
        localStorage.setItem('meetmesh_last_profile_json', lastJson);
        localStorage.setItem(`meetmesh_profile_${pathCode}`, lastJson);
        if (hostSecret) {
          localStorage.setItem(`meetmesh_secret_${pathCode}`, hostSecret);
          meshClient.setHostSecret(hostSecret);
        }

        await meshClient.joinMeeting(pathCode, lastName, peerId, lastJson, hostSecret);
      } catch (err) {
        console.warn('[HostPanelPage] Reconnect failed:', err);
        if (!cancelled) goto('/');
      }
    };

    reconnect();

    const timeout = setTimeout(() => {
      if (!cancelled && !meshClient.state.room) goto('/');
    }, 12000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  });

  // Elapsed timer ticker
  $effect(() => {
    const startedAt = meshClient.state.room?.startedAt;
    if (!startedAt) return;

    const startTs = new Date(startedAt).getTime();
    const updateElapsed = () => {
      const diffSec = Math.max(0, Math.floor((Date.now() - startTs) / 1000));
      const m = Math.floor(diffSec / 60)
        .toString()
        .padStart(2, '0');
      const s = (diffSec % 60).toString().padStart(2, '0');
      elapsed = `${m}m ${s}s`;
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  });

  // Debounce search
  $effect(() => {
    const timer = setTimeout(() => {
      searchTerm = searchInput;
    }, 200);
    return () => clearTimeout(timer);
  });

  let room = $derived(meshClient.state.room);
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

  let roleCounts = $derived(
    participants.reduce<Record<string, number>>((acc, p) => {
      acc[p.role] = (acc[p.role] || 0) + 1;
      return acc;
    }, {})
  );

  let selfParticipant = $derived(
    meshClient.state.selfPeerId && room ? room.participants[meshClient.state.selfPeerId] : null
  );
  let selfName = $derived(selfParticipant?.displayName ?? 'Host');
  let selfAvatar = $derived(
    selfParticipant ? parseProfile(selfParticipant.json)?.photo : undefined
  );

  let selectedParticipant = $derived(
    selectedNodeId && room ? room.participants[selectedNodeId] : null
  );

  let hasUnreadDms = $derived(
    meshClient.state.selfPeerId
      ? chatStore.unreadDms.some((key) => key.split('|').includes(meshClient.state.selfPeerId!))
      : false
  );
  let hasUnread = $derived(chatStore.unreadGlobalCount > 0 || hasUnreadDms);

  const ROLE_COLORS: Record<string, string> = {
    Host: '#FFD700',
    Organizer: '#A78BFA',
    Speaker: '#60A5FA',
    Attendee: '#2DD4BF',
  };

  let joinUrl = $derived(
    typeof window !== 'undefined' ? `${window.location.origin}/join/${pathCode}` : ''
  );

  function admit(peerId: string) {
    meshClient.admitParticipant(pathCode, peerId);
  }

  function kick(peerId: string) {
    meshClient.kickParticipant(pathCode, peerId);
  }

  function changeRole(peerId: string, role: string) {
    meshClient.changeRole(pathCode, peerId, role);
  }

  async function confirmClose() {
    try {
      await meshClient.closeMeeting(pathCode);
      toast.success('Meeting ended');
    } catch (err) {
      console.error('Failed to end meeting:', err);
    } finally {
      showCloseConfirm = false;
      goto('/');
    }
  }

  async function handleCopyLink() {
    const success = await copyToClipboard(joinUrl);
    if (success) {
      linkCopied = true;
      setTimeout(() => (linkCopied = false), 2000);
      toast.success('Join link copied');
    }
  }

  async function handleBroadcast() {
    if (!broadcastText.trim() || !pathCode) return;
    broadcasting = true;
    try {
      await meshClient.sendAnnouncement(pathCode, broadcastText.trim(), selfName);
      toast.success('Announcement broadcasted!');
      broadcastText = '';
      showBroadcastModal = false;
    } catch (e) {
      console.error(e);
      toast.error('Failed to send announcement');
    } finally {
      broadcasting = false;
    }
  }
</script>

<svelte:head>
  <title>Host Dashboard | {room?.eventName ?? pathCode}</title>
</svelte:head>

{#if !room}
  <SkeletonPage type="hostPanel" />
{:else}
  <div class="hp-root">
    <!-- Topbar -->
    <div class="hp-topbar">
      <div class="hp-topbar-left">
        <div class="hp-brand">
          <Logo size={24} />
          <span class="hp-title">
            Host Dashboard
            <span class="hp-title-sep"> · </span>
            <span class="hp-title-role">{room.eventName}</span>
          </span>
        </div>
        <div class="hp-meta">
          <div class="hp-meta-item">
            <ConnectionDot />
            <span>Live</span>
          </div>
          <span class="hp-elapsed">{elapsed}</span>
          <span style="font-size: 11px; color: #555;"
            >{participants.length} participant{participants.length !== 1 ? 's' : ''}</span
          >
        </div>
      </div>
      <div class="hp-topbar-actions">
        <button
          class={`hp-btn-secondary hp-chat-btn ${showChat ? 'hp-btn-active' : ''}`}
          onclick={() => {
            showChat = !showChat;
            if (showChat) chatDmPeerId = null;
          }}
          style="position: relative; display: inline-flex; align-items: center; gap: 6px;"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Chat
          {#if hasUnread}
            <span class="hp-chat-unread-dot"></span>
          {/if}
        </button>
        <button
          class="hp-btn-secondary"
          onclick={() => window.open(`/present/${pathCode}`, '_blank')}
          title="Open big screen stage / presentation view"
        >
          Stage View
        </button>
        <button
          class="hp-btn-secondary"
          onclick={() => window.open(`/meeting/${pathCode}`, '_blank')}
          title="Open participant room view"
        >
          Room View
        </button>
        <button class="hp-btn-danger" onclick={() => (showCloseConfirm = true)}>
          {isMobile ? 'End' : 'End Event'}
        </button>
      </div>
    </div>

    <!-- Mobile view switch tabs (visible only on mobile/narrow screens) -->
    <div class="hp-mobile-view-tabs" role="tablist" aria-label="Dashboard Views">
      <button
        type="button"
        role="tab"
        aria-selected={activeMobileTab === 'controls'}
        class="hp-m-tab {activeMobileTab === 'controls' ? 'active' : ''}"
        onclick={() => (activeMobileTab = 'controls')}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span>Room & Lobby</span>
        <span class="hp-tab-count">
          {meshClient.state.waitingRoom.length > 0
            ? `+${meshClient.state.waitingRoom.length}`
            : participants.length}
        </span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeMobileTab === 'radar'}
        class="hp-m-tab {activeMobileTab === 'radar' ? 'active' : ''}"
        onclick={() => (activeMobileTab = 'radar')}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a10 10 0 0 1 10 10" />
          <path d="m12 12 7-7" />
        </svg>
        <span>Live Radar</span>
      </button>
    </div>

    <div class="hp-grid" style="margin-right: {showChat && !isMobile ? '320px' : '0'};">
      <aside class="hp-sidebar {isMobile && activeMobileTab !== 'controls' ? 'hp-hidden-mobile' : ''}">
        <!-- Meeting Code Card with QR -->
        <div class="hp-code-card">
          <div class="hp-code-block">
            <span class="hp-code-label">Meeting code</span>
            <div class="hp-code-value">{pathCode}</div>
            <button class="hp-copy-link-btn" onclick={handleCopyLink} title="Copy join link">
              {#if linkCopied}
                <svg
                  width="12"
                  height="12"
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
                  width="12"
                  height="12"
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
                <span>Copy link</span>
              {/if}
            </button>
          </div>
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="hp-qr"
            style="background: #fff; border-radius: 6px; padding: 5px; cursor: pointer; border: none; display: inline-flex;"
            onclick={() => window.open(joinUrl, '_blank')}
            title="Open join page"
          >
            <QRCode value={joinUrl} size={46} bgColor="#ffffff" fgColor="#000000" level="M" />
          </div>
        </div>

        <!-- Broadcast Announcement Button -->
        <button
          type="button"
          class="hp-broadcast-btn"
          onclick={() => (showBroadcastModal = true)}
          title="Send a prominent announcement to all attendees"
        >
          <svg
            width="15"
            height="15"
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
          <span>Broadcast Announcement</span>
        </button>

        <!-- Waiting Room Section -->
        <div class="hp-section">
          <div class="hp-section-head">
            <span class="hp-section-title"
              >Waiting room ({meshClient.state.waitingRoom.length})</span
            >
            <label class="hp-toggle">
              <input
                type="checkbox"
                checked={room.waitingRoomEnabled}
                onchange={() => meshClient.toggleWaitingRoom(pathCode, !room?.waitingRoomEnabled)}
              />
              <div class="hp-toggle-track">
                <div class="hp-toggle-thumb"></div>
              </div>
            </label>
          </div>
          <WaitingList waitingPeers={meshClient.state.waitingRoom} onAdmit={admit} />
          {#if meshClient.state.waitingRoom.length === 0}
            <div class="hp-empty">Lobby is empty.</div>
          {/if}
        </div>

        <!-- Participants Section -->
        <div class="hp-section">
          <div class="hp-section-head">
            <span class="hp-section-title">Participants ({participants.length})</span>
          </div>
          <div style="margin-bottom: 12px;">
            <input
              type="search"
              placeholder="Search..."
              class="hp-search-input"
              bind:value={searchInput}
            />
          </div>
          <ParticipantGrid
            {room}
            selfPeerId={meshClient.state.selfPeerId}
            {searchTerm}
            onKick={kick}
            onRole={changeRole}
            onSelect={(peerId) => {
              selectedNodeId = peerId;
              selectedNodePos = null;
            }}
          />
        </div>
      </aside>

      <main class="hp-main {isMobile && activeMobileTab !== 'radar' ? 'hp-hidden-mobile' : ''}">
        <div class="hp-mesh-card">
          <div class="hp-mesh-head">
            <span class="hp-section-title">Live Mesh View</span>
            <div class="hp-role-stats">
              {#each ['Host', 'Organizer', 'Speaker', 'Attendee'] as role}
                {#if (roleCounts[role] || 0) > 0}
                  <span class="hp-role-stat" style="color: {ROLE_COLORS[role]};">
                    {roleCounts[role]}&thinsp;{role}{(roleCounts[role] || 0) > 1 && role !== 'Host'
                      ? 's'
                      : ''}
                  </span>
                {/if}
              {/each}
            </div>
          </div>
          <div class="hp-mesh-stage" style="flex: 1; min-height: 0;">
            <MeshGraph
              {participants}
              {visitedNodes}
              hostPeerId={room.hostPeerId}
              {searchTerm}
              onNodeClick={(peerId, pos) => {
                selectedNodeId = peerId;
                if (pos) selectedNodePos = pos;
              }}
            />
          </div>
        </div>
      </main>
    </div>

    <!-- Chat drawer -->
    {#if showChat}
      <ChatPanel
        meetingCode={pathCode}
        selfPeerId={meshClient.state.selfPeerId}
        {selfName}
        {selfAvatar}
        {participants}
        initialDmPeerId={chatDmPeerId}
        onClose={() => {
          showChat = false;
          chatDmPeerId = null;
        }}
      />
    {/if}

    <!-- Node info modal -->
    {#if selectedParticipant}
      <NodeInfoCard
        participant={selectedParticipant}
        visited={visitedNodes.has(selectedParticipant.peerId)}
        position={selectedNodePos}
        onClose={() => {
          selectedNodeId = null;
          selectedNodePos = null;
        }}
        onMarkVisited={() => {
          const newSet = new Set(visitedNodes);
          if (newSet.has(selectedParticipant.peerId)) {
            newSet.delete(selectedParticipant.peerId);
          } else {
            newSet.add(selectedParticipant.peerId);
          }
          visitedNodes = newSet;
        }}
        onMessage={selectedParticipant.peerId !== meshClient.state.selfPeerId
          ? () => {
              chatDmPeerId = selectedParticipant.peerId;
              showChat = true;
              selectedNodeId = null;
              selectedNodePos = null;
            }
          : undefined}
      />
    {/if}

    <!-- Confirm end meeting dialog -->
    <ConfirmDialog
      isOpen={showCloseConfirm}
      title="End Meeting"
      message="Are you sure you want to end this meeting? All participants will be disconnected immediately."
      confirmText="End Meeting"
      cancelText="Cancel"
      variant="danger"
      onConfirm={confirmClose}
      onCancel={() => (showCloseConfirm = false)}
    />

    <!-- Broadcast Announcement Modal -->
    {#if showBroadcastModal}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        style="
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        "
        onclick={() => (showBroadcastModal = false)}
      >
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          style="
            width: 100%;
            max-width: 480px;
            background: #12131a;
            border: 1px solid rgba(245, 158, 11, 0.3);
            border-radius: 14px;
            padding: {isMobile ? '20px 16px' : '24px'};
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.9);
          "
          onclick={(e) => e.stopPropagation()}
        >
          <div style="display: flex; align-items: center; gap: 10px; marginBottom: 12px;">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f59e0b"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M22 8.5c0 2.5-2.5 4.5-5 6.5l-5 3-5-3c-2.5-2-5-4-5-6.5C2 5.5 4.5 3 8 3c1.5 0 2.9.5 4 1.5C13.1 3.5 14.5 3 16 3c3.5 0 6 2.5 6 5.5z"
              />
              <path d="M12 17.5v4" />
              <path d="M8 21.5h8" />
            </svg>
            <h3
              style="margin: 0; font-size: 17px; color: #f8fafc; font-weight: 600; letter-spacing: -0.02em;"
            >
              Broadcast Announcement
            </h3>
          </div>
          <p style="font-size: 13px; color: #94a3b8; margin-bottom: 16px;">
            This alert will instantly pop up on every attendee's phone/screen.
          </p>
          <textarea
            bind:value={broadcastText}
            placeholder="e.g. Pizza is served! or Lightning talks starting in 5 mins on Stage A."
            rows="3"
            style="
              width: 100%;
              padding: 12px;
              border-radius: 8px;
              border: 1px solid rgba(255,255,255,0.15);
              background: rgba(255,255,255,0.05);
              color: #fff;
              font-family: inherit;
              font-size: 14px;
              resize: none;
              margin-bottom: 16px;
            "
          ></textarea>
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button
              type="button"
              onclick={() => (showBroadcastModal = false)}
              style="
                padding: 8px 16px;
                border-radius: 6px;
                border: 1px solid rgba(255,255,255,0.15);
                background: transparent;
                color: #94a3b8;
                cursor: pointer;
              "
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!broadcastText.trim() || broadcasting}
              onclick={handleBroadcast}
              style="
                padding: 8px 18px;
                border-radius: 6px;
                border: none;
                background: #f59e0b;
                color: #000;
                font-weight: 600;
                cursor: {broadcastText.trim() ? 'pointer' : 'not-allowed'};
                opacity: {broadcastText.trim() ? 1 : 0.5};
              "
            >
              {broadcasting ? 'Sending...' : 'Send to All'}
            </button>
          </div>
        </div>
      </div>
    {/if}

    <ReactionLayer
      selfPeerId={meshClient.state.selfPeerId}
      {selfName}
      {selfAvatar}
      {participants}
      onFire={(emoji) => {
        if (pathCode) {
          meshClient.sendReaction(pathCode, emoji);
        }
      }}
    />
  </div>
{/if}

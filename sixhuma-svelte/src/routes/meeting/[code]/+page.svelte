<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { fly, fade } from 'svelte/transition';
  import { parseProfile, type Participant } from 'sixhuma-core';
  import { meshClient } from '$lib/core/meshClient.svelte';
  import { chatStore } from '$lib/core/chatStore.svelte';
  import Logo from '$lib/components/Logo.svelte';
  import ConnectionDot from '$lib/components/ConnectionDot.svelte';
  import MeshGraph from '$lib/components/MeshGraph.svelte';
  import SkeletonPage from '$lib/components/SkeletonPage.svelte';
  import ChatPanel from '$lib/components/ChatPanel.svelte';
  import ParticipantGrid from '$lib/components/ParticipantGrid.svelte';
  import NodeInfoCard from '$lib/components/NodeInfoCard.svelte';
  import ReactionLayer from '$lib/components/ReactionLayer.svelte';
  import { exportContactsAsVCard, exportContactsAsCSV } from '$lib/utils/contactExport';
  import '$lib/styles/meetmesh-upgraded.css';
  import '$lib/styles/chat.css';

  let pathCode = $derived(page.params.code?.toUpperCase() ?? '');

  let visitedNodes = $state(new Set<string>());
  let selectedNodeId = $state<string | null>(null);
  let selectedNodePos = $state<{ x: number; y: number } | null>(null);
  let searchTerm = $state('');
  let showSidebar = $state(false);
  let showChat = $state(false);
  let dmPeerId = $state<string | null>(null);
  let activeAnnouncement = $state<{ id: string; message: string; hostName: string } | null>(null);
  let isMobile = $state(false);
  let isKicked = $state(false);

  onMount(() => {
    isMobile = window.innerWidth < 768;
    const checkMobile = () => {
      isMobile = window.innerWidth < 768;
    };
    window.addEventListener('resize', checkMobile);

    const upperCode = pathCode;
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

    const onAnnouncement = (payload: { id: string; message: string; hostName: string }) => {
      activeAnnouncement = payload;
    };

    meshClient.on('Kicked', onKicked);
    meshClient.on('Error', onError);
    meshClient.on('AnnouncementReceived', onAnnouncement);

    // Visibility change heartbeat
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const code = meshClient.state.room?.meetingCode || pathCode;
        if (code) {
          meshClient.heartbeat(code).catch(() => {
            meshClient.connect().catch(console.error);
          });
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('resize', checkMobile);
      document.removeEventListener('visibilitychange', handleVisibility);
      meshClient.off('Kicked', onKicked);
      meshClient.off('Error', onError);
      meshClient.off('AnnouncementReceived', onAnnouncement);
    };
  });

  // Reconnection and phase transitions
  $effect(() => {
    if (isKicked) return;
    if (meshClient.state.phase === 'ended') {
      goto('/');
      return;
    }

    if (!meshClient.state.room || meshClient.state.phase === 'idle') {
      if (!pathCode) return;

      const isHost =
        sessionStorage.getItem('meetmesh_is_host') === 'true' ||
        Boolean(localStorage.getItem(`meetmesh_host_${pathCode}`));
      const hostPeerForRoom = localStorage.getItem(`meetmesh_host_${pathCode}`);
      const peerId =
        sessionStorage.getItem('meetmesh_peer_id') ||
        (isHost ? hostPeerForRoom : null) ||
        localStorage.getItem(`meetmesh_peer_${pathCode}`) ||
        localStorage.getItem('meetmesh_peer_id');
      const lastName =
        sessionStorage.getItem('meetmesh_last_name') ||
        localStorage.getItem(`meetmesh_name_${pathCode}`) ||
        localStorage.getItem('meetmesh_last_name') ||
        (isHost ? 'Host' : '');
      const lastJson =
        sessionStorage.getItem('meetmesh_last_profile_json') ||
        localStorage.getItem(`meetmesh_profile_${pathCode}`) ||
        localStorage.getItem('meetmesh_last_profile_json') ||
        '{}';

      const hostSecret = isHost
        ? (sessionStorage.getItem(`meetmesh_secret_${pathCode}`) || localStorage.getItem(`meetmesh_secret_${pathCode}`) || undefined)
        : undefined;

      if (peerId && (lastName || isHost)) {
        sessionStorage.setItem('meetmesh_peer_id', peerId);
        if (isHost) sessionStorage.setItem('meetmesh_is_host', 'true');
        if (hostSecret) meshClient.setHostSecret(hostSecret);

        meshClient
          .connect()
          .then(() => meshClient.joinMeeting(pathCode, lastName || 'Host', peerId, lastJson, hostSecret))
          .catch((err) => {
            console.warn('[MeetingRoomPage] Reconnect failed:', err);
            goto(`/join/${pathCode}`);
          });
      } else {
        goto(`/join/${pathCode}`);
      }
    }
  });

  let room = $derived(meshClient.state.room);
  let isHost = $derived(
    room?.hostPeerId === meshClient.state.selfPeerId ||
      sessionStorage.getItem('meetmesh_is_host') === 'true'
  );

  let participantsList = $derived(
    room
      ? Object.values(room.participants).filter(
          (p) =>
            !p.peerId.startsWith('present-') &&
            (p.role as string) !== 'Presentation' &&
            !p.displayName?.toLowerCase().includes('presentation')
        )
      : []
  );

  let count = $derived(participantsList.length);
  let code = $derived(room?.meetingCode || pathCode);

  let selfParticipant = $derived(
    meshClient.state.selfPeerId && room ? room.participants[meshClient.state.selfPeerId] : null
  );
  let selfName = $derived(selfParticipant?.displayName ?? 'You');
  let selfAvatar = $derived(
    selfParticipant ? parseProfile(selfParticipant.json)?.photo : undefined
  );

  let selectedParticipant = $derived(
    selectedNodeId && room ? room.participants[selectedNodeId] : null
  );

  let hasUnread = $derived(
    chatStore.unreadGlobalCount > 0 ||
      (meshClient.state.selfPeerId
        ? chatStore.unreadDms.some((key) => key.split('|').includes(meshClient.state.selfPeerId!))
        : false)
  );

  function handleNodeClick(peerId: string, pos?: { x: number; y: number }) {
    selectedNodeId = peerId;
    if (pos) selectedNodePos = pos;
  }

  function handleMarkVisited() {
    if (!selectedParticipant) return;
    const newSet = new Set(visitedNodes);
    if (newSet.has(selectedParticipant.peerId)) {
      newSet.delete(selectedParticipant.peerId);
    } else {
      newSet.add(selectedParticipant.peerId);
    }
    visitedNodes = newSet;
  }

  function handleMessage() {
    if (!selectedParticipant || selectedParticipant.peerId === meshClient.state.selfPeerId) return;
    dmPeerId = selectedParticipant.peerId;
    showChat = true;
    selectedNodeId = null;
    selectedNodePos = null;
  }

  function handleLeave() {
    meshClient.disconnect();
    goto('/');
  }
</script>

<svelte:head>
  <title>{room?.eventName ?? 'Meeting Room'} | Sixhuma</title>
</svelte:head>

{#if isKicked}
  <div
    class="mr-root"
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
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          color: #ef4444;
          font-size: 26px;
        "
      >
        🚫
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
{:else if !room}
  <SkeletonPage type="meetingRoom" />
{:else}
  <div class="mr-root">
    {#if activeAnnouncement}
      <div
        in:fly={{ y: -60, duration: 300 }}
        out:fly={{ y: -60, duration: 300 }}
        style="
          position: fixed;
          top: {isMobile ? 'calc(62px + var(--safe-area-inset-top, 0px))' : '72px'};
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          width: min(92%, 580px);
          background: rgba(15, 17, 26, 0.92);
          border: 1px solid rgba(245, 158, 11, 0.5);
          box-shadow: 0 12px 36px rgba(0,0,0,0.85), 0 0 24px rgba(245, 158, 11, 0.25);
          borderRadius: 14px;
          padding: {isMobile ? '10px 14px' : '12px 18px'};
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        "
      >
        <div style="display: flex; align-items: center; gap: 12px;">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#f59e0b"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            style="flex-shrink: 0;"
          >
            <path
              d="M22 8.5c0 2.5-2.5 4.5-5 6.5l-5 3-5-3c-2.5-2-5-4-5-6.5C2 5.5 4.5 3 8 3c1.5 0 2.9.5 4 1.5C13.1 3.5 14.5 3 16 3c3.5 0 6 2.5 6 5.5z"
            />
            <path d="M12 17.5v4" />
            <path d="M8 21.5h8" />
          </svg>
          <div>
            <div
              style="font-size: 10.5px; color: #f59e0b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;"
            >
              {activeAnnouncement.hostName} · Announcement
            </div>
            <div style="font-size: 13.5px; color: #f8fafc; font-weight: 500; margin-top: 2px;">
              {activeAnnouncement.message}
            </div>
          </div>
        </div>
        <button
          type="button"
          onclick={() => (activeAnnouncement = null)}
          style="
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.1);
            color: #94a3b8;
            font-size: 14px;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 6px;
            line-height: 1;
          "
          title="Dismiss"
        >
          ✕
        </button>
      </div>
    {/if}

    <div class="mr-topbar">
      <div class="mr-topbar-left">
        <Logo size={22} />
        <span class="mr-event-name">{room.eventName}</span>
        <div class="mr-meta">
          <div class="mr-meta-item">
            <ConnectionDot />
            <span>Connected</span>
          </div>
          <span class="mr-code-chip">{code}</span>
          <span style="font-size: 11px; color: #555;">{count} peer{count !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div class="mr-topbar-actions">
        <button
          class={`mr-btn-secondary ${showChat ? 'mr-btn-active' : ''}`}
          onclick={() => (showChat = !showChat)}
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
          {#if hasUnread && !showChat}
            <span class="mr-chat-unread-dot"></span>
          {/if}
        </button>

        <button class="mr-btn-secondary" onclick={() => (showSidebar = !showSidebar)}>
          {showSidebar ? 'Hide List' : 'Show List'}
        </button>

        {#if isHost}
          <button class="mr-btn-secondary" onclick={() => window.open(`/manage/${code}`, '_blank')}>
            Dashboard
          </button>
        {/if}

        <button class="mr-btn-danger" onclick={handleLeave}> Leave </button>
      </div>
    </div>

    <div class="mr-content">
      <div
        class="mr-stage"
        style="margin-right: {isMobile
          ? 0
          : (showSidebar ? 300 : 0) + (showChat ? 320 : 0)}px;"
      >
        <MeshGraph
          participants={participantsList}
          {visitedNodes}
          hostPeerId={room.hostPeerId}
          {searchTerm}
          onNodeClick={handleNodeClick}
        />
      </div>

      {#if showChat}
        <ChatPanel
          meetingCode={code}
          selfPeerId={meshClient.state.selfPeerId}
          {selfName}
          {selfAvatar}
          participants={participantsList}
          initialDmPeerId={dmPeerId}
          onClose={() => {
            showChat = false;
            dmPeerId = null;
          }}
        />
      {/if}

      {#if showSidebar}
        <div
          class="mr-sidebar"
          style="right: {showChat && !isMobile ? 320 : 0}px;"
          in:fly={{ x: 300, duration: 250 }}
          out:fly={{ x: 300, duration: 250 }}
        >
          <div class="mr-sidebar-head">
            <span class="mr-sidebar-title">Participants ({count})</span>
            <button class="mr-sidebar-close" onclick={() => (showSidebar = false)}>✕</button>
          </div>
          <div class="mr-search">
            <input
              type="search"
              placeholder="Search nodes..."
              bind:value={searchTerm}
              class="mr-search-input"
            />
          </div>
          <div class="mr-participant-list">
            <ParticipantGrid
              {room}
              selfPeerId={meshClient.state.selfPeerId}
              {searchTerm}
              onSelect={(peerId) => (selectedNodeId = peerId)}
            />
          </div>
          <div
            style="padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; gap: 8px; background: rgba(255,255,255,0.02);"
          >
            <button
              type="button"
              onclick={() =>
                exportContactsAsVCard(participantsList, visitedNodes, {
                  eventName: room?.eventName,
                })}
              style="
                flex: 1;
                padding: 8px 10px;
                border-radius: 6px;
                border: 1px solid rgba(56, 189, 248, 0.25);
                background: rgba(56, 189, 248, 0.08);
                color: #38bdf8;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
              "
              title="Export vCard to Contacts"
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
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M8 10h.01M12 10h.01M16 10h.01M8 14h8" />
              </svg>
              <span>vCard</span>
            </button>
            <button
              type="button"
              onclick={() =>
                exportContactsAsCSV(participantsList, visitedNodes, { eventName: room?.eventName })}
              style="
                padding: 8px 14px;
                border-radius: 6px;
                border: 1px solid rgba(255,255,255,0.12);
                background: rgba(255,255,255,0.04);
                color: #94a3b8;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
              "
              title="Download CSV spreadsheet"
            >
              CSV
            </button>
          </div>
        </div>
      {/if}
    </div>

    <!-- Floating reactions & reaction bar -->
    <ReactionLayer
      selfPeerId={meshClient.state.selfPeerId}
      {selfName}
      {selfAvatar}
      participants={participantsList}
      onFire={(emoji) => {
        if (room?.meetingCode) {
          meshClient.sendReaction(room.meetingCode, emoji);
        }
      }}
    />

    <!-- Mobile bottom nav -->
    <div class="mr-mobile-nav">
      <button
        class={`mr-mobile-nav-btn ${showChat ? 'active' : ''}`}
        onclick={() => (showChat = !showChat)}
        aria-label="Chat"
        style="position: relative;"
      >
        <span class="mr-mobile-nav-icon">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </span>
        <span class="mr-mobile-nav-label">Chat</span>
        {#if hasUnread && !showChat}
          <span class="mr-chat-unread-dot"></span>
        {/if}
      </button>

      <button
        class={`mr-mobile-nav-btn ${showSidebar ? 'active' : ''}`}
        onclick={() => (showSidebar = !showSidebar)}
        aria-label="Participants"
      >
        <span class="mr-mobile-nav-icon">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </span>
        <span class="mr-mobile-nav-label">People</span>
      </button>

      <button
        class="mr-mobile-nav-btn mr-mobile-nav-btn--danger"
        onclick={handleLeave}
        aria-label="Leave"
      >
        <span class="mr-mobile-nav-icon">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </span>
        <span class="mr-mobile-nav-label">Leave</span>
      </button>
    </div>

    <!-- Node info modal / card -->
    {#if selectedParticipant}
      <NodeInfoCard
        participant={selectedParticipant}
        visited={visitedNodes.has(selectedParticipant.peerId)}
        position={selectedNodePos}
        onClose={() => {
          selectedNodeId = null;
          selectedNodePos = null;
        }}
        onMarkVisited={handleMarkVisited}
        onMessage={selectedParticipant.peerId !== meshClient.state.selfPeerId
          ? handleMessage
          : undefined}
      />
    {/if}
  </div>
{/if}

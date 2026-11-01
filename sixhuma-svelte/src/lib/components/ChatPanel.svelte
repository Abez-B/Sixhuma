<script lang="ts">
  import { fly } from 'svelte/transition';
  import type { Participant } from 'sixhuma-core';
  import { parseProfile } from 'sixhuma-core';
  import { meshClient } from '../core/meshClient.svelte';
  import { chatStore, scheduleMockReply } from '../core/chatStore.svelte';

  const IS_MOCK = typeof import.meta !== 'undefined' && import.meta.env?.VITE_MOCK_MODE === 'true';

  interface Props {
    meetingCode?: string;
    selfPeerId: string | null;
    selfName: string;
    selfAvatar?: string;
    participants?: Participant[];
    initialDmPeerId?: string | null;
    onClose: () => void;
  }

  let {
    meetingCode,
    selfPeerId,
    selfName,
    selfAvatar,
    participants = [],
    initialDmPeerId,
    onClose,
  }: Props = $props();

  let tab = $state<'global' | 'dms'>('global');
  let activeDm = $state<Participant | null>(null);

  $effect(() => {
    chatStore.setChatOpen(true);
    return () => {
      chatStore.setChatOpen(false);
    };
  });

  $effect(() => {
    if (tab === 'global') {
      chatStore.setChatOpen(true);
    }
  });

  $effect(() => {
    if (initialDmPeerId) {
      const p = participants.find((pp) => pp.peerId === initialDmPeerId);
      if (p) {
        activeDm = p;
        tab = 'dms';
        if (selfPeerId) chatStore.markDmRead(selfPeerId, p.peerId);
      }
    }
  });

  function formatTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  let others = $derived(participants.filter((p) => p.peerId !== selfPeerId));

  let globalChat = $derived(chatStore.globalMessages);
  let dmMessages = $derived(
    selfPeerId && activeDm ? chatStore.getDmMessages(selfPeerId, activeDm.peerId) : []
  );

  let hasUnreadDms = $derived(
    selfPeerId ? chatStore.unreadDms.some((k) => k.split('|').includes(selfPeerId!)) : false
  );

  function getAvatar(peerId: string) {
    if (peerId === selfPeerId && selfAvatar) return selfAvatar;
    const p = participants.find((x) => x.peerId === peerId);
    if (p) {
      const prof = parseProfile(p.json);
      if (prof?.photo) return prof.photo;
    }
    return `https://api.dicebear.com/7.x/thumbs/svg?seed=${peerId}`;
  }

  function getName(peerId: string) {
    if (peerId === selfPeerId) return 'You';
    const p = participants.find((x) => x.peerId === peerId);
    return p?.displayName || 'Unknown';
  }

  // --- Global Thread State ---
  let globalDraft = $state('');

  async function handleSendGlobal() {
    const text = globalDraft.trim();
    if (!text || !selfPeerId) return;
    globalDraft = '';

    if (IS_MOCK || !meetingCode) {
      chatStore.postGlobal({
        peerId: selfPeerId,
        displayName: selfName || 'You',
        text,
        avatarUrl: selfAvatar ?? `https://api.dicebear.com/7.x/thumbs/svg?seed=${selfPeerId}`,
      });
    } else {
      try {
        await meshClient.sendChatMessage(meetingCode, text);
      } catch (err) {
        console.error('Failed to send global chat message:', err);
      }
    }
  }

  // --- DM Thread State ---
  let dmDraft = $state('');
  let activeDmProfile = $derived(activeDm ? parseProfile(activeDm.json) : null);
  let activeDmAvatar = $derived(
    activeDmProfile?.photo ??
      (activeDm ? `https://api.dicebear.com/7.x/thumbs/svg?seed=${activeDm.peerId}` : '')
  );

  async function handleSendDm() {
    const text = dmDraft.trim();
    if (!text || !selfPeerId || !activeDm) return;
    dmDraft = '';

    if (IS_MOCK || !meetingCode) {
      chatStore.postDm(selfPeerId, activeDm.peerId, {
        peerId: selfPeerId,
        displayName: selfName || 'You',
        text,
        avatarUrl: selfAvatar ?? `https://api.dicebear.com/7.x/thumbs/svg?seed=${selfPeerId}`,
      });
      if (IS_MOCK) {
        scheduleMockReply(activeDm, selfPeerId, 1800 + Math.random() * 3500);
      }
    } else {
      try {
        await meshClient.sendDirectMessage(meetingCode, activeDm.peerId, text);
      } catch (err) {
        console.error('Failed to send direct message:', err);
      }
    }
  }

  // Auto-scroll logic
  let globalBottomRef: HTMLDivElement | undefined = $state();
  let dmBottomRef: HTMLDivElement | undefined = $state();

  $effect(() => {
    if (globalChat.length && globalBottomRef) {
      globalBottomRef.scrollIntoView({ behavior: 'smooth' });
    }
  });

  $effect(() => {
    if (dmMessages.length && dmBottomRef) {
      dmBottomRef.scrollIntoView({ behavior: 'smooth' });
    }
  });

  function autofocus(node: HTMLElement) {
    node.focus();
  }
</script>

<div
  class="chat-panel"
  in:fly={{ x: 320, duration: 280 }}
  out:fly={{ x: 320, duration: 280 }}
>
  <div class="chat-header">
    <span class="chat-title">
      <span class="chat-live-dot"></span>
      Messages
    </span>
    <button class="chat-close" onclick={onClose} aria-label="Close chat">✕</button>
  </div>

  <div class="chat-tabs">
    <button
      class={`chat-tab ${tab === 'global' ? 'active' : ''}`}
      onclick={() => (tab = 'global')}
    >
      Global
    </button>
    <button
      class={`chat-tab ${tab === 'dms' ? 'active' : ''}`}
      onclick={() => (tab = 'dms')}
    >
      Direct
      {#if hasUnreadDms}
        <span class="chat-tab-unread"></span>
      {/if}
    </button>
  </div>

  {#if !selfPeerId}
    <div class="chat-empty" style="margin: auto;">Connecting…</div>
  {:else if tab === 'global'}
    <!-- GLOBAL THREAD -->
    <div class="chat-messages">
      {#if globalChat.length === 0}
        <div class="chat-empty">No messages yet. Say hi! 👋</div>
      {/if}
      {#each globalChat as msg, i (msg.id)}
        {@const isSelf = msg.peerId === selfPeerId}
        {@const grouped = i > 0 && globalChat[i - 1].peerId === msg.peerId}
        <div class={`chat-msg ${isSelf ? 'chat-msg-self' : ''} ${grouped ? 'chat-msg-grouped' : ''}`}>
          {#if !grouped}
            <div class="chat-msg-meta">
              <img
                src={msg.avatarUrl ?? getAvatar(msg.peerId)}
                alt={msg.displayName}
                class="chat-avatar"
              />
              <span class="chat-msg-name">{isSelf ? 'You' : msg.displayName}</span>
              <span class="chat-msg-time">{formatTime(msg.timestamp)}</span>
            </div>
          {/if}
          <div class="chat-bubble">{msg.text}</div>
        </div>
      {/each}
      <div bind:this={globalBottomRef}></div>
    </div>
    <div class="chat-input-row">
      <input
        use:autofocus
        class="chat-input"
        placeholder="Message everyone…"
        bind:value={globalDraft}
        onkeydown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendGlobal();
          }
        }}
        maxlength={300}
      />
      <button class="chat-send-btn" onclick={handleSendGlobal} disabled={!globalDraft.trim()}>
        ↑
      </button>
    </div>
  {:else if tab === 'dms'}
    {#if activeDm}
      <!-- DM THREAD -->
      <div class="dm-thread-header">
        <button class="dm-back-btn" onclick={() => (activeDm = null)} aria-label="Back">←</button>
        <img src={activeDmAvatar} alt={activeDm.displayName} class="dm-thread-avatar" />
        <div style="flex: 1; min-width: 0;">
          <div class="dm-thread-name">{activeDm.displayName}</div>
          <div class="dm-thread-role">{activeDm.role}</div>
        </div>
      </div>

      <div class="chat-messages">
        {#if dmMessages.length === 0}
          <div class="chat-empty" style="padding-top: 32px;">
            <div style="font-size: 26px; margin-bottom: 8px;">💬</div>
            Start a conversation with {activeDm.displayName.split(' ')[0]}
          </div>
        {/if}
        {#each dmMessages as msg, i (msg.id)}
          {@const isSelf = msg.peerId === selfPeerId}
          {@const grouped = i > 0 && dmMessages[i - 1].peerId === msg.peerId}
          <div class={`chat-msg ${isSelf ? 'chat-msg-self' : ''} ${grouped ? 'chat-msg-grouped' : ''}`}>
            {#if !grouped}
              <div class="chat-msg-meta">
                <img
                  src={isSelf ? (selfAvatar ?? getAvatar(selfPeerId)) : activeDmAvatar}
                  alt={isSelf ? 'You' : activeDm.displayName}
                  class="chat-avatar"
                />
                <span class="chat-msg-name">{isSelf ? 'You' : activeDm.displayName}</span>
                <span class="chat-msg-time">{formatTime(msg.timestamp)}</span>
              </div>
            {/if}
            <div class="chat-bubble">{msg.text}</div>
          </div>
        {/each}
        <div bind:this={dmBottomRef}></div>
      </div>

      <div class="chat-input-row">
        <input
          use:autofocus
          class="chat-input"
          placeholder={`Message ${activeDm.displayName.split(' ')[0]}…`}
          bind:value={dmDraft}
          onkeydown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendDm();
            }
          }}
          maxlength={300}
        />
        <button class="chat-send-btn" onclick={handleSendDm} disabled={!dmDraft.trim()}>
          ↑
        </button>
      </div>
    {:else}
      <!-- DM LIST -->
      <div class="dm-list">
        {#if others.length === 0}
          <div class="dm-empty">
            <div class="dm-empty-icon">👥</div>
            <div class="dm-empty-text">No other participants yet.</div>
          </div>
        {/if}
        {#each others as p (p.peerId)}
          {@const prof = parseProfile(p.json)}
          {@const avatar = prof?.photo ?? `https://api.dicebear.com/7.x/thumbs/svg?seed=${p.peerId}`}
          {@const convKey = [selfPeerId, p.peerId].sort().join('|')}
          {@const msgs = chatStore.getDmMessages(selfPeerId, p.peerId)}
          {@const lastMsg = msgs[msgs.length - 1]}
          {@const isUnread = chatStore.unreadDms.includes(convKey)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="dm-item"
            onclick={() => {
              activeDm = p;
              if (selfPeerId) chatStore.markDmRead(selfPeerId, p.peerId);
            }}
          >
            <img src={avatar} alt={p.displayName} class="dm-item-avatar" />
            <div class="dm-item-info">
              <div class="dm-item-name">{p.displayName}</div>
              <div class="dm-item-preview">
                {#if lastMsg}
                  {lastMsg.text}
                {:else}
                  <span style="color: #333; font-style: italic;">{p.role}</span>
                {/if}
              </div>
            </div>
            {#if isUnread}
              <div class="dm-item-unread"></div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .chat-panel {
    width: 320px;
    height: 100%;
    background: rgba(8, 8, 12, 0.95);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border-left: 1px solid rgba(255, 255, 255, 0.07);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex-shrink: 0;
  }

  .chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
  }

  .chat-title {
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .chat-live-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 6px #10b981;
    animation: pulse-dot 2s ease-in-out infinite;
    flex-shrink: 0;
  }

  @keyframes pulse-dot {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.6;
      transform: scale(0.85);
    }
  }

  .chat-close {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    font-size: 14px;
    padding: 4px;
    border-radius: 4px;
    transition:
      color 0.15s,
      background 0.15s;
    line-height: 1;
  }
  .chat-close:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
  }

  .chat-tabs {
    display: flex;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
  }

  .chat-tab {
    flex: 1;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.45);
    padding: 12px 16px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .chat-tab.active {
    color: #fff;
    border-bottom-color: #6366f1;
  }
  .chat-tab:hover:not(.active) {
    color: rgba(255, 255, 255, 0.7);
    background: rgba(255, 255, 255, 0.03);
  }

  .chat-tab-unread {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #ef4444;
    flex-shrink: 0;
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
  }

  .chat-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 8px;
    color: rgba(255, 255, 255, 0.3);
    font-size: 13px;
    text-align: center;
    padding: 24px 16px;
  }

  .chat-msg {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 6px;
  }
  .chat-msg-grouped {
    margin-bottom: 2px;
  }
  .chat-msg-self .chat-bubble {
    background: rgba(99, 102, 241, 0.2);
    border-color: rgba(99, 102, 241, 0.3);
    align-self: flex-end;
    border-radius: 12px 4px 12px 12px;
  }

  .chat-msg-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .chat-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .chat-msg-name {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
  }

  .chat-msg-time {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.3);
    margin-left: auto;
  }

  .chat-bubble {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px 12px 12px 12px;
    padding: 8px 12px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.9);
    line-height: 1.5;
    word-break: break-word;
    max-width: 100%;
  }

  .chat-input-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
  }

  .chat-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 10px 14px;
    color: #fff;
    font-size: 13px;
    outline: none;
    transition:
      border-color 0.2s,
      background 0.2s;
    min-width: 0;
  }
  .chat-input:focus {
    border-color: #6366f1;
    background: rgba(255, 255, 255, 0.08);
  }
  .chat-input::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .chat-send-btn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: #6366f1;
    border: none;
    color: #fff;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition:
      background 0.2s,
      transform 0.15s;
  }
  .chat-send-btn:hover:not(:disabled) {
    background: #818cf8;
  }
  .chat-send-btn:active:not(:disabled) {
    transform: scale(0.94);
  }
  .chat-send-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  /* DM styles */
  .dm-thread-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
  }

  .dm-back-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    font-size: 18px;
    padding: 4px;
    border-radius: 4px;
    transition: color 0.15s;
  }
  .dm-back-btn:hover {
    color: #fff;
  }

  .dm-thread-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }

  .dm-thread-name {
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .dm-thread-role {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
  }

  .dm-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .dm-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s;
    position: relative;
  }
  .dm-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .dm-item-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .dm-item-info {
    flex: 1;
    min-width: 0;
  }

  .dm-item-name {
    font-size: 14px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dm-item-preview {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 2px;
  }

  .dm-item-unread {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ef4444;
    flex-shrink: 0;
  }

  .dm-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 40px 16px;
    color: rgba(255, 255, 255, 0.3);
    text-align: center;
  }

  .dm-empty-icon {
    font-size: 32px;
    margin-bottom: 4px;
  }

  .dm-empty-text {
    font-size: 13px;
  }
</style>

<script lang="ts">
  import { fly } from 'svelte/transition';
  import type { Participant, MeetingRoom } from 'sixhuma-core';
  import RoleBadge from './RoleBadge.svelte';
  import TooltipButton from './TooltipButton.svelte';

  interface Props {
    room?: MeetingRoom | null;
    participants?: Participant[];
    selfPeerId: string | null;
    onKick?: (peerId: string) => void;
    onRole?: (peerId: string, role: string) => void;
    onSelect?: (peerId: string) => void;
    searchTerm?: string;
  }

  let {
    room,
    participants,
    selfPeerId,
    onKick,
    onRole,
    onSelect,
    searchTerm = '',
  }: Props = $props();

  let participantsList = $derived.by(() => {
    if (participants) return participants;
    if (room?.participants) return Object.values(room.participants);
    return [];
  });

  let self = $derived(selfPeerId ? participantsList.find((p) => p.peerId === selfPeerId) : null);
  let isHost = $derived(self?.role === 'Host' || (room && Boolean(selfPeerId) && room.hostPeerId === selfPeerId));

  let peers = $derived(
    participantsList
      .filter((p) => !p.peerId.startsWith('present-') && (p.role as string) !== 'Presentation' && !p.displayName.toLowerCase().includes('presentation'))
      .filter((p) => !searchTerm || p.displayName.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => (a.joinedAt || '').localeCompare(b.joinedAt || ''))
  );
</script>

<div class="participant-grid">
  {#each peers as p, i (p.peerId)}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="participant-grid-card"
      in:fly={{ y: 6, duration: 200, delay: i * 40 }}
      onclick={() => onSelect?.(p.peerId)}
      style="cursor: {onSelect ? 'pointer' : 'default'}"
    >
      <div class="participant-grid-head">
        <span class="participant-grid-name">
          {p.displayName}
          {#if p.peerId === selfPeerId}
            <span class="you"> (you)</span>
          {/if}
        </span>
        <RoleBadge role={p.role} />
      </div>

      {#if isHost && p.peerId !== selfPeerId && (onKick || onRole)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="participant-grid-actions" onclick={(e) => e.stopPropagation()}>
          <button
            type="button"
            class="pg-kick-btn"
            id={`kick-${p.peerId}`}
            title="Remove user from meeting"
            onclick={(e) => {
              e.stopPropagation();
              onKick?.(p.peerId);
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            <span>Kick</span>
          </button>

          <div class="pg-select-wrap">
            <span class="pg-select-prefix">Role:</span>
            <select
              id={`role-${p.peerId}`}
              value={p.role}
              onclick={(e) => e.stopPropagation()}
              onchange={(e) => {
                e.stopPropagation();
                onRole?.(p.peerId, e.currentTarget.value);
              }}
              class="pg-role-select"
              aria-label="Change participant role"
            >
              {#each ['Organizer', 'Speaker', 'Attendee'] as r}
                <option value={r}>
                  {r}
                </option>
              {/each}
            </select>
            <svg
              class="pg-select-arrow"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .participant-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .participant-grid-card {
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 8px;
    padding: 10px 12px;
    transition: background 0.15s, border-color 0.15s;
  }

  .participant-grid-card:hover {
    background: rgba(255, 255, 255, 0.045);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .participant-grid-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
  }

  .participant-grid-name {
    font-size: 13px;
    font-weight: 550;
    color: rgba(255, 255, 255, 0.92);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .you {
    color: rgba(255, 255, 255, 0.45);
    font-weight: 400;
    font-size: 12px;
  }

  .participant-grid-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .pg-kick-btn {
    height: 30px;
    padding: 0 11px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 550;
    font-family: inherit;
    border: 1px solid rgba(239, 68, 68, 0.28);
    background: rgba(239, 68, 68, 0.09);
    color: #fca5a5;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    justify-content: center;
    flex-shrink: 0;
  }

  .pg-kick-btn:hover {
    background: rgba(239, 68, 68, 0.18);
    border-color: rgba(239, 68, 68, 0.45);
    color: #fee2e2;
  }

  .pg-kick-btn:active {
    transform: scale(0.97);
  }

  .pg-select-wrap {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    transition: border-color 0.15s, background 0.15s;
    height: 30px;
  }

  .pg-select-wrap:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .pg-select-prefix {
    padding-left: 9px;
    font-size: 10.5px;
    font-weight: 500;
    color: #64748b;
    pointer-events: none;
    user-select: none;
    flex-shrink: 0;
  }

  .pg-role-select {
    width: 100%;
    height: 100%;
    padding: 0 24px 0 6px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 500;
    font-family: inherit;
    background: transparent;
    color: #e2e8f0;
    border: none;
    cursor: pointer;
    outline: none;
    appearance: none;
    -webkit-appearance: none;
    transition: all 0.15s ease;
  }

  .pg-role-select option {
    background: #141416;
    color: #f8fafc;
  }

  .pg-select-arrow {
    position: absolute;
    right: 8px;
    pointer-events: none;
    color: rgba(255, 255, 255, 0.4);
    transition: color 0.15s ease;
  }

  .pg-select-wrap:hover .pg-select-arrow {
    color: rgba(255, 255, 255, 0.85);
  }
</style>

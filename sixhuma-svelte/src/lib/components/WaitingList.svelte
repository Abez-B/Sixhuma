<script lang="ts">
  import { fly } from 'svelte/transition';
  import type { WaitingPeer } from 'sixhuma-core';
  import TooltipButton from './TooltipButton.svelte';

  interface Props {
    waitingPeers: WaitingPeer[];
    onAdmit: (peerId: string) => void;
    onReject?: (peerId: string) => void;
  }

  let { waitingPeers = [], onAdmit, onReject }: Props = $props();

  function formatJoined(iso: string | number) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
</script>

{#if waitingPeers.length > 0}
  <div class="waiting-list-card">
    <div class="waiting-list-head">
      Waiting for admission ({waitingPeers.length})
    </div>
    <div class="waiting-list-grid">
      {#each waitingPeers as p (p.peerId)}
        <div
          class="waiting-list-row"
          in:fly={{ y: 6, duration: 200 }}
          out:fly={{ x: -10, duration: 200 }}
        >
          <div class="waiting-avatar">{p.displayName.charAt(0).toUpperCase()}</div>
          <div>
            <div class="waiting-name">{p.displayName}</div>
            <div class="waiting-time">{formatJoined(p.joinedAt)}</div>
          </div>
          <div style="display: flex; gap: 6px;">
            <TooltipButton
              text="Admit"
              tooltip="Allow entry"
              variant="success"
              onclick={() => onAdmit(p.peerId)}
              style="width: 80px; height: 32px;"
            />
            {#if onReject}
              <TooltipButton
                text="Reject"
                tooltip="Deny entry"
                variant="danger"
                onclick={() => onReject(p.peerId)}
                style="width: 80px; height: 32px;"
              />
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .waiting-list-card {
    background: rgba(139, 92, 246, 0.05);
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 10px;
    overflow: hidden;
  }

  .waiting-list-head {
    padding: 10px 14px;
    font-size: 12px;
    font-weight: 600;
    color: #a78bfa;
    background: rgba(139, 92, 246, 0.08);
    border-bottom: 1px solid rgba(139, 92, 246, 0.15);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .waiting-list-grid {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .waiting-list-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    transition: background 0.15s;
  }

  .waiting-list-row:last-child {
    border-bottom: none;
  }

  .waiting-list-row:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .waiting-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(139, 92, 246, 0.2);
    border: 1px solid rgba(139, 92, 246, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
    color: #a78bfa;
    flex-shrink: 0;
  }

  .waiting-name {
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    flex: 1;
    min-width: 0;
  }

  .waiting-time {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    margin-top: 2px;
  }
</style>

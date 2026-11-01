<script lang="ts">
  import { meshClient } from '$lib/core/meshClient.svelte';

  let status = $derived(meshClient.connectionStatus);
  let latencyMs = $derived(meshClient.state.latencyMs ?? 0);

  let quality = $derived.by(() => {
    if (latencyMs < 80) return 'excellent';
    if (latencyMs < 180) return 'good';
    if (latencyMs < 350) return 'fair';
    return 'poor';
  });

  let shouldHide = $derived(
    status === 'connected' && (quality === 'excellent' || quality === 'good')
  );

  let statusText = $derived.by(() => {
    if (status === 'disconnected') return 'Disconnected';
    if (status === 'connecting' || status === 'reconnecting') return 'Connecting…';
    if (quality === 'poor') return `Poor connection (${latencyMs}ms)`;
    if (quality === 'fair') return `Connection slow (${latencyMs}ms)`;
    return '';
  });

  let statusColor = $derived.by(() => {
    if (status === 'disconnected') return '#ef4444';
    if (status === 'connecting' || status === 'reconnecting') return '#f59e0b';
    if (quality === 'poor') return '#ef4444';
    if (quality === 'fair') return '#f59e0b';
    return '#10b981';
  });
</script>

{#if !shouldHide}
  <div class="connection-quality-indicator" style="--quality-color: {statusColor};">
    <span class="connection-quality-dot"></span>
    <span class="connection-quality-text">{statusText}</span>
  </div>
{/if}

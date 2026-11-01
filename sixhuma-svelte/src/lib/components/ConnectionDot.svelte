<script lang="ts">
  import { meshClient } from '$lib/core/meshClient.svelte';

  const CONFIG = {
    connected: { color: '#1D9E75', label: 'Connected' },
    connecting: { color: '#EF9F27', label: 'Connecting…' },
    reconnecting: { color: '#EF9F27', label: 'Reconnecting…' },
    disconnected: { color: '#E24B4A', label: 'Disconnected' },
  } as const;

  let status = $derived(meshClient.connectionStatus);
  let cfg = $derived(CONFIG[status] || CONFIG.disconnected);
</script>

<div class={`connection-dot connection-dot--${status}`}>
  <span class="connection-dot__indicator" style="background-color: {cfg.color};"></span>
  <span>{cfg.label}</span>
</div>

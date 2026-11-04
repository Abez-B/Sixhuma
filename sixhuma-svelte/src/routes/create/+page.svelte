<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';

  onMount(() => {
    goto(`${base}/host`, { replaceState: true });
  });
</script>

<div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; color: #888;">
  Loading host console…
</div>

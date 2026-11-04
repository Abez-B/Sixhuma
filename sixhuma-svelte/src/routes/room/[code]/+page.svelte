<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';

  onMount(() => {
    const code = page.params.code;
    if (code) {
      goto(`${base}/meeting/${code}`, { replaceState: true });
    } else {
      goto(base || '/', { replaceState: true });
    }
  });
</script>

<div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; color: #888;">
  Entering room…
</div>

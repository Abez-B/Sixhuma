<script lang="ts">
  import { fade } from 'svelte/transition';

  let { label }: { label?: string } = $props();
</script>

<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px; min-height: 100%; width: 100%;">
  <div class="mm-loader">
    <div class="mm-loader-box1"></div>
    <div class="mm-loader-box2"></div>
    <div class="mm-loader-box3"></div>
  </div>
  {#if label}
    <p
      in:fade={{ delay: 400 }}
      style="color: #525252; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; font-family: 'JetBrains Mono', monospace;"
    >
      {label}
    </p>
  {/if}
</div>

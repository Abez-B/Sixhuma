<script lang="ts">
  // We determine the grid layout dynamically based on viewport size or fixed rows/cols.
  // Using a very large grid to ensure it fills the background.
  let { r = 24, c = 40 } = $props();
  
  let tiles = $derived(Array.from({ length: r * c }));
</script>

<div class="dark-tiles-grid" style="--r: {r}; --c: {c};">
  {#each tiles as _, i}
    <div class="dark-tile"></div>
  {/each}
</div>

<style>
  .dark-tiles-grid {
    display: grid;
    grid-template-rows: repeat(var(--r), 1fr);
    grid-template-columns: repeat(var(--c), 1fr);
    width: 100%;
    height: 100%;
    /* Subtle base background */
    background: #030305;
  }

  .dark-tile {
    /* Very faint border to create the tile effect */
    border-right: 1px solid rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(255, 255, 255, 0.02);
    background: transparent;
    /* Smooth fade out when the mouse leaves */
    transition: background 0.8s ease;
  }

  /* Interactive hover effect */
  .dark-tile:hover {
    background: rgba(255, 255, 255, 0.06);
    /* Instant highlight when mouse enters */
    transition: background 0s;
  }
</style>

<script lang="ts">
  import Particles from './Particles.svelte';
  import Meteors from './Meteors.svelte';
</script>

<div class="space-container">
  <!-- Solid deep background for the space theme -->
  <div class="space-base"></div>
  <!-- Particles reacting to the mouse -->
  <Particles quantity={150} staticity={40} />
  
  <!-- Add shooting meteors over the particles -->
  <Meteors number={15} />
  
  <!-- Subtle cinematic noise to make it premium -->
  <div class="noise-overlay"></div>
</div>

<style>
  .space-container {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    z-index: -10;
    pointer-events: none;
  }

  .space-base {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at top, #1a1a2e 0%, #030305 60%);
  }

  .noise-overlay {
    position: absolute;
    inset: 0;
    opacity: 0.04;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
    mix-blend-mode: overlay;
  }
</style>

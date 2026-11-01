<script lang="ts">
  import { onMount } from 'svelte';

  let { number = 20 } = $props();

  let meteors = $state<Array<{ top: number; left: number; delay: number; duration: number }>>([]);

  onMount(() => {
    // Generate random starting positions and animation timings
    meteors = Array.from({ length: number }).map(() => ({
      // Start anywhere from the top 0 to 100%, and left 0 to 100%
      top: Math.floor(Math.random() * -100), // Start above the viewport
      left: Math.floor(Math.random() * 150), // Start randomly across the width
      delay: Math.random() * 5, // Random delay before shooting
      duration: Math.random() * 6 + 4 // Random speed between 4s and 10s
    }));
  });
</script>

<div class="meteors-container">
  {#each meteors as meteor}
    <span
      class="meteor"
      style="
        top: {meteor.top}%; 
        left: {meteor.left}%; 
        animation-delay: {meteor.delay}s; 
        animation-duration: {meteor.duration}s;
      "
    ></span>
  {/each}
</div>

<style>
  .meteors-container {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    z-index: 1; /* Place above space stars but below UI */
  }

  .meteor {
    position: absolute;
    width: 3px;
    height: 3px;
    background-color: #ffffff;
    border-radius: 50%;
    /* 215 degrees makes it shoot diagonally down-left */
    transform: rotate(215deg);
    opacity: 0;
    animation: meteor-shower linear infinite;
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1), 0 0 12px rgba(255,255,255,0.8);
  }

  /* The glowing tail */
  .meteor::before {
    content: '';
    position: absolute;
    top: 50%;
    /* Align tail behind the meteor */
    transform: translateY(-50%);
    width: 120px;
    height: 1px;
    background: linear-gradient(90deg, #ffffff, transparent);
  }

  @keyframes meteor-shower {
    0% {
      transform: rotate(215deg) translateX(0);
      opacity: 0;
    }
    10% {
      opacity: 1;
    }
    80% {
      opacity: 1;
    }
    100% {
      /* Shoots off-screen based on the local rotated X-axis */
      transform: rotate(215deg) translateX(-1500px);
      opacity: 0;
    }
  }
</style>

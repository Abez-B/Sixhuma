<script lang="ts">
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  import '$lib/styles/tailwind.css';
  import '$lib/styles/index.css';
  import '$lib/styles/meetmesh-upgraded.css';
  import '$lib/styles/chat.css';
  import '$lib/styles/linkedin-perm.css';
  import '$lib/styles/MeshGraph.css';
  import '$lib/styles/MeshVisual.css';
  import '$lib/styles/RetroGrid.css';
  import '$lib/styles/SpaceBackground.css';

  let { children } = $props();
</script>

<svelte:head>
  <title>Sixhuma — Real-Time Spatial Networking</title>
  <meta name="description" content="Visualise your room as a live constellation of peers. Connect instantly with zero app download." />
  <link rel="icon" href="/icon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
    rel="stylesheet"
  />
</svelte:head>

{@render children()}
<ToastContainer />

<style>
  :global(*),
  :global(*::before),
  :global(*::after) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  :global(body) {
    background-color: #030305;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial,
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    color: #fff;
    overflow-x: hidden;
  }
  :global(button) {
    font-family: inherit;
  }
  :global(input),
  :global(textarea),
  :global(select) {
    font-family: inherit;
  }
</style>

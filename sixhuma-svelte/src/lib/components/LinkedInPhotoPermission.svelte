<script lang="ts">
  import { slide } from 'svelte/transition';
  import { onMount } from 'svelte';

  const PERM_KEY = 'meetmesh_linkedin_photo_perm';

  let { linkedInUsername, onPhotoFetched, onDismiss }: {
    linkedInUsername: string;
    onPhotoFetched: (url: string) => void;
    onDismiss: () => void;
  } = $props();

  type PermState = 'asking' | 'loading' | 'done' | 'failed';
  let permState = $state<PermState>('asking');
  let previewUrl = $state<string | null>(null);


  // FIX 1: Move initialization to onMount so prop closures are captured correctly in runes mode
  onMount(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(PERM_KEY) : null;
    if (stored === 'denied') {
      // Parent should not have rendered us, but guard anyway
      onDismiss();
    } else if (stored === 'granted' && linkedInUsername) {
      // Re-use previous consent — fetch silently
      fetchPhoto();
    }
  });

  // FIX 2: Extracted into a named function so both auto-fetch and manual allow share the same path.
  function fetchPhoto() {
    permState = 'loading';
    const url = `https://unavatar.io/linkedin/${encodeURIComponent(linkedInUsername)}`;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      previewUrl = url;
      permState = 'done';
      onPhotoFetched(url);
    };

    // FIX 3: onerror — only fall back to dicebear if unavatar genuinely 404s,
    // not on network errors (which would still show a broken image).
    // We also call onPhotoFetched with the fallback so the parent isn't left hanging.
    img.onerror = () => {
      const fallback = `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(linkedInUsername)}`;
      previewUrl = fallback;
      permState = 'failed';
      onPhotoFetched(fallback);
    };

    img.src = url;
  }

  function handleAllow() {
    localStorage.setItem(PERM_KEY, 'granted');
    fetchPhoto();
  }

  function handleDeny() {
    localStorage.setItem(PERM_KEY, 'denied');
    onDismiss();
  }

  // FIX 4: Auto-dismiss after success so the banner doesn't linger.
  $effect(() => {
    if (permState === 'done') {
      const t = setTimeout(onDismiss, 2200);
      return () => clearTimeout(t);
    }
  });
</script>

<!-- FIX 5: Guard rendering entirely if username is missing — nothing to fetch. -->
{#if linkedInUsername}
  <div
    class="li-perm-banner"
    role="status"
    aria-live="polite"
    in:slide={{ duration: 250 }}
    out:slide={{ duration: 250 }}
  >
    {#if permState === 'asking'}
      <div class="li-perm-icon">🔗</div>
      <div class="li-perm-copy">
        <span class="li-perm-title">Auto-fetch your LinkedIn photo?</span>
        <span class="li-perm-sub">
          We use <strong>unavatar.io</strong> as a privacy-friendly proxy — your LinkedIn credentials are never shared.
        </span>
      </div>
      <div class="li-perm-actions">
        <button class="li-perm-allow" onclick={handleAllow}>Allow</button>
        <button class="li-perm-skip" onclick={handleDeny}>Skip</button>
      </div>

    {:else if permState === 'loading'}
      <div class="li-perm-icon li-spin">⟳</div>
      <div class="li-perm-copy">
        <span class="li-perm-title">Fetching your photo…</span>
      </div>

    {:else if permState === 'done' && previewUrl}
      <!-- svelte-ignore a11y_img_redundant_alt -->
      <img src={previewUrl} alt="Your LinkedIn photo" class="li-perm-preview" />
      <div class="li-perm-copy">
        <span class="li-perm-title">Photo fetched ✓</span>
        <span class="li-perm-sub">Dismissing in a moment…</span>
      </div>
      <!-- FIX 6: Manual dismiss still available in case auto-dismiss feels slow -->
      <button class="li-perm-skip" onclick={onDismiss}>Done</button>

    {:else if permState === 'failed'}
      <!-- FIX 7: Show failed state even without a previewUrl (network error path) -->
      {#if previewUrl}
        <img src={previewUrl} alt="Generated avatar" class="li-perm-preview" />
      {:else}
        <div class="li-perm-icon">⚠️</div>
      {/if}
      <div class="li-perm-copy">
        <span class="li-perm-title">Couldn't fetch LinkedIn photo</span>
        <span class="li-perm-sub">Using a generated avatar instead. You can upload a photo manually.</span>
      </div>
      <button class="li-perm-skip" onclick={onDismiss}>Ok</button>
    {/if}
  </div>
{/if}

<style>
  .li-perm-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(20, 20, 30, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  .li-perm-icon {
    font-size: 22px;
    flex-shrink: 0;
  }

  .li-spin {
    display: inline-block;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .li-perm-copy {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 0;
  }

  .li-perm-title {
    font-weight: 600;
    font-size: 13px;
    color: #f5f5f5;
  }

  .li-perm-sub {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.55);
    line-height: 1.4;
  }

  .li-perm-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .li-perm-allow,
  .li-perm-skip {
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: opacity 0.15s;
  }

  .li-perm-allow {
    background: #6366f1;
    color: #fff;
  }

  .li-perm-allow:hover { opacity: 0.85; }

  .li-perm-skip {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .li-perm-skip:hover { opacity: 0.75; }

  .li-perm-preview {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    border: 2px solid rgba(99, 102, 241, 0.5);
  }
</style>
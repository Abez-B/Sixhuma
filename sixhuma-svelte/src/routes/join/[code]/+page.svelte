<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { v4 as uuid } from 'uuid';
  import { isValidMeetingCode } from 'sixhuma-core';
  import { meshClient } from '$lib/core/meshClient.svelte';
  import Logo from '$lib/components/Logo.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import CameraCapture from '$lib/components/CameraCapture.svelte';
  import TooltipButton from '$lib/components/TooltipButton.svelte';
  import ShimmerButton from '$lib/components/ShimmerButton.svelte';
  import LinkedInPhotoPermission from '$lib/components/LinkedInPhotoPermission.svelte';
  import BackgroundPattern from '$lib/components/BackgroundPattern.svelte';
  import '$lib/styles/meetmesh-upgraded.css';

  const LINKEDIN_PEER_REGEX = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)\/?/i;

  let code = $derived(page.params.code?.toUpperCase() ?? '');
  let step = $state<1 | 2>(1);
  let busy = $state(false);
  let error = $state('');

  let photo = $state<string | undefined>();
  let name = $state('');
  let linkedIn = $state('');
  let github = $state('');
  let bio = $state('');
  let selectedTags = $state<string[]>([]);
  let showLinkedInPerm = $state(true);

  let linkedInMatch = $derived(linkedIn.trim().match(LINKEDIN_PEER_REGEX));
  let linkedInValidity = $derived(
    linkedIn.trim() ? (linkedInMatch ? 'valid' : 'invalid') : 'idle'
  );
  let linkedInUsername = $derived(linkedInMatch?.[1] || '');

  onMount(() => {
    try {
      const cached = localStorage.getItem('meetmesh_profile_cache');
      if (cached) {
        const p = JSON.parse(cached);
        if (p.name) name = p.name;
        if (p.linkedIn) linkedIn = p.linkedIn;
        if (p.github || p.portfolio) github = p.github || p.portfolio;
        if (p.bio) bio = p.bio;
        if (Array.isArray(p.tags)) selectedTags = p.tags;
        if (p.photo) {
          photo = p.photo;
          step = 2;
        }
      }
    } catch {}

    const upperCode = code?.toUpperCase();
    if (
      upperCode &&
      (sessionStorage.getItem(`meetmesh_kicked_${upperCode}`) === 'true' ||
        localStorage.getItem(`meetmesh_kicked_${upperCode}`) === 'true')
    ) {
      error = 'You have been removed from this room by the host.';
    }

    meshClient.connect().catch((err) => {
      console.error('[JoinProfilePage] Connection failed:', err);
      error = `Relay connection failed: ${err?.message || 'Check if API is running'}`;
    });

    const onError = ({ detail, code: errCode }: { detail: string; code?: string }) => {
      if (
        errCode === 'KICKED' ||
        errCode === 'REMOVED' ||
        detail?.toLowerCase().includes('removed')
      ) {
        if (upperCode) {
          localStorage.setItem(`meetmesh_kicked_${upperCode}`, 'true');
          sessionStorage.setItem(`meetmesh_kicked_${upperCode}`, 'true');
        }
        error = 'You have been removed from this room by the host.';
      } else {
        error = detail;
      }
      busy = false;
    };

    meshClient.on('Error', onError);
    return () => {
      meshClient.off('Error', onError);
    };
  });

  function handleCapture(base64: string) {
    photo = base64;
    step = 2;
  }

  function handleSkipCapture() {
    photo = 'SKIP';
    step = 2;
  }

  function handleRetake() {
    photo = undefined;
    step = 1;
  }

  function toggleTag(tag: string) {
    const fullTag = `#${tag}`;
    if (selectedTags.includes(fullTag)) {
      selectedTags = selectedTags.filter((t) => t !== fullTag);
    } else if (selectedTags.length < 3) {
      selectedTags = [...selectedTags, fullTag];
    }
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!code || !isValidMeetingCode(code)) {
      error = 'Invalid meeting code.';
      return;
    }
    const upperCode = code.toUpperCase();
    if (
      sessionStorage.getItem(`meetmesh_kicked_${upperCode}`) === 'true' ||
      localStorage.getItem(`meetmesh_kicked_${upperCode}`) === 'true'
    ) {
      error = 'You have been removed from this room by the host.';
      return;
    }
    if (!name.trim()) {
      error = 'Name is required.';
      return;
    }
    if (!linkedIn.trim()) {
      error = 'LinkedIn URL is required.';
      return;
    }

    const match = linkedIn.trim().match(LINKEDIN_PEER_REGEX);
    if (!match) {
      error = 'Please enter a valid LinkedIn URL (e.g., linkedin.com/in/username)';
      return;
    }

    busy = true;
    error = '';

    const photoToSave = photo === 'SKIP' ? undefined : photo;
    const profileJsonObj = {
      linkedIn: linkedIn.trim(),
      github: github.trim() || undefined,
      bio: bio.trim() || undefined,
      photo: photoToSave,
      tags: selectedTags,
    };
    const profileJson = JSON.stringify(profileJsonObj);

    localStorage.setItem(
      'meetmesh_profile_cache',
      JSON.stringify({ name: name.trim(), ...profileJsonObj })
    );

    const peerId =
      sessionStorage.getItem('meetmesh_peer_id') ??
      localStorage.getItem('meetmesh_peer_id') ??
      uuid();

    sessionStorage.setItem('meetmesh_peer_id', peerId);
    localStorage.setItem('meetmesh_peer_id', peerId);
    sessionStorage.setItem('meetmesh_is_host', 'false');
    sessionStorage.setItem('meetmesh_last_name', name.trim());
    localStorage.setItem('meetmesh_last_name', name.trim());
    sessionStorage.setItem('meetmesh_last_profile_json', profileJson);
    localStorage.setItem('meetmesh_last_profile_json', profileJson);
    localStorage.setItem(`meetmesh_peer_${upperCode}`, peerId);
    localStorage.setItem(`meetmesh_name_${upperCode}`, name.trim());
    localStorage.setItem(`meetmesh_profile_${upperCode}`, profileJson);

    try {
      await meshClient.joinMeeting(code, name.trim(), peerId, profileJson);
      goto(`${base}/join/${code}/waiting`);
    } catch {
      error = 'Failed to join meeting.';
      busy = false;
    }
  }

  let hasCachedProfile = $derived(Boolean(name || linkedIn || github || bio || photo));
</script>

<svelte:head>
  <title>Join {code} | Sixhuma</title>
</svelte:head>

<div class="jp-root">
  <BackgroundPattern />

  <header class="jp-top-bar">
    <a href="{base || '/'}" class="jp-back-home">
      <Logo size={22} />
      <span class="jp-back-name">Sixhuma</span>
      <span class="jp-back-arrow">← Back to Home</span>
    </a>
  </header>

  <div class="jp-page">
    <aside class="jp-aside">
      <div class="jp-aside-kicker">
        <div class="jp-aside-dot"></div>
        Attendee Check-In
      </div>
      <h1 class="jp-aside-title">Join the live mesh with a profile worth opening.</h1>
      <p class="jp-aside-copy">
        Add a recognizable face, your LinkedIn identity, and a short introduction so the room feels
        human the second you appear.
      </p>

      <div class="jp-code-card">
        <span class="jp-code-label">Meeting code</span>
        <span class="jp-code-value">{code}</span>
        <span class="jp-code-note">You will enter the waiting room after this step.</span>
      </div>

      <div class="jp-steps">
        <div class={`jp-step ${step === 1 ? 'current' : 'complete'}`}>
          <div class="jp-step-num">{step > 1 ? '✓' : '1'}</div>
          <div>
            <div class="jp-step-title">Capture a quick photo</div>
            <div class="jp-step-copy">Optional, but it makes the mesh recognizable.</div>
          </div>
        </div>
        <div class={`jp-step ${step === 2 ? 'current' : ''}`}>
          <div class="jp-step-num">2</div>
          <div>
            <div class="jp-step-title">Fill in your profile</div>
            <div class="jp-step-copy">Name, LinkedIn identity, and a short bio.</div>
          </div>
        </div>
      </div>

      <div class="jp-aside-footer">
        <span class="jp-aside-tag"
          >{hasCachedProfile ? 'Saved profile detected' : 'Instant setup'}</span
        >
        <span class="jp-aside-tag">Real-time connection</span>
      </div>
    </aside>

    <div class="jp-card-wrapper">
      {#if step === 1}
        <div class="jp-card">
          <div class="jp-card-head">
            <div>
              <p class="jp-card-title">Profile Setup</p>
              <p class="jp-card-sub">
                Start with a clear face preview for node cards and host review.
              </p>
            </div>
            <span class="jp-step-pill">Step 1 of 2</span>
          </div>
          <div class="jp-camera">
            <div class="jp-camera-icon">📷</div>
            <div>
              <p class="jp-camera-title">Snap a quick photo</p>
              <p class="jp-camera-sub">
                This will appear on your mesh node card — helps people recognize you instantly.
              </p>
            </div>
            <CameraCapture onCapture={handleCapture} onSkip={handleSkipCapture} />
          </div>
        </div>
      {:else}
        <div class="jp-card">
          <div class="jp-card-head">
            <div>
              <p class="jp-card-title">Your Profile</p>
              <p class="jp-card-sub">
                This is what other attendees will see when they tap your node.
              </p>
            </div>
            <span class="jp-step-pill">Step 2 of 2</span>
          </div>

          <form onsubmit={handleSubmit} class="jp-form">
            {#if photo && photo !== 'SKIP'}
              <div class="jp-photo-preview">
                <img src={photo} alt="Selfie" class="jp-photo-img" />
                <div class="jp-photo-info">
                  <div class="jp-photo-name">Photo captured</div>
                </div>
                <button type="button" class="jp-retake-btn" onclick={handleRetake}>Retake</button>
              </div>
            {:else if photo === 'SKIP'}
              <div class="jp-photo-preview">
                <div class="jp-photo-placeholder">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div class="jp-photo-info">
                  <div class="jp-photo-name">Photo skipped</div>
                </div>
                <button type="button" class="jp-retake-btn" onclick={handleRetake}>Add photo</button>
              </div>
            {:else}
              <div class="jp-photo-preview">
                <div class="jp-photo-placeholder">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div class="jp-photo-info">
                  <div class="jp-photo-name">No photo captured</div>
                </div>
                <button type="button" class="jp-retake-btn" onclick={handleRetake}>Add photo</button>
              </div>
            {/if}

            <div class="jp-field">
              <label class="jp-label" for="jp-name-input">Full Name *</label>
              <input
                id="jp-name-input"
                required
                bind:value={name}
                placeholder="Alice Example"
                class="jp-input"
              />
            </div>

            <div class="jp-field">
              <label class="jp-label" for="jp-linkedin-input">LinkedIn URL *</label>
              <div class="jp-input-row">
                <input
                  id="jp-linkedin-input"
                  required
                  type="text"
                  bind:value={linkedIn}
                  placeholder="linkedin.com/in/alice-example"
                  class="jp-input"
                  style="padding-right: {linkedInValidity !== 'idle' ? '52px' : '14px'};"
                />
                {#if linkedInValidity !== 'idle'}
                  <span class={`jp-validity ${linkedInValidity}`}>
                    {linkedInValidity === 'valid' ? 'OK' : 'FIX'}
                  </span>
                {/if}
              </div>
            </div>

            {#if linkedInUsername && showLinkedInPerm && (!photo || photo === 'SKIP')}
              <div style="margin-bottom: 8px;">
                <LinkedInPhotoPermission
                  {linkedInUsername}
                  onPhotoFetched={(url) => {
                    photo = url;
                    showLinkedInPerm = false;
                  }}
                  onDismiss={() => {
                    showLinkedInPerm = false;
                  }}
                />
              </div>
            {/if}

            <div class="jp-field-row">
              <div class="jp-field">
                <label class="jp-label" for="jp-github-input">GitHub URL</label>
                <input
                  id="jp-github-input"
                  type="text"
                  bind:value={github}
                  placeholder="github.com/alice"
                  class="jp-input"
                />
              </div>
              <div class="jp-field">
                <label class="jp-label" for="jp-meetingcode-input">Meeting code</label>
                <input id="jp-meetingcode-input" value={code} class="jp-input readonly" readonly />
              </div>
            </div>

            <div class="jp-field">
              <label class="jp-label" for="jp-bio-input">Short bio ({bio.length}/140)</label>
              <textarea
                id="jp-bio-input"
                maxlength={140}
                bind:value={bio}
                placeholder="What do you do?"
                class="jp-textarea"
              ></textarea>
              <div class="jp-char-count">{140 - bio.length} remaining</div>
            </div>

            <div class="jp-field">
              <span class="jp-label">Interest tags (pick up to 3)</span>
              <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px;">
                {#each ['AI', 'Founder', 'Engineering', 'Design', 'Product', 'Web3', 'Hiring', 'Student'] as tag}
                  {@const active = selectedTags.includes(`#${tag}`)}
                  <button
                    type="button"
                    onclick={() => toggleTag(tag)}
                    style="
                      padding: 5px 12px;
                      border-radius: 6px;
                      font-size: 12px;
                      font-weight: 500;
                      cursor: pointer;
                      min-height: 32px;
                      display: inline-flex;
                      align-items: center;
                      justify-content: center;
                      transition: all 0.15s ease;
                      border: {active
                      ? '1px solid rgba(99, 102, 241, 0.5)'
                      : '1px solid rgba(255,255,255,0.1)'};
                      background: {active ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255,255,255,0.04)'};
                      color: {active ? '#a5b4fc' : '#94a3b8'};
                    "
                  >
                    {tag}
                  </button>
                {/each}
              </div>
            </div>

            {#if error}
              <div class="jp-error">
                {error}
              </div>
            {/if}

            <div class="jp-submit-row">
              <button type="button" class="jp-btn-ghost" onclick={() => (step = 1)}>Back</button>
              <ShimmerButton
                type="submit"
                disabled={busy}
                class="shadow-2xl w-full"
              >
                <span
                  class="whitespace-pre-wrap text-center text-sm font-medium leading-none tracking-tight text-white dark:from-white dark:to-slate-900/10 lg:text-lg"
                >
                  {busy ? 'Joining...' : 'Join Meeting'}
                </span>
              </ShimmerButton>
            </div>
          </form>
        </div>
      {/if}
    </div>
  </div>

  <Footer />
</div>

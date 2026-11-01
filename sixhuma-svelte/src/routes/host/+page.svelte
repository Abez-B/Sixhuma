<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { v4 as uuid } from 'uuid';
  import { meshClient } from '$lib/core/meshClient.svelte';
  import { commitPendingEventMeta, savePendingEventMeta } from '$lib/utils/hostEventMeta';
  import Logo from '$lib/components/Logo.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import CameraCapture from '$lib/components/CameraCapture.svelte';
  import TooltipButton from '$lib/components/TooltipButton.svelte';
  import ShimmerButton from '$lib/components/ShimmerButton.svelte';
  import BackgroundPattern from '$lib/components/BackgroundPattern.svelte';
  import '$lib/styles/meetmesh-upgraded.css';

  const LINKEDIN_REGEX = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)\/?/i;

  let step = $state<1 | 2>(1);
  let eventName = $state('');
  let hostName = $state('');
  let hostLinkedIn = $state('');
  let hostGithub = $state('');
  let eventSubtitle = $state('');
  let eventDescription = $state('');
  let hostBio = $state('');
  let hostPhoto = $state<string | undefined>();
  let busy = $state(false);
  let error = $state('');

  onMount(() => {
    // Read prefilled event name from query param if available
    const eventParam = page.url.searchParams.get('event');
    if (eventParam) {
      eventName = eventParam;
    }

    try {
      const cached = localStorage.getItem('meetmesh_host_setup_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (!eventName && parsed.eventName) eventName = parsed.eventName;
        if (parsed.hostName) hostName = parsed.hostName;
        if (parsed.hostLinkedIn) hostLinkedIn = parsed.hostLinkedIn;
        if (parsed.hostGithub) hostGithub = parsed.hostGithub;
        if (parsed.hostBio) hostBio = parsed.hostBio;
        if (parsed.eventSubtitle) eventSubtitle = parsed.eventSubtitle;
        if (parsed.eventDescription) eventDescription = parsed.eventDescription;
        if (parsed.hostPhoto) {
          hostPhoto = parsed.hostPhoto;
          step = 2;
        }
      }
    } catch {}

    meshClient.connect().catch((err) => {
      console.error('[HostSetupPage] Connection failed:', err);
      error = `Relay connection failed: ${err?.message || 'Is the API server running?'}`;
    });

    const onCreated = (payload: { meetingCode: string; hostSecret?: string }) => {
      commitPendingEventMeta(payload.meetingCode);
      const hId =
        sessionStorage.getItem('meetmesh_peer_id') || localStorage.getItem('meetmesh_peer_id');
      const pJson =
        sessionStorage.getItem('meetmesh_last_profile_json') ||
        localStorage.getItem('meetmesh_last_profile_json') ||
        '{}';
      if (hId) {
        localStorage.setItem(`meetmesh_host_${payload.meetingCode}`, hId);
        localStorage.setItem(`meetmesh_peer_${payload.meetingCode}`, hId);
        localStorage.setItem(`meetmesh_name_${payload.meetingCode}`, hostName.trim() || 'Host');
        localStorage.setItem(`meetmesh_profile_${payload.meetingCode}`, pJson);
      }
      if (payload.hostSecret) {
        localStorage.setItem(`meetmesh_secret_${payload.meetingCode}`, payload.hostSecret);
        sessionStorage.setItem(`meetmesh_secret_${payload.meetingCode}`, payload.hostSecret);
        meshClient.setHostSecret(payload.hostSecret);
      }
      goto(`/manage/${payload.meetingCode}`);
    };

    const onError = ({ detail }: { detail: string }) => {
      error = detail;
      busy = false;
    };

    meshClient.on('MeetingCreated', onCreated);
    meshClient.on('Error', onError);

    return () => {
      meshClient.off('MeetingCreated', onCreated);
      meshClient.off('Error', onError);
    };
  });

  function handlePhotoCapture(base64: string) {
    hostPhoto = base64;
    step = 2;
  }

  function handleSkipPhoto() {
    hostPhoto = 'SKIP';
    step = 2;
  }

  function handleRetakePhoto() {
    hostPhoto = undefined;
    step = 1;
  }

  async function handleLaunch(e?: Event) {
    if (e) e.preventDefault();
    if (!eventName.trim()) {
      error = 'Enter an event name to launch the room';
      return;
    }
    if (!hostName.trim()) {
      error = 'Enter your name for the host badge';
      return;
    }
    if (hostLinkedIn.trim() && !hostLinkedIn.trim().match(LINKEDIN_REGEX)) {
      error = 'Use a valid LinkedIn URL for your host profile (e.g., linkedin.com/in/username)';
      return;
    }

    busy = true;
    error = '';

    const peerId =
      sessionStorage.getItem('meetmesh_peer_id') ??
      localStorage.getItem('meetmesh_peer_id') ??
      uuid();
    const photoToSave = hostPhoto === 'SKIP' ? undefined : hostPhoto;
    const profileJson = JSON.stringify({
      name: hostName.trim() || undefined,
      linkedIn: hostLinkedIn.trim() || undefined,
      github: hostGithub.trim() || undefined,
      bio: hostBio.trim() || undefined,
      photo: photoToSave,
    });

    localStorage.setItem(
      'meetmesh_host_setup_cache',
      JSON.stringify({
        eventName: eventName.trim(),
        hostName: hostName.trim(),
        hostLinkedIn: hostLinkedIn.trim(),
        hostGithub: hostGithub.trim(),
        hostBio: hostBio.trim(),
        eventSubtitle: eventSubtitle.trim(),
        eventDescription: eventDescription.trim(),
        hostPhoto: photoToSave,
      })
    );

    savePendingEventMeta({
      subtitle: eventSubtitle.trim() || undefined,
      description: eventDescription.trim() || undefined,
    });

    sessionStorage.setItem('meetmesh_peer_id', peerId);
    localStorage.setItem('meetmesh_peer_id', peerId);
    sessionStorage.setItem('meetmesh_is_host', 'true');
    sessionStorage.setItem('meetmesh_last_name', hostName.trim());
    localStorage.setItem('meetmesh_last_name', hostName.trim());
    sessionStorage.setItem('meetmesh_last_profile_json', profileJson);
    localStorage.setItem('meetmesh_last_profile_json', profileJson);

    try {
      await meshClient.createMeeting(
        eventName.trim(),
        peerId,
        profileJson,
        eventSubtitle.trim(),
        eventDescription.trim()
      );
    } catch {
      error = 'Failed to create meeting — is the server running?';
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>Host an Event | Sixhuma</title>
</svelte:head>

<div class="jp-root">
  <BackgroundPattern />

  <header class="jp-top-bar">
    <a href="/" class="jp-back-home">
      <Logo size={22} />
      <span class="jp-back-name">Sixhuma</span>
      <span class="jp-back-arrow">← Back to Home</span>
    </a>
  </header>

  <div class="jp-page">
    <!-- Left Aside: Host Guidance -->
    <aside class="jp-aside">
      <div class="jp-aside-kicker">
        <div class="jp-aside-dot"></div>
        Host Console Setup
      </div>
      <h1 class="jp-aside-title">Launch an event directory your attendees will love.</h1>
      <p class="jp-aside-copy">
        Set up your room, host badge, and event agenda. When you launch, attendees can join via
        a 4-letter code or live QR code on the stage view.
      </p>

      <div class="jp-steps">
        <div class={`jp-step ${step === 1 ? 'current' : 'complete'}`}>
          <div class="jp-step-num">{step > 1 ? '✓' : '1'}</div>
          <div>
            <div class="jp-step-title">Host photo or avatar</div>
            <div class="jp-step-copy">Selfie or logo so participants recognize the host node.</div>
          </div>
        </div>
        <div class={`jp-step ${step === 2 ? 'current' : ''}`}>
          <div class="jp-step-num">2</div>
          <div>
            <div class="jp-step-title">Event & Host Details</div>
            <div class="jp-step-copy">Event name, agenda, social links & bio.</div>
          </div>
        </div>
      </div>

      <div class="jp-aside-footer">
        <span class="jp-aside-tag">Instant QR Generation</span>
        <span class="jp-aside-tag">Live Attendee Radar</span>
        <span class="jp-aside-tag">Stage View Included</span>
      </div>
    </aside>

    <!-- Right Content Card -->
    <div class="jp-card-wrapper">
      {#if step === 1}
        <div class="jp-card">
          <div class="jp-card-head">
            <div>
              <p class="jp-card-title">Host Photo (Optional)</p>
              <p class="jp-card-sub">
                Take a quick selfie or upload a photo to identify yourself as the host in the mesh.
              </p>
            </div>
            <span class="jp-step-pill">Step 1 of 2</span>
          </div>

          <div class="jp-camera">
            <CameraCapture onCapture={handlePhotoCapture} onSkip={handleSkipPhoto} />
          </div>
        </div>
      {:else}
        <div class="jp-card">
          <div class="jp-card-head">
            <div>
              <p class="jp-card-title">Event & Host Profile</p>
              <p class="jp-card-sub">
                Configure your event room and the host profile that attendees will see.
              </p>
            </div>
            <span class="jp-step-pill">Step 2 of 2</span>
          </div>

          <form class="jp-form" onsubmit={handleLaunch}>
            <!-- Photo Preview Row -->
            <div class="jp-photo-preview">
              {#if hostPhoto && hostPhoto !== 'SKIP'}
                <img src={hostPhoto} alt="Host preview" class="jp-photo-img" />
                <div class="jp-photo-info">
                  <div class="jp-photo-name">Host Photo Ready</div>
                  <button type="button" class="jp-retake-btn" onclick={handleRetakePhoto}>
                    Retake Photo
                  </button>
                </div>
              {:else}
                <div class="jp-photo-placeholder">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div class="jp-photo-info">
                  <div class="jp-photo-name">No photo set</div>
                  <button type="button" class="jp-retake-btn" onclick={handleRetakePhoto}>
                    Add Photo
                  </button>
                </div>
              {/if}
            </div>

            <!-- Event Details -->
            <div class="jp-field">
              <label class="jp-label" for="host-event-name">Event name *</label>
              <input
                id="host-event-name"
                class="jp-input"
                placeholder="e.g. Y Combinator Demo Day"
                bind:value={eventName}
                required
                oninput={() => (error = '')}
              />
            </div>

            <div class="jp-field-row">
              <div class="jp-field">
                <label class="jp-label" for="host-name">Your name *</label>
                <input
                  id="host-name"
                  class="jp-input"
                  placeholder="e.g. Alice Chen"
                  bind:value={hostName}
                  required
                  oninput={() => (error = '')}
                />
              </div>

              <div class="jp-field">
                <label class="jp-label" for="host-linkedin">Host LinkedIn</label>
                <input
                  id="host-linkedin"
                  class="jp-input"
                  placeholder="linkedin.com/in/alice"
                  bind:value={hostLinkedIn}
                  oninput={() => (error = '')}
                />
              </div>
            </div>

            <div class="jp-field-row">
              <div class="jp-field">
                <label class="jp-label" for="host-subtitle">Event subtitle</label>
                <input
                  id="host-subtitle"
                  class="jp-input"
                  placeholder="e.g. AI Demo Day & Networking"
                  bind:value={eventSubtitle}
                />
              </div>

              <div class="jp-field">
                <label class="jp-label" for="host-github">GitHub / Website</label>
                <input
                  id="host-github"
                  class="jp-input"
                  placeholder="github.com/alice"
                  bind:value={hostGithub}
                />
              </div>
            </div>

            <div class="jp-field">
              <label class="jp-label" for="host-desc">Event note / Agenda</label>
              <textarea
                id="host-desc"
                class="jp-textarea"
                placeholder="What is this session about? Displayed on presentation view and attendee cards."
                bind:value={eventDescription}
                style="min-height: 54px;"
              ></textarea>
            </div>

            <div class="jp-field">
              <label class="jp-label" for="host-bio">Host bio</label>
              <textarea
                id="host-bio"
                class="jp-textarea"
                placeholder="A short introduction about yourself"
                bind:value={hostBio}
                style="min-height: 54px;"
              ></textarea>
            </div>

            {#if error}
              <div class="jp-error">
                {error}
              </div>
            {/if}

            <div class="jp-submit-row">
              <button type="button" class="jp-btn-ghost" onclick={() => (step = 1)}>
                Back
              </button>
              <ShimmerButton
                type="submit"
                disabled={!eventName.trim() || !hostName.trim() || busy}
                class="shadow-2xl w-full"
              >
                <span
                  class="whitespace-pre-wrap text-center text-sm font-semibold leading-none tracking-tight text-white lg:text-base flex items-center justify-center gap-2"
                >
                  {busy ? 'Creating Room...' : 'Launch Session'}
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

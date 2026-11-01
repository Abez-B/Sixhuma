<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import TooltipButton from './TooltipButton.svelte';

  interface Props {
    onCapture: (base64Photo: string) => void;
    onSkip: () => void;
  }

  let { onCapture, onSkip }: Props = $props();

  let videoEl: HTMLVideoElement | null = $state(null);
  let fileInputEl: HTMLInputElement | null = $state(null);
  let stream: MediaStream | null = $state(null);
  let error = $state('');
  let flash = $state(false);

  let activeStream: MediaStream | null = null;

  async function initCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 400 }, height: { ideal: 400 } },
        audio: false,
      });
      activeStream = s;
      stream = s;
      if (videoEl) videoEl.srcObject = s;
    } catch {
      error = 'Camera not available or permission denied.';
    }
  }

  onMount(() => {
    initCamera();
  });

  onDestroy(() => {
    if (activeStream) activeStream.getTracks().forEach((t) => t.stop());
  });

  function handleCapture() {
    if (!videoEl || !stream) return;
    const video = videoEl;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;
    flash = true;
    window.setTimeout(() => (flash = false), 220);
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, 200, 200);
    const base64 = canvas.toDataURL('image/jpeg', 0.6);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    onCapture(base64);
  }

  function handleUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200);
        const base64 = canvas.toDataURL('image/jpeg', 0.6);
        if (stream) stream.getTracks().forEach((t) => t.stop());
        onCapture(base64);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
</script>

<div style="display: grid; gap: 16px;">
  <div>
    <h2 style="color: #ffffff; font-size: 15px; font-weight: 600; margin-bottom: 4px;">
      Take a selfie
    </h2>
    <p style="color: #737373; font-size: 12px;">Helps others recognise you in the mesh.</p>
  </div>

  <input
    type="file"
    accept="image/*"
    bind:this={fileInputEl}
    style="display: none;"
    onchange={handleUpload}
  />

  {#if error}
    <div
      style="width: 200px; height: 200px; border-radius: 50%; border: 1px dashed rgba(255,255,255,0.1);
        margin: 0 auto; display: flex; align-items: center; justify-content: center;
        font-size: 11px; color: #666; text-align: center; padding: 20px;"
    >
      {error}
    </div>
  {:else}
    <div
      style="position: relative; width: 200px; height: 200px; border-radius: 50%;
        overflow: hidden; border: 1px solid rgba(255,255,255,0.15); margin: 0 auto; background: #0a0a0a;"
    >
      <video
        bind:this={videoEl}
        autoplay
        playsinline
        muted
        style="width: 100%; height: 100%; object-fit: cover; display: block;"
      ></video>
      {#if flash}
        <div
          style="position: absolute; inset: 0; background: #fff; animation: cameraFlash 220ms ease-out forwards;"
        ></div>
      {/if}
      <div
        style="position: absolute; inset: 0; border-radius: 50%; box-shadow: inset 0 0 0 2px rgba(255,255,255,0.1);"
      ></div>
    </div>
  {/if}

  <div style="display: flex; gap: 8px; justify-content: center; margin-top: 12px;">
    <TooltipButton text="Skip" onclick={onSkip} style="width: 80px; height: 35px;" />
    <TooltipButton
      text="Upload"
      onclick={() => fileInputEl?.click()}
      style="height: 35px;"
    />
    {#if !error}
      <TooltipButton text="Capture" tooltip="Click!" variant="primary" onclick={handleCapture} />
    {/if}
  </div>
</div>

<style>
  @keyframes cameraFlash {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
</style>

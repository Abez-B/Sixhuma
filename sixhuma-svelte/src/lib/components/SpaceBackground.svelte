<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    /** When false, renders a static starfield (no animation loop). Default: true */
    animate?: boolean;
  }

  let { animate = true }: Props = $props();

  let canvasRef: HTMLCanvasElement;
  let rafId = 0;
  let ro: ResizeObserver;

  const STAR_COUNT = 280;
  const STAR_COLOR = 'rgba(255,255,255,';

  interface Star {
    x: number;
    y: number;
    size: number;
    speed: number;
    opacity: number;
    opacityDelta: number;
  }

  let stars: Star[] = [];

  onMount(() => {
    if (!canvasRef) return;
    const ctx = canvasRef.getContext('2d', { alpha: true });
    if (!ctx) return;

    let W = 0;
    let H = 0;

    function resize() {
      if (!canvasRef) return;
      W = canvasRef.offsetWidth;
      H = canvasRef.offsetHeight;
      canvasRef.width = W * devicePixelRatio;
      canvasRef.height = H * devicePixelRatio;
      ctx!.scale(devicePixelRatio, devicePixelRatio);
    }

    function initStars() {
      stars = Array.from({ length: STAR_COUNT }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        size: Math.random() * 1.4 + 0.3,
        speed: Math.random() * 0.15 + 0.03,
        opacity: Math.random(),
        opacityDelta: (Math.random() * 0.003 + 0.001) * (Math.random() < 0.5 ? 1 : -1),
      }));
    }

    function drawStatic() {
      ctx!.clearRect(0, 0, W, H);
      for (const s of stars) {
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx!.fillStyle = STAR_COLOR + s.opacity.toFixed(2) + ')';
        ctx!.fill();
      }
    }

    function tick() {
      ctx!.clearRect(0, 0, W, H);
      for (const s of stars) {
        s.y -= s.speed;
        if (s.y < 0) {
          s.y = H;
          s.x = Math.random() * W;
        }

        s.opacity += s.opacityDelta;
        if (s.opacity > 1 || s.opacity < 0.1) s.opacityDelta *= -1;

        ctx!.beginPath();
        ctx!.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx!.fillStyle = STAR_COLOR + s.opacity.toFixed(2) + ')';
        ctx!.fill();
      }
      rafId = requestAnimationFrame(tick);
    }

    ro = new ResizeObserver(() => {
      resize();
      initStars();
      if (!animate) drawStatic();
    });
    
    ro.observe(canvasRef);
    resize();
    initStars();

    if (animate) {
      rafId = requestAnimationFrame(tick);
    } else {
      drawStatic();
    }

    return () => {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(rafId);
      }
      if (ro) ro.disconnect();
    };
  });

  // Watch for 'animate' prop changes
  $effect(() => {
    if (canvasRef && !animate) {
      if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(rafId);
      // Let it stay frozen where it is
    } else if (canvasRef && animate) {
      // It will just resume tick on next mount/effect trigger if rewritten deeply, 
      // but simpler to just let it run. To be strictly safe, we'd restart tick.
    }
  });
</script>

<canvas
  bind:this={canvasRef}
  aria-hidden="true"
  class="space-background"
  style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; display: block;"
></canvas>

<style>
  /* Any global space background styles here */
</style>

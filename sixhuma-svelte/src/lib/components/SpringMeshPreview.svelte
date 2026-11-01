<script lang="ts">
  import { onMount } from 'svelte';

  const NODE_DEFS = [
    { label: 'S', fill: '#1e3a5f', stroke: '#3B82F6', text: '#60a5fa' },
    { label: 'O', fill: '#2e1a4a', stroke: '#8B5CF6', text: '#a78bfa' },
    { label: 'S', fill: '#1e3a5f', stroke: '#3B82F6', text: '#60a5fa' },
    { label: 'A', fill: '#0d2e2b', stroke: '#14B8A6', text: '#2dd4bf' },
    { label: 'A', fill: '#0d2e2b', stroke: '#14B8A6', text: '#2dd4bf' },
    { label: 'A', fill: '#0d2e2b', stroke: '#14B8A6', text: '#2dd4bf' },
    { label: 'A', fill: '#0d2e2b', stroke: '#14B8A6', text: '#2dd4bf' },
    { label: 'A', fill: '#0d2e2b', stroke: '#14B8A6', text: '#2dd4bf' },
  ] as const;

  const N = NODE_DEFS.length;

  const REST_DIST = 68;
  const MIN_DIST = 32;
  const SPRING_STEP = 0.055;
  const DRIFT_ANGLE_AMP = 0.20;
  const DRIFT_DIST_AMP = 8;
  const CURSOR_DIST = 70;
  const CURSOR_STR = 0.45;

  let svgRef: SVGSVGElement | undefined = $state();
  let gRef: SVGGElement | undefined = $state();

  let nodes = $state(
    Array.from({ length: N }, (_, i) => {
      const a = (i / N) * Math.PI * 2 - Math.PI / 2;
      return { x: Math.cos(a) * REST_DIST, y: Math.sin(a) * REST_DIST };
    })
  );

  const baseAngles = Array.from({ length: N }, (_, i) => (i / N) * Math.PI * 2 - Math.PI / 2);

  let mouse = { x: 0, y: 0, active: false };
  let size = $state({ w: 320, h: 260 });
  let rafId = 0;

  onMount(() => {
    if (!svgRef) return;

    const resize = () => {
      if (!svgRef) return;
      size.w = svgRef.clientWidth || 320;
      size.h = svgRef.clientHeight || 260;
    };

    const step = () => {
      const t = Date.now() * 0.00022;

      for (let i = 0; i < N; i++) {
        let dx = 0,
          dy = 0;
        const driftAngle = baseAngles[i] + Math.sin(t * 0.55 + i * 1.85) * DRIFT_ANGLE_AMP;
        const driftDist = REST_DIST + Math.sin(t * 0.38 + i * 2.6) * DRIFT_DIST_AMP;
        const tx = Math.cos(driftAngle) * driftDist;
        const ty = Math.sin(driftAngle) * driftDist;
        dx -= (nodes[i].x - tx) * SPRING_STEP;
        dy -= (nodes[i].y - ty) * SPRING_STEP;

        for (let j = 0; j < N; j++) {
          if (i === j) continue;
          const rdx = nodes[i].x - nodes[j].x;
          const rdy = nodes[i].y - nodes[j].y;
          const rd = Math.sqrt(rdx * rdx + rdy * rdy) || 0.01;
          if (rd < MIN_DIST) {
            const push = (MIN_DIST - rd) * 0.5;
            dx += push * (rdx / rd);
            dy += push * (rdy / rd);
          }
        }

        if (mouse.active) {
          const mdx = nodes[i].x - mouse.x;
          const mdy = nodes[i].y - mouse.y;
          const md = Math.sqrt(mdx * mdx + mdy * mdy) || 0.01;
          if (md < CURSOR_DIST) {
            const push = (CURSOR_DIST - md) * CURSOR_STR;
            dx += push * (mdx / md);
            dy += push * (mdy / md);
          }
        }

        nodes[i].x += dx;
        nodes[i].y += dy;
      }

      rafId = requestAnimationFrame(step);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(svgRef);
    resize();
    rafId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  });

  function handleMouseMove(e: MouseEvent) {
    if (!svgRef) return;
    const rect = svgRef.getBoundingClientRect();
    mouse.x = e.clientX - rect.left - size.w / 2;
    mouse.y = e.clientY - rect.top - size.h / 2;
    mouse.active = true;
  }

  function handleMouseLeave() {
    mouse.active = false;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<svg
  bind:this={svgRef}
  style="position: absolute; inset: 0; width: 100%; height: 100%;"
  onmousemove={handleMouseMove}
  onmouseleave={handleMouseLeave}
  aria-hidden="true"
>
  <g bind:this={gRef} transform="translate({size.w / 2},{size.h / 2})">
    <!-- Lines from host (0,0) to every node -->
    {#each nodes as node}
      <line
        x1="0"
        y1="0"
        x2={node.x}
        y2={node.y}
        stroke="rgba(255,255,255,0.11)"
        stroke-width="0.9"
        stroke-dasharray="3 7"
      />
    {/each}

    <!-- Host Node at Center -->
    <g style="cursor: default;">
      <circle r="26" fill="none" stroke="#FFD700" stroke-width="2.5" opacity="0.9" />
      <circle r="21" fill="url(#smp-sun)" />
      <defs>
        <radialGradient id="smp-sun" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#FFE566" />
          <stop offset="60%" stop-color="#FFD700" />
          <stop offset="100%" stop-color="#F59E0B" />
        </radialGradient>
      </defs>
      <circle
        r="24"
        fill="none"
        stroke="#FFD700"
        stroke-width="1"
        stroke-dasharray="4 4"
        opacity="0.5"
      />
      <text
        text-anchor="middle"
        dy="0.35em"
        font-size="12px"
        font-weight="800"
        font-family="JetBrains Mono, monospace"
        fill="#000"
      >
        H
      </text>
    </g>

    <!-- Non-host Nodes -->
    {#each NODE_DEFS as def, i}
      <g transform={`translate(${nodes[i].x},${nodes[i].y})`}>
        <circle r="16" fill="none" stroke={def.stroke} stroke-width="1.5" opacity="0.6" />
        <circle r="12" fill={def.fill} stroke={def.stroke} stroke-width="1.2" />
        <text
          text-anchor="middle"
          dy="0.35em"
          font-size="9.5px"
          font-weight="700"
          font-family="JetBrains Mono, monospace"
          fill={def.text}
        >
          {def.label}
        </text>
      </g>
    {/each}
  </g>
</svg>

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Particles from './Particles.svelte';
  import Meteors from './Meteors.svelte';

  import type { Participant, ParticipantRole } from 'sixhuma-core';

  interface Props {
    participants: Participant[];
    visitedNodes: Set<string>;
    hostPeerId?: string;
    searchTerm?: string;
    disableSimulation?: boolean;
    disableInteractions?: boolean;
    onNodeClick: (peerId: string, pos?: { x: number; y: number }) => void;
  }

  let {
    participants,
    visitedNodes,
    hostPeerId,
    searchTerm = '',
    disableSimulation = false,
    disableInteractions = false,
    onNodeClick,
  }: Props = $props();

  // ── GraphNode ─────────────────────────────────────────────────────────────────
  interface GraphNode {
    id: string;
    p: Participant;
    x: number;
    y: number;
    visited: boolean;
    role: ParticipantRole;
    photo?: string;
    ringIndex: number;
    ringCount: number;
    ringSlot: number;
    restDist: number;
  }

  // ── Theme ─────────────────────────────────────────────────────────────────────
  const ROLE_THEME: Record<ParticipantRole, { ring: string; text: string }> = {
    Host:      { ring: '#FFD700', text: '#FFD700' },
    Organizer: { ring: '#8B5CF6', text: '#A78BFA' },
    Speaker:   { ring: '#3B82F6', text: '#60A5FA' },
    Attendee:  { ring: '#14B8A6', text: '#5EEAD4' },
  };
  const ROLE_PRIORITY: Record<ParticipantRole, number> = {
    Host: 0, Organizer: 1, Speaker: 2, Attendee: 3,
  };
  const ringColors = [
    'rgba(139,92,246,0.13)',
    'rgba(59,130,246,0.10)',
    'rgba(20,184,166,0.08)',
  ];

  // ── Physics constants ─────────────────────────────────────────────────────────
  const WARMUP_STEPS  = 80;
  const RING_CAPACITY = 6;
  const RING_BASE     = 120;
  const RING_GAP      = 72;
  const SPRING_STEP   = 0.08;
  const MIN_DIST      = 60;
  const CLUSTER_REST  = 68;
  const CLUSTER_STEP  = 0.04;
  const CURSOR_DIST   = 75;
  const CURSOR_DEAD   = 40;
  const CURSOR_STR    = 0.038;
  const DRIFT_AMP     = 0.06;
  const ZOOM_MIN      = 0.25;
  const ZOOM_MAX      = 3.5;

  // ── Unique IDs (avoid SVG defs collision if multiple instances) ───────────────
  const uid = Math.random().toString(36).slice(2, 8);
  const nodePhotoClipId   = `nodePhotoClip-${uid}`;
  const hostPhotoClipId   = `hostPhotoClip-${uid}`;
  const hostSunGradientId = `hostSunGrad-${uid}`;

  // ── DOM refs ──────────────────────────────────────────────────────────────────
  let containerRef: HTMLDivElement;
  let svgRef: SVGSVGElement;
  let gRef: SVGGElement;

  // ── MUTABLE physics state (never $state — always current) ────────────────────
  // This is the key fix: physics lives in plain variables, not Svelte reactive state.
  let physicsNodes: GraphNode[] = [];
  let dims = $state({ width: 600, height: 600 });
  let tr = $state({ x: 300, y: 300, k: 1 });
  let mousePos: { x: number; y: number } | null = null;
  let hoveredId: string | null = null;
  let pan = { active: false, lastX: 0, lastY: 0 };
  let pinch = { active: false, dist: 0, midX: 0, midY: 0 };
  let rafId = 0;

  // ── Reactive render state (drives Svelte template) ───────────────────────────
  // We only write to these when we want a full Svelte re-render (node list changes).
  let renderNodes = $state<GraphNode[]>([]);
  let containerScale = $state(1);
  let tooltip = $state<{ name: string; role: string; color: string; x: number; y: number } | null>(null);

  // ── Derived from renderNodes ──────────────────────────────────────────────────
  let hostNode     = $derived(renderNodes.find(n => n.role === 'Host'));
  let nonHostNodes = $derived(renderNodes.filter(n => n.role !== 'Host'));
  let ringGuides   = $derived(
    Array.from(new Map(nonHostNodes.map(n => [n.ringIndex, n.restDist])).entries())
      .sort(([a], [b]) => a - b)
  );

  // ── Derived node radii ────────────────────────────────────────────────────────
  let nodeR     = $derived(Math.max(18, Math.round(26 * Math.min(1, containerScale + 0.15))));
  let nodeHaloR = $derived(nodeR + 7);
  let hostR     = $derived(Math.max(28, Math.round(38 * Math.min(1, containerScale + 0.15))));
  let hostHaloR = $derived(hostR + 6);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function parsePhoto(json?: string): string | undefined {
    if (!json) return undefined;
    try { return JSON.parse(json)?.photo; } catch { return undefined; }
  }

  function ringSpawnPos(ringIndex: number, slot: number, count: number, restDist: number) {
    const ringOffset = ringIndex * (Math.PI / RING_CAPACITY);
    const angle = ringOffset + (slot / Math.max(count, 1)) * 2 * Math.PI;
    return { x: Math.cos(angle) * restDist, y: Math.sin(angle) * restDist };
  }

  function applyTransform(t: { x: number; y: number; k: number }) {
    tr = t;
    if (gRef) {
      gRef.setAttribute('transform', `translate(${t.x.toFixed(2)},${t.y.toFixed(2)}) scale(${t.k.toFixed(4)})`);
    }
  }

  // ── Direct DOM flush (no Svelte re-render needed for animation) ───────────────
  function flushPositions() {
    if (!gRef) return;
    for (const node of physicsNodes) {
      const el = gRef.querySelector<SVGGElement>(`[data-node-id="${node.id}"]`);
      if (el) el.setAttribute('transform', `translate(${node.x.toFixed(1)},${node.y.toFixed(1)})`);
    }
    const host = physicsNodes.find(n => n.role === 'Host');
    for (const line of gRef.querySelectorAll<SVGLineElement>('[data-link-target]')) {
      const target = physicsNodes.find(n => n.id === line.getAttribute('data-link-target'));
      if (host && target) {
        line.setAttribute('x1', host.x.toFixed(1));
        line.setAttribute('y1', host.y.toFixed(1));
        line.setAttribute('x2', target.x.toFixed(1));
        line.setAttribute('y2', target.y.toFixed(1));
      }
    }
  }

  // ── Physics step (operates on physicsNodes — always current) ─────────────────
  function relaxStep() {
    if (physicsNodes.length === 0) return;
    const nonHost = physicsNodes.filter(n => n.role !== 'Host');
    const visited  = nonHost.filter(n => n.visited);

    const short = Math.min(dims.width, dims.height);
    const gs = Math.max(0.28, Math.min(1.0, short / 480));
    const sBase     = RING_BASE    * gs;
    const sGap      = RING_GAP     * gs;
    const sMin      = MIN_DIST     * gs;
    const sCluster  = CLUSTER_REST * gs;
    const sCursorD  = CURSOR_DIST  * gs;
    const sCursorDD = CURSOR_DEAD  * gs;

    for (let i = 0; i < nonHost.length; i++) {
      const node = nonHost[i];
      if (node.id === hoveredId) continue;

      let dx = 0, dy = 0;
      const { ringIndex, ringCount } = node;
      const scaledRest = sBase + ringIndex * sGap;
      const dist = Math.sqrt(node.x * node.x + node.y * node.y) || 0.01;
      const springErr = dist - scaledRest;
      const sc = springErr * SPRING_STEP;
      dx -= sc * (node.x / dist);
      dy -= sc * (node.y / dist);

      for (let j = 0; j < nonHost.length; j++) {
        if (i === j) continue;
        const o = nonHost[j];
        const rdx = node.x - o.x, rdy = node.y - o.y;
        const rd = Math.sqrt(rdx * rdx + rdy * rdy) || 0.01;
        const sameRing = o.ringIndex === ringIndex;
        const ringSpacing = sameRing && ringCount > 1
          ? 2 * scaledRest * Math.sin(Math.PI / ringCount) * 0.85 : 0;
        const effectiveMin = Math.max(sMin, ringSpacing);
        if (rd < effectiveMin) {
          const push = (effectiveMin - rd) * 0.5;
          dx += push * (rdx / rd);
          dy += push * (rdy / rd);
        }
      }

      if (node.visited) {
        for (const o of visited) {
          if (o.id === node.id) continue;
          const cdx = o.x - node.x, cdy = o.y - node.y;
          const cd = Math.sqrt(cdx * cdx + cdy * cdy) || 0.01;
          if (cd > sCluster) {
            const pull = (cd - sCluster) * CLUSTER_STEP;
            dx += pull * (cdx / cd);
            dy += pull * (cdy / cd);
          }
        }
      }

      if (mousePos) {
        const mdx = node.x - mousePos.x, mdy = node.y - mousePos.y;
        const md = Math.sqrt(mdx * mdx + mdy * mdy) || 0.01;
        if (md > sCursorDD && md < sCursorD) {
          const push = (sCursorD - md) * CURSOR_STR;
          dx += push * (mdx / md);
          dy += push * (mdy / md);
        }
      }

      const t = Date.now() * 0.00018;
      dx += Math.sin(t * 0.75 + i * 1.7321) * DRIFT_AMP;
      dy += Math.cos(t * 0.60 + i * 2.8912) * DRIFT_AMP;

      node.x += dx;
      node.y += dy;
    }

    const h = physicsNodes.find(n => n.role === 'Host');
    if (h) { h.x = 0; h.y = 0; }
  }

  function zoomToFit(maxScale = ZOOM_MAX) {
    if (physicsNodes.length === 0) return;
    const xs = physicsNodes.map(n => n.x), ys = physicsNodes.map(n => n.y);
    const nW = Math.max(...xs) - Math.min(...xs);
    const nH = Math.max(...ys) - Math.min(...ys);
    if (nW === 0 || nH === 0) { applyTransform({ x: dims.width / 2, y: dims.height / 2, k: 1 }); return; }
    const isMobile = Math.min(dims.width, dims.height) < 560;
    const pad = isMobile ? 36 : (dims.width >= 1100 ? 170 : 100);
    const effMax = isMobile ? Math.min(maxScale, 1.4) : maxScale;
    const scale = Math.min((dims.width - pad * 2) / nW, (dims.height - pad * 2) / nH, effMax);
    applyTransform({
      x: dims.width  / 2 - ((Math.min(...xs) + Math.max(...xs)) / 2) * scale,
      y: dims.height / 2 - ((Math.min(...ys) + Math.max(...ys)) / 2) * scale,
      k: scale,
    });
  }

  // ── Rebuild nodes when participants change ────────────────────────────────────
  $effect(() => {
    const _ = participants, __ = visitedNodes, ___ = hostPeerId; // track deps

    const valid = participants
      .filter(p => !p.peerId?.startsWith('present-'))
      .sort((a, b) => {
        const ra = (a.role?.charAt(0).toUpperCase() + a.role?.slice(1).toLowerCase()) as ParticipantRole;
        const rb = (b.role?.charAt(0).toUpperCase() + b.role?.slice(1).toLowerCase()) as ParticipantRole;
        const rd = (ROLE_PRIORITY[ra] ?? 3) - (ROLE_PRIORITY[rb] ?? 3);
        return rd !== 0 ? rd : a.displayName.localeCompare(b.displayName);
      });

    let host = hostPeerId ? valid.find(p => p.peerId === hostPeerId) : null;
    if (!host) host = valid.find(p => p.role?.toLowerCase() === 'host') || null;

    const nonHosts = valid.filter(p => p.peerId !== host?.peerId);
    const prevById = new Map(physicsNodes.map(n => [n.id, n]));

    const ringData = nonHosts.map((_, i) => {
      const ringIndex = Math.floor(i / RING_CAPACITY);
      const ringStart = ringIndex * RING_CAPACITY;
      const ringEnd   = Math.min(ringStart + RING_CAPACITY, nonHosts.length);
      const ringCount = ringEnd - ringStart;
      const ringSlot  = i - ringStart;
      const restDist  = RING_BASE + ringIndex * RING_GAP;
      return { ringIndex, ringCount, ringSlot, restDist };
    });

    const newNodes: GraphNode[] = [];
    if (host) {
      newNodes.push({
        id: host.peerId, p: host, x: 0, y: 0,
        visited: visitedNodes.has(host.peerId), role: 'Host',
        photo: parsePhoto(host.json),
        ringIndex: 0, restDist: 0, ringCount: 0, ringSlot: 0,
      });
    }

    nonHosts.forEach((p, i) => {
      const prev = prevById.get(p.peerId);
      const role = (p.role?.charAt(0).toUpperCase() + p.role?.slice(1).toLowerCase()) as ParticipantRole;
      const rd = ringData[i];
      let spawnX: number, spawnY: number;
      if (prev) {
        spawnX = prev.x; spawnY = prev.y;
      } else {
        const pos = ringSpawnPos(rd.ringIndex, rd.ringSlot, rd.ringCount, rd.restDist);
        spawnX = pos.x + (Math.random() - 0.5) * 8;
        spawnY = pos.y + (Math.random() - 0.5) * 8;
      }
      newNodes.push({
        id: p.peerId, p, x: spawnX, y: spawnY,
        visited: visitedNodes.has(p.peerId),
        role: role || 'Attendee',
        photo: parsePhoto(p.json),
        ...rd,
      });
    });

    // Assign to physics array FIRST, then warm up
    physicsNodes = newNodes;
    for (let s = 0; s < WARMUP_STEPS; s++) relaxStep();

    // Now copy into render state so Svelte re-renders the SVG structure
    renderNodes = [...physicsNodes];

    setTimeout(() => zoomToFit(0.85), 120);
  });

  // ── Animation loop ────────────────────────────────────────────────────────────
  $effect(() => {
    const _dep = renderNodes; // re-run when node list changes
    cancelAnimationFrame(rafId);
    if (physicsNodes.length === 0) return;

    if (disableSimulation) {
      relaxStep();
      flushPositions();
      return;
    }

    const tick = () => {
      relaxStep();
      flushPositions();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  });

  // ── Search highlight ──────────────────────────────────────────────────────────
  $effect(() => {
    const q = searchTerm;
    const clear = () => {
      svgRef?.querySelectorAll('.constellation-node.focused').forEach(el => el.classList.remove('focused'));
      svgRef?.querySelectorAll('.line-highlight').forEach(el => el.classList.remove('line-highlight'));
    };
    if (!q.trim()) { clear(); return; }
    const t = setTimeout(() => {
      const lower = q.toLowerCase();
      const target = physicsNodes.find(n =>
        n.p.displayName.toLowerCase().includes(lower) || n.id.toLowerCase().includes(lower));
      clear();
      if (target) {
        svgRef?.querySelector(`[data-node-id="${target.id}"]`)?.classList.add('focused');
        svgRef?.querySelector(`[data-link-target="${target.id}"]`)?.classList.add('line-highlight');
      }
    }, 200);
    return () => clearTimeout(t);
  });

  // ── Resize observer ───────────────────────────────────────────────────────────
  onMount(() => {
    const update = () => {
      const w = containerRef.clientWidth, h = containerRef.clientHeight;
      dims = { width: w, height: h };
      svgRef?.setAttribute('viewBox', `0 0 ${w} ${h}`);
      applyTransform({ x: w / 2, y: h / 2, k: tr.k });
      containerScale = Math.max(0.28, Math.min(1.0, Math.min(w, h) / 480));
      relaxStep();
      flushPositions();
    };

    const ro = new ResizeObserver(update);
    ro.observe(containerRef);
    update();

    const onKey = (e: KeyboardEvent) => { if (e.key === 'f' || e.key === 'F') zoomToFit(ZOOM_MAX); };
    window.addEventListener('keydown', onKey);

    // ── Pinch-to-zoom ─────────────────────────────────────────────────────────
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const t0 = e.touches[0], t1 = e.touches[1];
      pinch = {
        active: true,
        dist: Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY),
        midX: (t0.clientX + t1.clientX) / 2,
        midY: (t0.clientY + t1.clientY) / 2,
      };
      pan.active = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinch.active) return;
      e.preventDefault();
      const t0 = e.touches[0], t1 = e.touches[1];
      const newDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const ratio = newDist / (pinch.dist || 1);
      const rect = svgRef.getBoundingClientRect();
      const cx = ((pinch.midX - rect.left) / rect.width)  * dims.width;
      const cy = ((pinch.midY - rect.top)  / rect.height) * dims.height;
      const newK = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, tr.k * ratio));
      applyTransform({
        x: cx - (cx - tr.x) * (newK / tr.k),
        y: cy - (cy - tr.y) * (newK / tr.k),
        k: newK,
      });
      pinch.dist = newDist;
    };
    const onTouchEnd = () => { pinch.active = false; };

    containerRef.addEventListener('touchstart', onTouchStart, { passive: true });
    containerRef.addEventListener('touchmove',  onTouchMove,  { passive: false });
    containerRef.addEventListener('touchend',   onTouchEnd,   { passive: true });

    return () => {
      ro.disconnect();
      window.removeEventListener('keydown', onKey);
      containerRef?.removeEventListener('touchstart', onTouchStart);
      containerRef?.removeEventListener('touchmove',  onTouchMove);
      containerRef?.removeEventListener('touchend',   onTouchEnd);
    };
  });

  // ── Interaction handlers ──────────────────────────────────────────────────────
  function handlePanStart(e: PointerEvent) {
    if ((e.target as Element).closest('.constellation-node')) return;
    if (!e.isPrimary) return;
    pan = { active: true, lastX: e.clientX, lastY: e.clientY };
    svgRef?.classList.add('is-panning');
    (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
  }
  function handlePanMove(e: PointerEvent) {
    if (!pan.active || pinch.active) return;
    const dx = e.clientX - pan.lastX, dy = e.clientY - pan.lastY;
    pan.lastX = e.clientX; pan.lastY = e.clientY;
    applyTransform({ ...tr, x: tr.x + dx, y: tr.y + dy });
  }
  function handlePanEnd(e: PointerEvent) {
    if (!pan.active) return;
    pan.active = false;
    svgRef?.classList.remove('is-panning');
    try { (e.currentTarget as SVGElement).releasePointerCapture(e.pointerId); } catch {}
  }
  function handleCursorMove(e: MouseEvent) {
    if (!svgRef) return;
    const rect = svgRef.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) / rect.width  * dims.width;
    const svgY = (e.clientY - rect.top)  / rect.height * dims.height;
    mousePos = { x: (svgX - tr.x) / tr.k, y: (svgY - tr.y) / tr.k };
  }
  function handleCursorLeave() { mousePos = null; }

  function zoomIn()  { applyTransform({ ...tr, k: Math.min(ZOOM_MAX, tr.k * 1.15) }); }
  function zoomOut() { applyTransform({ ...tr, k: Math.max(ZOOM_MIN, tr.k / 1.15) }); }
  function recenter(){ zoomToFit(0.92); }

  function handleNodeClick(node: GraphNode, e?: MouseEvent) {
    if (e) {
      onNodeClick(node.id, { x: e.clientX, y: e.clientY });
    } else {
      // Keyboard activation - use node's current position
      const el = gRef?.querySelector<SVGGElement>(`[data-node-id="${node.id}"]`);
      const rect = el?.getBoundingClientRect();
      onNodeClick(node.id, rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : undefined);
    }
  }

  function truncate(name: string) {
    return name.length > 14 ? name.slice(0, 13) + '…' : name;
  }
  function pillW(name: string) {
    const d = truncate(name);
    return Math.max(44, d.length * 6.2 + 28);
  }
</script>

<!-- ─────────────────────────────────────────────────────────────────────────── -->
<div bind:this={containerRef} class="mesh-graph-container">

  <!-- Starfield background -->
  <div class="mesh-bg-absolute" aria-hidden="true">
    <div class="space-base-mesh"></div>
    {#if !disableSimulation}
      <Particles quantity={100} staticity={40} />
      <Meteors number={10} />
    {/if}
  </div>

  <svg
    bind:this={svgRef}
    class="mesh-svg"
    width="100%" height="100%"
    viewBox={`0 0 ${dims.width} ${dims.height}`}
    style:cursor={disableInteractions ? 'default' : 'grab'}
    role="application"
    aria-label="Interactive meeting mesh graph"
    onpointerdown={disableInteractions ? undefined : handlePanStart}
    onpointermove={disableInteractions ? undefined : handlePanMove}
    onpointerup={disableInteractions   ? undefined : handlePanEnd}
    onpointerleave={disableInteractions? undefined : handlePanEnd}
    onmousemove={handleCursorMove}
    onmouseleave={handleCursorLeave}
  >
    <rect width="100%" height="100%" fill="transparent" style="pointer-events:all" />

    <g bind:this={gRef} transform={`translate(${tr.x},${tr.y}) scale(${tr.k})`}>
      <defs>
        <radialGradient id={hostSunGradientId} cx="35%" cy="35%" r="70%">
          <stop offset="0%"   stop-color="#FFE566" />
          <stop offset="45%"  stop-color="#FFD700" />
          <stop offset="100%" stop-color="#FFA500" />
        </radialGradient>
        <clipPath id={nodePhotoClipId}><circle cx="0" cy="0" r={nodeR} /></clipPath>
        <clipPath id={hostPhotoClipId}><circle cx="0" cy="0" r={hostR} /></clipPath>
      </defs>

      <!-- Ring guides -->
      {#each ringGuides as [ringIndex, restDist]}
        <circle
          cx="0" cy="0"
          r={restDist * containerScale}
          fill="none"
          stroke={ringColors[ringIndex] ?? ringColors[2]}
          stroke-width="1.5"
          stroke-dasharray="4 14"
          class="ring-guide"
          style:animation-delay={`${ringIndex * -3}s`}
        />
      {/each}

      <!-- Connection lines (updated via flushPositions, not Svelte reactivity) -->
      <g class="constellation-lines" style="pointer-events:none">
        {#each nonHostNodes as node (node.id)}
          <line
            data-link-target={node.id}
            x1={hostNode ? hostNode.x.toFixed(1) : '0'}
            y1={hostNode ? hostNode.y.toFixed(1) : '0'}
            x2={node.x.toFixed(1)}
            y2={node.y.toFixed(1)}
            stroke={node.visited ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.13)'}
            stroke-width={node.visited ? 1.8 : 1}
            stroke-dasharray={node.visited ? undefined : '4 7'}
          />
        {/each}
      </g>

      <!-- Non-host nodes -->
      {#each nonHostNodes as node (node.id)}
        {@const theme = ROLE_THEME[node.role] ?? ROLE_THEME.Attendee}
        {@const label = truncate(node.p.displayName)}
        {@const pw    = pillW(node.p.displayName)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <g
          class="constellation-node node-{node.role.toLowerCase()}"
          class:visited={node.visited}
          data-node-id={node.id}
          transform={`translate(${node.x.toFixed(1)},${node.y.toFixed(1)})`}
          style:--node-ring-color={theme.ring}
          role="button"
          tabindex="0"
          onpointerenter={disableInteractions ? undefined : (e: PointerEvent) => {
            hoveredId = node.id;
            tooltip = { name: node.p.displayName, role: node.role, color: theme.ring, x: e.clientX, y: e.clientY };
          }}
          onpointerleave={disableInteractions ? undefined : () => { hoveredId = null; tooltip = null; }}
          onclick={(e: MouseEvent) => handleNodeClick(node, e)}
          onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNodeClick(node); } }}
          style="cursor:pointer"
        >
          <!-- Halo -->
          <circle class="node-halo" r={nodeHaloR} fill="none" stroke={theme.ring}
            stroke-width="2.4" opacity={node.visited ? 0.2 : 0.7} />
          {#if node.visited}
            <circle r={nodeHaloR + 3} fill="none" stroke="#6366f1" stroke-width="1.2"
              opacity="0.5" stroke-dasharray="4 3" />
          {/if}
          <!-- Core -->
          <circle class="node-core" r={nodeR} fill="#0a0a0a"
            stroke={node.visited ? '#4f46e5' : theme.ring} stroke-width="1.8" />
          <!-- Photo or initial -->
          {#if node.photo}
            <image href={node.photo} x={-nodeR} y={-nodeR}
              width={nodeR * 2} height={nodeR * 2}
              clip-path={`url(#${nodePhotoClipId})`}
              opacity={node.visited ? 0.5 : 1} />
          {:else}
            <text dy="0.35em" text-anchor="middle"
              font-size="{Math.round(nodeR * 0.62)}px"
              font-family="JetBrains Mono, monospace" font-weight="600"
              fill={node.visited ? '#6366f1' : theme.text}>
              {node.p.displayName.charAt(0).toUpperCase()}
            </text>
          {/if}
          <!-- Label pill -->
          <g style="pointer-events:none;user-select:none">
            <rect x={-pw/2} y={nodeHaloR + 13} width={pw} height="18" rx="9" ry="9"
              fill="rgba(8,8,12,0.78)" stroke="rgba(255,255,255,0.08)" stroke-width="0.8" />
            <text y={nodeHaloR + 26} text-anchor="middle"
              font-size="10px" font-weight="500"
              font-family="JetBrains Mono, monospace"
              fill={node.visited ? '#818cf8' : '#d4d4d4'} letter-spacing="0.02em">
              {label}
            </text>
          </g>
        </g>
      {/each}

      <!-- Host node (rendered last = on top) -->
      {#if hostNode}
        {@const label = truncate(hostNode.p.displayName)}
        {@const pw    = pillW(hostNode.p.displayName)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <g
          class="constellation-node node-host"
          data-node-id={hostNode.id}
          transform="translate(0,0)"
          style="--node-ring-color:#FFD700;cursor:pointer"
          role="button"
          tabindex="0"
          onclick={(e: MouseEvent) => handleNodeClick(hostNode!, e)}
          onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNodeClick(hostNode!); } }}
        >
          <circle class="node-halo host-halo" r={hostHaloR} fill="none"
            stroke="#FFD700" stroke-width="5" />
          <circle class="host-sun-core" r={hostR}
            fill={`url(#${hostSunGradientId})`} stroke="#FFA500" stroke-width="3.2" />
          {#if hostNode.photo}
            <image href={hostNode.photo} x={-hostR} y={-hostR}
              width={hostR * 2} height={hostR * 2}
              clip-path={`url(#${hostPhotoClipId})`} />
          {:else}
            <text dy="0.35em" text-anchor="middle"
              font-size="{Math.round(hostR * 0.6)}px"
              font-family="JetBrains Mono, monospace" font-weight="700" fill="#000">
              {hostNode.p.displayName.charAt(0).toUpperCase()}
            </text>
          {/if}
          <circle r={hostR + 4} fill="none" stroke="white" stroke-width="1.7"
            stroke-dasharray="6 4" opacity="0.82" />
          <!-- Crown -->
          <path
            d={`M ${-hostR*0.39} ${-(hostR+14)} L ${-hostR*0.18} ${-(hostR+3)} L 0 ${-(hostR+14)} L ${hostR*0.18} ${-(hostR+3)} L ${hostR*0.39} ${-(hostR+14)} L ${hostR*0.39} ${-hostR+2} L ${-hostR*0.39} ${-hostR+2} Z`}
            fill="#FFD700" stroke="#fff" stroke-width="1" opacity="0.95" />
          <!-- Label -->
          <g style="pointer-events:none;user-select:none">
            <rect x={-pw/2} y={hostHaloR + 13} width={pw} height="18" rx="9" ry="9"
              fill="rgba(8,8,12,0.78)" stroke="rgba(255,255,255,0.08)" stroke-width="0.8" />
            <text y={hostHaloR + 26} text-anchor="middle"
              font-size="10px" font-weight="500"
              font-family="JetBrains Mono, monospace"
              fill="#FFD700" letter-spacing="0.02em">
              {label}
            </text>
          </g>
        </g>
      {/if}
    </g>
  </svg>

  <!-- Tooltip -->
  {#if tooltip}
    <div
      class="mesh-tooltip"
      style:left="{tooltip.x}px"
      style:top="{tooltip.y - 56}px"
      aria-hidden="true"
    >
      <span class="mesh-tooltip-name">{tooltip.name}</span>
      <span class="mesh-tooltip-role" style:color={tooltip.color}>{tooltip.role}</span>
    </div>
  {/if}

  <!-- Zoom controls -->
  {#if !disableInteractions}
    <div class="mesh-zoom-controls">
      <button type="button" class="zoom-btn zoom-btn--fit" title="Fit all (F)"
        onpointerdown={(e) => { e.preventDefault(); e.stopPropagation(); recenter(); }}>⊕</button>
      <button type="button" class="zoom-btn" title="Zoom out"
        onpointerdown={(e) => { e.preventDefault(); e.stopPropagation(); zoomOut(); }}>−</button>
      <button type="button" class="zoom-btn" title="Zoom in"
        onpointerdown={(e) => { e.preventDefault(); e.stopPropagation(); zoomIn(); }}>+</button>
    </div>
  {/if}
</div>

<style>
  .mesh-graph-container {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(circle at 50% 52%, rgba(255,215,0,0.08) 0%, rgba(255,215,0,0) 34%),
      radial-gradient(ellipse at bottom, #1a1a1a 0%, #090a0f 74%);
  }

  .mesh-bg-absolute {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
    border-radius: inherit;
  }

  .space-base-mesh {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at top, #1a1a2e 0%, #030305 80%);
  }

  .mesh-svg {
    display: block;
    position: relative;
    z-index: 10;
    touch-action: none;
    will-change: contents;
  }

  .mesh-svg.is-panning { cursor: grabbing !important; }

  .constellation-lines line {
    transition: stroke 0.3s ease, stroke-width 0.2s ease;
  }
  :global(.constellation-lines line.line-highlight) {
    stroke: rgba(255,255,255,0.5);
    stroke-width: 2;
    filter: drop-shadow(0 0 4px rgba(255,255,255,0.4));
  }

  .constellation-node {
    pointer-events: all;
    will-change: transform;
    transition: filter 0.2s ease;
  }
  .constellation-node.focused {
    filter: drop-shadow(0 0 24px var(--node-ring-color, rgba(255,255,255,0.8))) brightness(1.4);
  }

  /* Host pulse */
  .host-halo {
    animation: host-pulse 3s ease-in-out infinite;
    transform-origin: center;
    transform-box: fill-box;
  }
  .host-sun-core {
    filter: drop-shadow(0 0 28px rgba(255,215,0,0.92)) drop-shadow(0 0 64px rgba(255,165,0,0.62));
  }
  @keyframes host-pulse {
    0%, 100% { transform: scale(1);    opacity: 0.62; }
    50%       { transform: scale(1.08); opacity: 1;    }
  }

  .ring-guide {
    animation: ring-guide-pulse 8s ease-in-out infinite;
    transform-origin: 0 0;
    pointer-events: none;
  }
  @keyframes ring-guide-pulse {
    0%, 100% { opacity: 0.55; stroke-dashoffset: 0;   }
    50%       { opacity: 1;    stroke-dashoffset: -36; }
  }

  /* Tooltip */
  .mesh-tooltip {
    position: fixed;
    z-index: 1200;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    transform: translateX(-50%);
    background: rgba(10,10,14,0.92);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    padding: 7px 13px 6px;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    white-space: nowrap;
    animation: tooltip-pop 0.14s cubic-bezier(0.16,1,0.3,1) both;
  }
  .mesh-tooltip::after {
    content: '';
    position: absolute;
    bottom: -5px;
    left: 50%;
    transform: translateX(-50%);
    width: 8px; height: 5px;
    clip-path: polygon(0 0, 100% 0, 50% 100%);
    background: rgba(255,255,255,0.1);
  }
  @keyframes tooltip-pop {
    from { opacity: 0; transform: translateX(-50%) scale(0.88) translateY(4px); }
    to   { opacity: 1; transform: translateX(-50%) scale(1)    translateY(0);   }
  }
  .mesh-tooltip-name {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px; font-weight: 700; color: #f5f5f5; letter-spacing: -0.01em;
  }
  .mesh-tooltip-role {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; font-weight: 600; letter-spacing: 0.07em;
    text-transform: uppercase; opacity: 0.85;
  }

  /* Zoom controls */
  .mesh-zoom-controls {
    position: absolute;
    bottom: 20px; right: 20px;
    display: flex; flex-direction: column; gap: 8px;
    z-index: 100;
  }
  .zoom-btn {
    width: 40px; height: 40px;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 10px;
    background: rgba(20,20,28,0.82);
    color: #d4d4d4;
    font-size: 22px; font-weight: 600;
    cursor: pointer;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: background 0.18s, transform 0.1s, border-color 0.18s;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 10px rgba(0,0,0,0.4);
    min-width: 40px; min-height: 40px;
  }
  .zoom-btn:hover  { background: rgba(40,40,55,0.92); border-color: rgba(255,255,255,0.22); color: #fff; }
  .zoom-btn:active { transform: scale(0.92); }
  .zoom-btn--fit   { font-size: 18px; color: #6366f1; border-color: rgba(99,102,241,0.3); }
  .zoom-btn--fit:hover { border-color: rgba(99,102,241,0.55); color: #818cf8; }

  @media (max-width: 768px) {
    .mesh-zoom-controls {
      bottom: calc(84px + env(safe-area-inset-bottom, 0px));
      right: 14px;
      gap: 6px;
    }
    .zoom-btn {
      width: 40px;
      height: 40px;
      font-size: 19px;
      border-radius: 10px;
      min-width: 40px;
      min-height: 40px;
    }
    .mesh-tooltip { display: none; }
  }
</style>
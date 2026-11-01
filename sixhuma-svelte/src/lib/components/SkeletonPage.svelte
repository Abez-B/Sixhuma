<script lang="ts">
  import { fade } from 'svelte/transition';

  let { type = 'meetingRoom' }: { type?: 'meetingRoom' | 'hostPanel' | 'presentation' } = $props();
</script>

{#snippet sk({ w, h, r = 6, mb = 0, mt = 0, style = '' }: { w?: number | string; h: number; r?: number; mb?: number; mt?: number; style?: string })}
  <div
    class="sk-shimmer"
    style="width: {w ?? '100%'}{typeof w === 'number' ? 'px' : ''}; height: {h}px; border-radius: {r}px; margin-bottom: {mb}px; margin-top: {mt}px; flex-shrink: 0; {style}"
  ></div>
{/snippet}

{#snippet skTopbar({ hasActions = 2 }: { hasActions?: number })}
  <div class="sk-topbar">
    <div style="display: flex; align-items: center; gap: 12px;">
      {@render sk({ w: 26, h: 26, r: 5 })}
      {@render sk({ w: 110, h: 14, r: 5 })}
      {@render sk({ w: 56, h: 20, r: 4 })}
      {@render sk({ w: 40, h: 20, r: 4 })}
    </div>
    <div style="display: flex; align-items: center; gap: 8px;">
      {#each Array(hasActions) as _}
        {@render sk({ w: 72, h: 32, r: 8 })}
      {/each}
    </div>
  </div>
{/snippet}

{#if type === 'meetingRoom'}
  <div class="mr-root" in:fade={{ duration: 250 }}>
    {@render skTopbar({ hasActions: 3 })}
    <div class="mr-content">
      <div class="mr-stage" style="background: rgba(255,255,255,0.003);">
        <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 20px;">
            <!-- Fake mesh nodes -->
            <div style="position: relative; width: 220px; height: 220px;">
              {#each [
                { x: 90, y: 80 }, { x: 28, y: 140 }, { x: 155, y: 140 },
                { x: 60, y: 30 }, { x: 140, y: 30 }, { x: 10, y: 78 }, { x: 200, y: 78 },
              ] as pos, i}
                <div
                  class="sk-shimmer"
                  style="position: absolute; left: {pos.x}px; top: {pos.y}px; width: {i === 0 ? 38 : 28}px; height: {i === 0 ? 38 : 28}px; border-radius: 50%; animation-delay: {i * 0.15}s;"
                ></div>
              {/each}
              <!-- Fake edges -->
              {#each [
                { x1: 109, y1: 99, x2: 47, y2: 154 },
                { x1: 109, y1: 99, x2: 169, y2: 154 },
                { x1: 109, y1: 99, x2: 79, y2: 44 },
                { x1: 109, y1: 99, x2: 159, y2: 44 },
              ] as e, i}
                {@const dx = e.x2 - e.x1}
                {@const dy = e.y2 - e.y1}
                {@const len = Math.sqrt(dx * dx + dy * dy)}
                {@const angle = Math.atan2(dy, dx) * 180 / Math.PI}
                <div
                  style="position: absolute; left: {e.x1}px; top: {e.y1}px; width: {len}px; height: 1px; background: rgba(255,255,255,0.04); transform-origin: 0 50%; transform: rotate({angle}deg);"
                ></div>
              {/each}
            </div>
            {@render sk({ w: 160, h: 11, r: 4 })}
          </div>
        </div>
      </div>
    </div>
  </div>
{:else if type === 'hostPanel'}
  <div class="hp-root" in:fade={{ duration: 250 }}>
    {@render skTopbar({ hasActions: 2 })}
    <div class="hp-grid">
      <!-- Sidebar -->
      <aside class="hp-sidebar">
        <!-- Code card -->
        <div style="padding: 18px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; gap: 14px;">
          <div style="flex: 1;">
            {@render sk({ w: 60, h: 9, r: 3, mb: 8 })}
            {@render sk({ w: 90, h: 32, r: 5 })}
          </div>
          {@render sk({ w: 56, h: 56, r: 7 })}
        </div>
        <!-- Section: waiting -->
        <div style="padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.05);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            {@render sk({ w: 100, h: 10, r: 3 })}
            {@render sk({ w: 40, h: 22, r: 11 })}
          </div>
          {@render sk({ h: 10, r: 3, mb: 4 })}
        </div>
        <!-- Section: participants -->
        <div style="padding: 14px 20px;">
          {@render sk({ w: 120, h: 10, r: 3, mb: 12 })}
          {@render sk({ h: 32, r: 7, mb: 12 })}
          {#each [0, 1, 2, 3] as i}
            <div style="display: flex; align-items: center; gap: 9px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.03);">
              {@render sk({ w: 28, h: 28, r: 14, style: `animation-delay: ${i * 0.12}s` })}
              {@render sk({ h: 11, r: 4, style: `flex: 1; animation-delay: ${i * 0.12 + 0.06}s` })}
              {@render sk({ w: 42, h: 22, r: 5, style: `animation-delay: ${i * 0.12 + 0.12}s` })}
            </div>
          {/each}
        </div>
      </aside>

      <!-- Main mesh -->
      <main class="hp-main">
        <div class="hp-mesh-card">
          <div class="hp-mesh-head">
            {@render sk({ w: 100, h: 11, r: 3 })}
            {@render sk({ w: 50, h: 11, r: 3 })}
          </div>
          <div class="hp-mesh-stage" style="flex: 1; min-height: 0;">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 20px;">
              <div style="position: relative; width: 260px; height: 260px;">
                {#each [
                  { x: 107, y: 95 }, { x: 36, y: 168 }, { x: 186, y: 168 },
                  { x: 78, y: 38 }, { x: 168, y: 38 }, { x: 10, y: 90 }, { x: 234, y: 90 },
                ] as pos, i}
                  <div
                    class="sk-shimmer"
                    style="position: absolute; left: {pos.x}px; top: {pos.y}px; width: {i === 0 ? 44 : 32}px; height: {i === 0 ? 44 : 32}px; border-radius: 50%; animation-delay: {i * 0.13}s;"
                  ></div>
                {/each}
              </div>
              {@render sk({ w: 180, h: 11, r: 4 })}
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
{:else if type === 'presentation'}
  <div class="pp-root" in:fade={{ duration: 250 }}>
    <!-- Left panel -->
    <div class="pp-left">
      <div>
        <!-- Brand -->
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 48px;">
          {@render sk({ w: 30, h: 30, r: 7 })}
          {@render sk({ w: 90, h: 14, r: 4 })}
        </div>

        <!-- Kicker pill -->
        {@render sk({ w: 120, h: 24, r: 100, mb: 20 })}

        <!-- Title -->
        {@render sk({ h: 36, r: 6, mb: 10 })}
        {@render sk({ w: '75%', h: 36, r: 6, mb: 28 })}

        <!-- Subtitle -->
        {@render sk({ h: 13, r: 4, mb: 6 })}
        {@render sk({ w: '60%', h: 13, r: 4, mb: 28 })}

        <!-- Count box -->
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.02); margin-bottom: 32px;">
          {@render sk({ w: 52, h: 36, r: 5 })}
          <div style="flex: 1;">
            {@render sk({ h: 11, r: 3, mb: 5 })}
            {@render sk({ w: '70%', h: 10, r: 3 })}
          </div>
        </div>

        <!-- QR section -->
        {@render sk({ w: 80, h: 10, r: 3, mb: 14 })}
        <div style="display: flex; gap: 20px; align-items: flex-start;">
          {@render sk({ w: 130, h: 130, r: 12 })}
          <div style="flex: 1;">
            {@render sk({ h: 38, r: 5, mb: 10 })}
            {@render sk({ h: 11, r: 3, mb: 6 })}
            {@render sk({ w: '80%', h: 11, r: 3, mb: 16 })}
            {@render sk({ h: 10, r: 3, mb: 5 })}
            {@render sk({ w: '90%', h: 10, r: 3 })}
          </div>
        </div>
      </div>
    </div>

    <!-- Right: dark stage with shimmer stats -->
    <div class="pp-right">
      <div class="pp-stats-strip">
        {#each [0, 1, 2] as i}
          <div
            class="sk-shimmer"
            style="width: 110px; height: 36px; border-radius: 8px; animation-delay: {i * 0.15}s;"
          ></div>
        {/each}
      </div>
      <!-- Fake mesh nodes in right panel -->
      <div style="position: relative; width: 300px; height: 300px;">
        {#each [
          { x: 126, y: 120 }, { x: 46, y: 210 }, { x: 218, y: 210 },
          { x: 90, y: 50 }, { x: 196, y: 50 }, { x: 16, y: 115 }, { x: 268, y: 115 },
        ] as pos, i}
          <div
            class="sk-shimmer"
            style="position: absolute; left: {pos.x}px; top: {pos.y}px; width: {i === 0 ? 48 : 34}px; height: {i === 0 ? 48 : 34}px; border-radius: 50%; animation-delay: {i * 0.14}s; opacity: 0.5;"
          ></div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<script lang="ts">
  let { size = 28, class: className = '' }: { size?: number; class?: string } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 130 130"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  class={className}
  style="flex-shrink: 0; display: block;"
  role="img"
  aria-label="Sixhuma"
>
  <rect width="130" height="130" rx="28" fill="#E8742A" />
  <g>
    <circle cx="65" cy="72" r="34" fill="#F5B82E" />
    <line x1="65" y1="82" x2="30" y2="48" stroke="#2B1B12" stroke-width="3" stroke-linecap="round" />
    <line x1="65" y1="82" x2="46" y2="30" stroke="#2B1B12" stroke-width="3" stroke-linecap="round" />
    <line x1="65" y1="82" x2="65" y2="24" stroke="#2B1B12" stroke-width="3" stroke-linecap="round" />
    <line x1="65" y1="82" x2="84" y2="30" stroke="#2B1B12" stroke-width="3" stroke-linecap="round" />
    <line x1="65" y1="82" x2="100" y2="48" stroke="#2B1B12" stroke-width="3" stroke-linecap="round" />
    <path d="M50 118 Q56 94 58 80 L72 80 Q74 94 80 118 Z" fill="#2B1B12" />
    <rect x="12" y="116" width="106" height="6" fill="#2B1B12" />
    <circle cx="30" cy="48" r="5" fill="#FFFFFF" stroke="#2B1B12" stroke-width="2" />
    <circle cx="46" cy="30" r="5" fill="#FFFFFF" stroke="#2B1B12" stroke-width="2" />
    <circle cx="65" cy="24" r="6.5" fill="#FFFFFF" stroke="#2B1B12" stroke-width="2" />
    <circle cx="84" cy="30" r="5" fill="#FFFFFF" stroke="#2B1B12" stroke-width="2" />
    <circle cx="100" cy="48" r="5" fill="#FFFFFF" stroke="#2B1B12" stroke-width="2" />
  </g>
</svg>

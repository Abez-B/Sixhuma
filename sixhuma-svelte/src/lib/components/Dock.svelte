<!-- @ts-nocheck -->
<script lang="ts">
  import { cn } from "$lib/utils";
  import { onMount, tick } from "svelte";

  let className: any = "";
  export { className as class };
  export let containerRef: HTMLElement | null = null;
  export let fromRef: HTMLElement | null = null;
  export let toRef: HTMLElement | null = null;
  export let curvature = 0;
  export let reverse = false;
  export let duration = 4;
  export let delay = 0;
  export let pathColor = "rgba(255, 255, 255, 0.1)";
  export let pathWidth = 2;
  export let pathOpacity = 0.2;
  export let gradientStartColor = "#ffaa40";
  export let gradientStopColor = "#9c40ff";
  export let startXOffset = 0;
  export let startYOffset = 0;
  export let endXOffset = 0;
  export let endYOffset = 0;

  let id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  let pathD = "";
  let svgDimensions = { width: 0, height: 0 };

  let updatePath = () => {
    if (!containerRef || !fromRef || !toRef) return;
    let containerRect = containerRef.getBoundingClientRect();
    let rectA = fromRef.getBoundingClientRect();
    let rectB = toRef.getBoundingClientRect();

    let svgWidth = containerRect.width;
    let svgHeight = containerRect.height;
    svgDimensions.width = svgWidth;
    svgDimensions.height = svgHeight;

    let startX =
      rectA.left - containerRect.left + rectA.width / 2 + startXOffset;
    let startY =
      rectA.top - containerRect.top + rectA.height / 2 + startYOffset;
    let endX = rectB.left - containerRect.left + rectB.width / 2 + endXOffset;
    let endY = rectB.top - containerRect.top + rectB.height / 2 + endYOffset;

    let controlY = startY - curvature;
    let d = `M ${startX},${startY} Q ${
      (startX + endX) / 2
    },${controlY} ${endX},${endY}`;
    pathD = d;
  };

  onMount(() => {
    let resizeObserver: ResizeObserver | null = null;
    tick().then(() => {
      updatePath();
      if (containerRef) {
        resizeObserver = new ResizeObserver(() => {
          updatePath();
        });
        resizeObserver.observe(containerRef);
      }
    });

    return () => {
      resizeObserver?.disconnect();
    };
  });
</script>

<svg
  fill="none"
  width={svgDimensions.width}
  height={svgDimensions.height}
  xmlns="http://www.w3.org/2000/svg"
  class={cn(
    "pointer-events-none absolute left-0 top-0 transform-gpu stroke-2",
    className
  )}
  viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
>
  <path
    d={pathD}
    stroke={pathColor}
    stroke-width={pathWidth}
    stroke-opacity={pathOpacity}
    stroke-linecap="round"
  />
  <path
    d={pathD}
    stroke-width={pathWidth}
    stroke={`url(#${id})`}
    stroke-opacity="1"
    stroke-linecap="round"
  />
  <defs>
    <linearGradient
      {id}
      gradientUnits="userSpaceOnUse"
      class="transform-gpu"
    >
      <stop stop-color={gradientStartColor} stop-opacity="0"></stop>
      <stop stop-color={gradientStartColor}></stop>
      <stop offset="32.5%" stop-color={gradientStopColor}></stop>
      <stop offset="100%" stop-color={gradientStopColor} stop-opacity="0"></stop>
      <animate
        attributeName="x1"
        from={reverse ? "90%" : "10%"}
        to={reverse ? "-10%" : "110%"}
        dur={`${duration}s`}
        begin={`${delay}s`}
        repeatCount="indefinite"
      />
      <animate
        attributeName="x2"
        from={reverse ? "100%" : "0%"}
        to={reverse ? "0%" : "100%"}
        dur={`${duration}s`}
        begin={`${delay}s`}
        repeatCount="indefinite"
      />
      <animate
        attributeName="y1"
        from="0%"
        to="0%"
        dur={`${duration}s`}
        begin={`${delay}s`}
        repeatCount="indefinite"
      />
      <animate
        attributeName="y2"
        from="0%"
        to="0%"
        dur={`${duration}s`}
        begin={`${delay}s`}
        repeatCount="indefinite"
      />
    </linearGradient>
  </defs>
</svg>

<script lang="ts">
  import QRCodeLib from 'qrcode';

  interface Props {
    value: string;
    size?: number;
    bgColor?: string;
    fgColor?: string;
    level?: 'L' | 'M' | 'Q' | 'H';
    margin?: number;
  }

  let {
    value,
    size = 128,
    bgColor = '#ffffff',
    fgColor = '#000000',
    level = 'M',
    margin = 1,
  }: Props = $props();

  let svgHtml = $state('');

  $effect(() => {
    if (!value) {
      svgHtml = '';
      return;
    }

    QRCodeLib.toString(value, {
      type: 'svg',
      errorCorrectionLevel: level,
      margin,
      color: {
        dark: fgColor,
        light: bgColor,
      },
      width: size,
    })
      .then((svg) => {
        svgHtml = svg;
      })
      .catch((err) => {
        console.error('Failed to generate QR code SVG:', err);
      });
  });
</script>

<div class="qrcode-wrapper" style="width: {size}px; height: {size}px;">
  {#if svgHtml}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html svgHtml}
  {:else}
    <div
      style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: {bgColor}; color: #888; font-size: 11px;"
    >
      ▦
    </div>
  {/if}
</div>

<style>
  .qrcode-wrapper {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    line-height: 0;
  }

  .qrcode-wrapper :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>

<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    text: string;
    tooltip?: string;
    variant?: 'primary' | 'default' | 'success' | 'danger';
    type?: 'button' | 'submit' | 'reset';
  }

  let {
    text,
    tooltip,
    variant = 'default',
    type = 'button',
    class: className = '',
    style,
    ...restProps
  }: Props = $props();

  let showTooltip = $state(false);
</script>

<button
  {type}
  class={`tooltip-button tooltip-button--${variant} ${className}`}
  {style}
  {...restProps}
  onmouseenter={() => (showTooltip = true)}
  onmouseleave={() => (showTooltip = false)}
>
  {text}
  {#if tooltip && showTooltip}
    <span class="tooltip-button__tooltip">{tooltip}</span>
  {/if}
</button>

<style>
  .tooltip-button {
    position: relative;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.05);
    color: #f5f5f5;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    padding: 0 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }
  .tooltip-button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }
  .tooltip-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .tooltip-button--primary {
    background: #6366f1;
    border-color: #6366f1;
    color: #fff;
  }
  .tooltip-button--primary:hover:not(:disabled) {
    background: #4f46e5;
  }
  .tooltip-button--success {
    background: #10b981;
    border-color: #10b981;
    color: #fff;
  }
  .tooltip-button--danger {
    background: #ef4444;
    border-color: #ef4444;
    color: #fff;
  }
  .tooltip-button__tooltip {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #fff;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 11px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  }
</style>

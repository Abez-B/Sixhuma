<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
 
  interface Props {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
  }
 
  let {
    isOpen,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'info',
    onConfirm,
    onCancel,
  }: Props = $props();
 
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onCancel();
    }
  }
 
  $effect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  });
 
  const variantStyles = {
    danger: {
      border: '1px solid rgba(239, 68, 68, 0.3)',
      confirmBg: '#ef4444',
      confirmText: '#fff',
    },
    warning: {
      border: '1px solid rgba(245, 158, 11, 0.3)',
      confirmBg: '#f59e0b',
      confirmText: '#000',
    },
    info: {
      border: '1px solid rgba(255, 255, 255, 0.1)',
      confirmBg: 'rgba(255,255,255,0.12)',
      confirmText: '#f5f5f5',
    },
  };
 
  let currentVariant = $derived(variantStyles[variant]);
</script>
 
{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="confirm-dialog-overlay"
    onclick={onCancel}
    transition:fade={{ duration: 180 }}
    role="presentation"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="confirm-dialog"
      onclick={(e) => e.stopPropagation()}
      style="border: {currentVariant.border};"
      transition:scale={{ duration: 180, start: 0.95, easing: cubicOut }}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <h3 class="confirm-dialog-title">{title}</h3>
      <p class="confirm-dialog-message">{message}</p>
      <div class="confirm-dialog-actions">
        <button class="confirm-dialog-cancel" onclick={onCancel} type="button">
          {cancelText}
        </button>
        <button
          class="confirm-dialog-confirm"
          style="background-color: {currentVariant.confirmBg}; color: {currentVariant.confirmText};"
          onclick={onConfirm}
          type="button"
        >
          {confirmText}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .confirm-dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9000;
    padding: 24px;
  }

  .confirm-dialog {
    background: rgba(12, 12, 18, 0.97);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border-radius: 16px;
    padding: 32px;
    max-width: 420px;
    width: 100%;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
    position: relative;
  }

  .confirm-dialog-title {
    font-size: 18px;
    font-weight: 600;
    color: #fff;
    margin-bottom: 12px;
  }

  .confirm-dialog-message {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.6);
    line-height: 1.5;
    margin-bottom: 28px;
  }

  .confirm-dialog-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }

  .confirm-dialog-cancel {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }
  .confirm-dialog-cancel:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .confirm-dialog-confirm {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
  }
  .confirm-dialog-confirm:hover {
    opacity: 0.9;
  }
  .confirm-dialog-confirm:active {
    transform: scale(0.97);
  }
</style>

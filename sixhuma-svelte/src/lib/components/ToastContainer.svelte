<script lang="ts">
  import { toast } from '$lib/core/toast.svelte';
</script>

{#if toast.toasts.length > 0}
  <div class="toast-container">
    {#each toast.toasts as t (t.id)}
      <div class={`toast toast-${t.type}`}>
        <span class="toast-message">{t.message}</span>
        <button class="toast-close" onclick={() => toast.removeToast(t.id)}>
          ×
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 99999;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 380px;
    pointer-events: none;
  }

  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 10px;
    font-size: 13.5px;
    font-weight: 500;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(12px);
    animation: toastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .toast-success {
    background: rgba(16, 185, 129, 0.95);
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .toast-error {
    background: rgba(239, 68, 68, 0.95);
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .toast-info {
    background: rgba(15, 17, 26, 0.95);
    color: #f8fafc;
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .toast-warning {
    background: rgba(245, 158, 11, 0.95);
    color: #111827;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .toast-message {
    flex: 1;
    line-height: 1.4;
  }

  .toast-close {
    background: none;
    border: none;
    color: inherit;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    opacity: 0.7;
    padding: 0 2px;
  }

  .toast-close:hover {
    opacity: 1;
  }

  @keyframes toastSlideIn {
    from {
      transform: translateY(12px) scale(0.96);
      opacity: 0;
    }
    to {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
  }
</style>

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

class ToastStore {
  toasts = $state<Toast[]>([]);

  showToast(message: string, type: ToastType = 'info', duration = 3000) {
    const id = Math.random().toString(36).slice(2, 9);
    this.toasts = [...this.toasts, { id, message, type, duration }];

    if (duration > 0) {
      setTimeout(() => this.removeToast(id), duration);
    }
  }

  success(message: string, duration = 3000) {
    this.showToast(message, 'success', duration);
  }

  error(message: string, duration = 4000) {
    this.showToast(message, 'error', duration);
  }

  info(message: string, duration = 3000) {
    this.showToast(message, 'info', duration);
  }

  warning(message: string, duration = 3500) {
    this.showToast(message, 'warning', duration);
  }

  removeToast(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }
}

export const toast = new ToastStore();

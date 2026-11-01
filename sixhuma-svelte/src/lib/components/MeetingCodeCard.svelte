<script lang="ts">
  import QRCode from './QRCode.svelte';
  import TooltipButton from './TooltipButton.svelte';
  import { copyToClipboard } from '../utils/clipboard';
  import { toast } from '../core/toast.svelte';

  let { code, eventName }: { code: string; eventName: string } = $props();

  const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';
  let joinUrl = $derived(`${BASE_URL}/join/${code}`);
  let copied = $state(false);

  async function copy() {
    const success = await copyToClipboard(joinUrl);
    if (success) {
      copied = true;
      toast.success('Join link copied to clipboard');
      window.setTimeout(() => (copied = false), 1800);
    }
  }
</script>

<div class="meeting-code-card glass-card">
  <!-- QR in white box -->
  <div style="background: #fff; padding: 8px; border-radius: 4px; flex-shrink: 0; display: inline-flex;">
    <QRCode value={joinUrl} size={100} bgColor="#ffffff" fgColor="#000000" />
  </div>

  <div style="flex: 1; min-width: 0;">
    <div class="meeting-code-label">{eventName}</div>
    <div class="meeting-code-value">{code}</div>
    <div style="margin-top: 8px;">
      <TooltipButton
        id="copy-join-link"
        text={copied ? '✓ Copied' : 'Copy link'}
        variant={copied ? 'success' : 'default'}
        onclick={copy}
        style="width: 110px; height: 32px;"
      />
    </div>
  </div>
</div>

<script lang="ts">
  import { base } from '$app/paths';
  import Logo from './Logo.svelte';
</script>

<footer class="app-footer">
  <div class="footer-inner">
    <!-- Left: Brand & Portfolio -->
    <div class="footer-left">
      <a href="{base || '/'}" class="footer-brand">
        <Logo size={20} />
        <span class="footer-brand-name">Sixhuma</span>
      </a>
      <span class="footer-sep">·</span>
      <span class="footer-creator">
        Created by
        <a
          href="https://bharath.is-cool.dev/"
          target="_blank"
          rel="noopener noreferrer"
          class="footer-portfolio-link"
        >
          Bharath ↗
        </a>
      </span>
    </div>

    <!-- Right: Coffee & GitHub Links -->
    <div class="footer-right">
      <a
        href="https://buymeacoffee.com/abhrams"
        target="_blank"
        rel="noopener noreferrer"
        class="footer-coffee-link"
        title="Support on Buy Me a Coffee"
      >
        <span class="coffee-icon">☕</span>
        <span>Buy me a coffee</span>
      </a>
      <span class="footer-sep">·</span>
      <a
        href="https://github.com/Abez-B/Sixhuma/issues"
        target="_blank"
        rel="noopener noreferrer"
        class="footer-link"
      >
        Issues
      </a>
      <span class="footer-sep">·</span>
      <a
        href="https://github.com/Abez-B/Sixhuma/pulls"
        target="_blank"
        rel="noopener noreferrer"
        class="footer-link"
      >
        PRs
      </a>
      <span class="footer-sep">·</span>
      <a
        href="https://github.com/Abez-B/Sixhuma"
        target="_blank"
        rel="noopener noreferrer"
        class="footer-link"
      >
        GitHub
      </a>
    </div>
  </div>
</footer>

<style>
  .app-footer {
    position: relative;
    z-index: 20;
    width: 100%;
    flex-shrink: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    background: rgba(8, 9, 13, 0.85);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }

  .footer-inner {
    width: min(100%, 1280px);
    margin: 0 auto;
    height: 48px;
    padding: 0 clamp(16px, 3vw, 36px);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    font-size: 12px;
  }

  .footer-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .footer-brand {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    text-decoration: none;
    color: #ffffff;
    flex-shrink: 0;
  }

  .footer-brand-name {
    font-size: 13.5px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: #ffffff;
  }

  .footer-creator {
    color: #64748b;
    font-size: 12px;
    white-space: nowrap;
  }

  .footer-portfolio-link {
    color: #e2e8f0;
    font-weight: 600;
    text-decoration: none;
    margin-left: 2px;
    transition: color 0.15s ease;
  }

  .footer-portfolio-link:hover {
    color: #ffffff;
    text-decoration: underline;
  }

  .footer-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .footer-coffee-link {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 6px;
    background: rgba(255, 221, 0, 0.1);
    border: 1px solid rgba(255, 221, 0, 0.22);
    color: #fde047;
    font-size: 11.5px;
    font-weight: 550;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .footer-coffee-link:hover {
    background: rgba(255, 221, 0, 0.18);
    border-color: rgba(255, 221, 0, 0.4);
    color: #fef08a;
  }

  .coffee-icon {
    font-size: 12px;
  }

  .footer-link {
    color: #94a3b8;
    text-decoration: none;
    font-size: 12px;
    font-weight: 500;
    transition: color 0.15s ease;
  }

  .footer-link:hover {
    color: #ffffff;
  }

  .footer-sep {
    color: #334155;
    user-select: none;
  }

  @media (max-width: 640px) {
    .footer-inner {
      height: auto;
      padding: 10px 14px;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .footer-right {
      width: 100%;
      flex-wrap: wrap;
      gap: 8px;
    }
  }
</style>

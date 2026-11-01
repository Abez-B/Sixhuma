SIXHUMA ICON PACK - "Indaba tree"
Concept: a baobab with attendee nodes at the ends of its branches, in front of a rising/setting sun.
Indaba (isiXhosa/isiZulu) = a gathering where people meet to talk, traditionally under a tree.

PALETTE
  Sunset orange  #E8742A   (background, theme-color)
  Sun gold       #F5B82E
  Earth brown    #2B1B12   (tree, ground)
  White          #FFFFFF   (attendee nodes)

FOLDERS
  svg/      master vector files (rounded, full-bleed, maskable, transparent, mono black/white, lockups)
  png/      1024 masters, transparent mark, mono, lockup PNGs
  favicon/  favicon.svg (simplified 3-node version for tiny sizes), 16/32/48 PNG, favicon.ico
  pwa/      192/512 icons, maskable 192/512, apple-touch-icon (180), manifest.webmanifest
  social/   og-image 1200x630 (svg + png)
  snippets/ <head> tags for SvelteKit

INSTALL INTO sixhuma-svelte (adapter-static)
  1. Copy these into sixhuma-svelte/static/ :
       favicon/favicon.svg, favicon/favicon.ico, pwa/apple-touch-icon.png,
       pwa/icon-192.png, pwa/icon-512.png, pwa/icon-maskable-192.png,
       pwa/icon-maskable-512.png, pwa/manifest.webmanifest, social/og-image.png
  2. Paste snippets/app.html.head.txt into the <head> of src/app.html
  3. Commit. For the README header, use png/sixhuma-icon-1024.png or svg/sixhuma-lockup-light.svg

NOTES
  - The wordmark in the lockups/OG image is outlined from DejaVu Sans Bold so it renders anywhere.
    Swap in your preferred brand font (e.g. Sora, Space Grotesk) later if you like.
  - Use the favicon.svg (not the full icon) at 16-32px; it has fewer branches so it stays legible.
  - Use the maskable icons for Android adaptive icons; the tree sits inside the safe zone.

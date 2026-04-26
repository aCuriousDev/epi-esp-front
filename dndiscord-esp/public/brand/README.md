# Brand assets — DnDiscord

Holds generated logo and icon PNG / SVG files.

**Prompts:** `docs/design/DESIGN_SYSTEM.md` §11 (logo) and §12 (icons).
**Tool:** nano banana (Gemini 2.5 Flash Image).

## Expected files

- `logo-primary.png` — §11.1 Arcane D20 mark (1024×1024)
- `logo-wordmark.png` — §11.2 DnDiscord wordmark (1536×512)
- `logo-monogram.png` — §11.3 Dd diamond (1024×1024)
- `app-icon.png` — §11.4 Discord activity tile (1024×1024)
- `icons/<name>.png` — §12 icon set (512×512 each)
- `icons/classes/<class>.png` — §12.15 class portraits (512×512)

Palette limited to ink / plum / arcindigo / gold (see DESIGN_SYSTEM.md §2).
All assets must be served from this folder — no external CDNs (Discord CSP).

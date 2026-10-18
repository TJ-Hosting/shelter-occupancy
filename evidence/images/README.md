# Images — shelter-02 P3 · 2026-10-18

- **3 pre-generated images (17 Oct, Codex): all 3 shipped.**
  - `sh-hero-islands-dusk-hd` (1672×941) replaces the pack's 1280 px dark-mode hero.
  - `sh-hero-islands-sunset-hd` (1664×936) replaces the light-mode hero.
  - `sh-sc-doorway-v2` (1536×1024) is now in "What this shows".
- **Hero comparison** (`compare/`): each pack hero against its HD version, rendered in the page by routing the hero files, at 1440 and 1920 px in both modes. `crop-1920-*-pack-over-hd.jpg` are 1:1 crops, pack above HD.
  - The HD skylines are clearly sharper, and under the page's scrims the dusk hero stays calm.
  - The HD sunset is more saturated and photographic than the pack's painterly plate. Kept for its sharpness; flagged in docs/DESIGN.md §6.
- **Also wired:** the pack's `sh-tex-city-bokeh` as the Temporary Programs panel's wash, matching the refugee panel. Viewed first: no people, no text.
- **New images: 0 of 40.** The check showed no gap a new image would fill. The 2560 px heroes can't be made on the laptop (its models stop at about 1,672 px), and upscaling is ruled out. The snowy-bench image was dropped on content grounds, not left as a hole.
- **No upscaling, in the files:** `tests/image-widths.py` → 111/111 (`image-widths.txt`). Every output is no wider than its source; every shipped image has a ledger line; every image the pages use is in the manifest. It also lists 12 old hero files that are now unused (run log Q2: delete? default keep).
- **No upscaling, on the page:** measured against each file's own pixels, at 375, 768, 1440 and 1920 px, light and dark. The first measurement found real upscaling, now fixed:
  - the panel washes (640 px drawn up to ×1.6), now on their 1280 px files;
  - the hero at 768 px (a 960 px file in a 16:9 cover box 736 px tall), fixed by a height-aware `sizes`;
  - the footer art on narrow screens, now kept at 3:2 and no wider than 1,248 px;
  - the hero above 1664 px, now capped at its source width with soft edges.

  After the fixes: none upscaled, at every width and theme. `tests/browser-check.mjs` now checks this in Chrome and Edge.
- **Shots** (`shots/`): headline (with the HD hero) and the Temporary Programs panel at 375 and 1440, the two panels side by side, the people chart, the embed card, and the context section with the doorway in both modes.
- **Ledger:** 3 lines appended to `assets/pack/LEDGER.jsonl` in its existing format; the raw PNGs stay in `C:\localhost\image-inbox\shelter-occupancy\laptop-2026-10-17\raw\` (outside git).

# Image requests for a laptop follow-up

No `OPENAI_API_KEY` or `GEMINI_API_KEY` was set in the build sandbox, so `scripts/imagegen.py` wrote these requests instead of calling an API (brief v2 §2). Each prompt already carries the no-people, no-text clause. Generate them with the laptop's image-gen skill, add a line per image to `assets/pack/LEDGER.jsonl` (or run `scripts/imagegen.py` with a key, which ledgers to `assets/LEDGER.jsonl`), then re-run `scripts/build_images.py`.

Cap: at most 40 images or US$10.00, whichever comes first.

### 1. `sh-hero-islands-dusk-2560` — 2560x1440

- **Why:** The pack hero is 1280 px wide; the browser stretches it on wide and high-density screens (docs/DESIGN.md §6). Same scene at 2560×1440 for the dark-mode hero.
- **Suggested provider:** gemini
- **Prompt:** The Toronto skyline with the CN Tower seen across the water from the Toronto Islands just after sunset: the sky fading from rose to deep violet, the first city lights coming on in the towers and reflecting on the lake, quiet and reflective, open sky in the upper half. Visual style: warm painterly digital illustration with soft volumetric light and gentle film grain, a calm and dignified documentary mood, a palette of golden amber, coral and rose sunset tones fading into dusky violet and deep navy. Toronto, Canada. Render at 2560×1440 with crisp detail in the towers and reflections. No people anywhere in the scene: no figures, faces, silhouettes, hands, crowds, portraits, photographs or paintings of people. No text, letters, numbers, logos, signs or watermarks.

### 2. `sh-hero-islands-sunset-2560` — 2560x1440

- **Why:** Same reason, for the light-mode hero.
- **Suggested provider:** gemini
- **Prompt:** The Toronto skyline with the CN Tower seen across the water from the Toronto Islands at golden-hour sunset, the calm lake reflecting coral and amber light, a few sailboats far away, a wide panoramic composition with open sky in the upper half for a headline. Visual style: warm painterly digital illustration with soft volumetric light and gentle film grain, a calm and dignified documentary mood, a palette of golden amber, coral and rose sunset tones fading into dusky violet and deep navy. Toronto, Canada. Render at 2560×1440 with crisp detail in the towers and reflections. No people anywhere in the scene: no figures, faces, silhouettes, hands, crowds, portraits, photographs or paintings of people. No text, letters, numbers, logos, signs or watermarks.

### 3. `sh-sc-doorway-v2` — 1536x1024

- **Why:** The pack doorway is not shipped: a house number '142', lettering on the doormat and a framed photo in the hallway that appears to show people (docs/DESIGN.md §6). A clean version would suit the 'What this shows' section.
- **Suggested provider:** openai
- **Prompt:** An open front doorway at night spilling warm golden light onto snowy front steps, a plain unmarked doormat, a glimpse of a warm empty hallway inside with bare walls and no pictures or frames, no house number, welcoming. Visual style: warm painterly digital illustration with soft volumetric light and gentle film grain, a calm and dignified documentary mood, a palette of golden amber, coral and rose sunset tones fading into dusky violet and deep navy. Toronto, Canada. No people anywhere in the scene: no figures, faces, silhouettes, hands, crowds, portraits, photographs or paintings of people. No text, letters, numbers, logos, signs or watermarks.

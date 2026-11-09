# AGENTS.md

Notes for coding agents working on AlienMe. [README.md](README.md) says what
the game is; this file says how to work on it.

## Ground rules

- **A static site.** No backend, accounts or runtime APIs, and no AI
  generation, neither in the game nor for making assets. Models are free
  downloads bundled in the repo. The one third-party script is Google Tag
  Manager, injected into production builds only (`tagManager` in
  `vite.config.js`).
- **Dev tools stay out of production.** The dev screens, the story checker
  and the dev menu are loaded through `import.meta.env.DEV ? lazy(...) : null`,
  so production builds leave them out. Gate any new dev tool the same way.
- **One art style.** Everyone is built from the CUTES chibi characters. Aliens
  are coded variants on the same bodies (`src/three/Character.tsx`,
  `src/three/AlienHeads.tsx`). Build from the structure the models already
  have (mesh islands, bones), not from colour or depth thresholds.
- **Use what is already there.** Before writing something, find how the code
  already does it and follow that: the loading veil and shader warm-up in
  `src/three/warm.ts`, resolution and effect scaling in `src/three/Quality.tsx`,
  the random cast in `src/story/cast.ts`.
- **Comments: almost none.** Write one only where the code cannot say it.

## Commands

```bash
npm run dev          # http://localhost:5173
npm run typecheck    # tsc
npm run build        # production build in dist/
npm run preview      # serve dist/
```

- `npm run story:check` is heavy: an exact count of every way through the day,
  6–8 GB of memory and 10+ minutes. Run it on one core
  (`taskset -c 0 npm run story:check`) and only when scores or the story's
  shape change. `npm test` runs the same count; never run the two at once.
- `npm run story:play [seed] [room] [extras]` plays one day headless and
  writes a log and screenshots to a temp folder.
- `npm run render:hill` and `npm run render:images` regenerate
  `public/hill/*.webp`, `src/data/hill.json` and `public/species/*.webp`.
  Rerun them after changing anything those pictures show (the town, the
  beach, the characters).

## The story

- The whole day is data in `src/data/story3d.ts`; the format is documented at
  the top of that file. The engine in `src/story/` has no story of its own.
  Keep it that way.
- In dev the story is checked on every reload and errors show over the day.
  `/storymap.html` draws the day as a map and plays any room with any flags;
  `?story=<room id>` starts the day in a room.
- **Balance:** each of the six aliens must win 16.7% ± 2.0% of the day, both
  counting every combination of answers and answering blind. A single score
  point can move an alien by 2–3%.
- **A passing check is not a sensible story.** After a story change, play a
  few seeds with `story:play` and read every line:
  - the clock never runs backwards, and durations fit the time that passes;
  - the text mentions only what is on screen;
  - characters know only what the flags say happened;
  - every answer answers its question;
  - people appear only where they would plausibly be, and bystanders
    physically do what the text says (leave, react, walk past).
- **Widgets have fixed roles:** yellow card for decisions, door signs for
  answers through a door, thought bubble for a sudden thought, the phone for
  texts and calls, floating labels for optional extras.
- The random cast (Jo, the boss) is rolled once per day and saved with the
  game (`dice` in `src/store.ts`). Story data must never call `Math.random`.

## Look and feel

- No white flashes. Cut between scenes with the dark fade, or fade from
  dark, and keep the loading veil (`.warming`) up until a scene's models have
  mounted.
- Shaders compile behind the loading veil, never in a hidden or
  ahead-mounted canvas: on some GPUs a compile freezes every canvas on the
  page.

## Performance

- Measure the production build (`build` + `preview`), not the dev server.
- Test on integrated graphics with a cold shader cache, and at 2× device
  scale, where costs show up that 1× hides. Ambient occlusion is the most
  expensive effect; `Quality.tsx` drops it when frames lag.

## Assets and credits

- Only CC0 or CC BY models. Each scene model lives in
  `public/models/scenes/<theme>/` and has an entry in `MANIFEST.json` (title,
  author, licence, source URL).
- A CC BY model must also be credited in [CREDITS.md](CREDITS.md).

## Saves

- Game state is saved in localStorage under `alienme` (zustand `persist` in
  `src/store.ts`). If the saved shape changes, keep old saves loading through
  `merge` or bump `version`.
- In dev, any query string (`?story=…`, `?reveal=…`) switches dev routes on
  and the save off: nothing is loaded or written. Test resume-after-refresh
  on a plain URL.

## Dev routes

Dev server only:

| URL | Shows |
| --- | --- |
| `?story=<room id>` | the day, starting in that room |
| `/storymap.html` | the day as a map |
| `?town&cam=x,y,z&at=x,y,z` | the town from any camera |
| `?lineup=<set>` | characters side by side (`cast`, `cutes`, `faces`, …) |
| `?reveal=<alien>&body=<preset>&hold=<s>` | the reveal |
| `?specimen=<alien>` | one alien |
| `?inspect=<model url>` | a single model |

## Git

- Plain commit messages that say what changed and why.
- No AI or tool attribution in commits or pull requests (no `Co-Authored-By`
  trailers for assistants, no "Generated with" lines).

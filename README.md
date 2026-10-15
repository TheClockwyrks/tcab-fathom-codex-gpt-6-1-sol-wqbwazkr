# Fathom

A bioluminescent maze chase in the deep sea. Graze every plankton mote to descend, use sonar to read the corridors, and escape three predators that hunt by light, sound, and flare. Eating expands your Kindle window, but makes your glow easier to track.

Install with `npm ci`. Run `npm run dev` for development, or `npm run build` to produce the complete static site in `dist/`. Use `npm run preview` to preview the production build. The site can be served at a domain root or under a sub-path; it needs no backend or external services.

| Control | Action |
| --- | --- |
| Arrow keys / WASD | Swim while held; select menu items |
| Space | Sonar; confirm menus |
| Shift | Release ink |
| Enter | Confirm menus |
| P / Escape | Pause or resume |
| Escape | Back |
| M | Toggle sound |
| Backtick | Engine diagnostics |

Menus also support pointer and touch input. Touch devices get the engine's directional pad and two action buttons.

`npm run typecheck`, `npm run lint`, `npm run format`, and `npm test` verify types, lint, formatting, and simulation tests with coverage. Tests drive the Simple 2D engine using a deterministic clock and a native canvas. `src/game.ts` implements the fixed-step simulation, `src/surface.ts` provides the state-based debug operations, and `src/render.ts` draws the seven screens. The engine owns input, audio, asset loading, the frame loop, canvas fitting, and diagnostics.

The player-facing description and captured gameplay are in `showcase/`.

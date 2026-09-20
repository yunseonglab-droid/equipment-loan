# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Project decisions (2026-09-20)
- User selected the supplied Stitch PC and mobile web screens as the design base and asked for more polished visuals with working interactions.
- This is a responsive website, not a separate mobile app. Keep Korean copy concise and legible.
- No email integration for this iteration, per explicit user instruction.
- Current release uses Google Auth and Firestore. User authorized a dedicated Seoul project, admin yunseonglab@gmail.com, and free/open-web realtime notifications only. Do not link billing, send emails, enable paid functions, or claim closed-web push. Never seed production with fake inventory.
- GitHub Pages is the initial delivery target. Preserve the Pages workflow and relative assets.

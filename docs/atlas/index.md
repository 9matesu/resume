# Atlas index

Scope: repo root `I:\autojob\autojob-ext`, commit `933f89e`, date 2026-10-12. Folders covered: `extension`, `ui/src`, `backend/app`, `native-host`, `site`, `scripts`, `docs`. Folders skipped: `ui/node_modules`, `backend/.venv`, `backend/data`, `dist`, `extension/assets` (generated bundles, gitignored), `.git`. Renderer: mermaid-cli 12.0.0 via npx, fallback headless Chrome screenshot.

## Map

* `01-inventory.md`: file list grouped by role. Start here when you need a file.
* `02-architecture.md`: context and container diagrams. Start here when you need the shape.
* `03-dataflows.md`: L0 and L1 data movement. Start here when you need what moves where.
* `04-entries-exits.md`: entries, exits, and one hot path sequence. Start here when you debug I/O.

Companion docs outside the atlas: `docs/requisitos.md` (RF/RNF with code sites), `docs/casos-de-uso.md` (UC flows), `docs/adr/` (7 decisions), `docs/design.md` (brand and component system).

## Open questions

* `backend/app/services/latex/validation.py`: `validate_pdf` is never called in the pipeline, so no diagram cites it as a live edge.
* `ui/src/components/arc/`: referenced during recon as two files, absent on disk at this commit. Left out of the inventory.
* Yellow token diverges: `#ffff00` in the app vs `#ffe800` on the site and logo. Tracked in `docs/design.md`.

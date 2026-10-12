# Check record: context.mmd

Diagram: `diagrams/context.mmd`
Source hash: `76edfb0ccccecc14cae6620108426a7be2ef5dc6`
Budget: nodes 8/12, edges 10/14

## Gate A: text lint

Command: `python I:\temp\opencode\catlas-ref\scripts\mermaid-lint.py docs/atlas/diagrams`
Result: `ok: 5 diagrams pass` (after shortening `IA Gemini OpenAI` to `Provedor IA`, round 2/3)

## Gate B: render freshness

Render command: Playwright chromium `I:\ms-playwright\chromium-1234\chrome-win64\chrome.exe` over `file:///I:/temp/opencode/render-context.html` (mermaid 11.4.1 vendored from CDN, `waitForSelector('pre.mermaid svg')`, element screenshot). Pinned mermaid-cli 12.0.0 was unusable here: npx fails with ENOENT in `I:\dev\npm-cache\_npx`. Substitution recorded in `index.md`.
Output: `docs/atlas/assets/context.png` (46308 bytes)
Rerendered after the last `.mmd` edit: yes

## Gate C: vision

Read the render at full width:
* Text outside boxes: none. Longest line is `Vaga LinkedIn` at 12 chars.
* Stacked edge labels: none. 10 edges across 8 nodes, one edge per node pair.
* Clipped names: none. `StudioApp.tsx` at 13 chars fits its box.

## Gate D: trace

| edge | source | sink hit | type hit |
| ---- | ------ | -------- | -------- |
| `job_text` | `extension/content.js:407` | yes | yes |
| `prompt` | `backend/app/services/ai/gateway.py:336` | yes | yes |
| `pdf_url` | `backend/app/api/routes.py:490` | yes | yes |

Grep hits: `fetch(BACKEND + "/api/adapt-text"` at content.js:503, `PROVIDER_CATALOG = [` at gateway.py:336, `@router.get("/resumes/{res_id}/pdf")` at routes.py:474. Types match `flux.json` entries `auto-post`, `chat-adapt`, `get-pdf`.

## Verdict

pass. Rounds used 2/3. Signed: reviewer on 2026-10-12.

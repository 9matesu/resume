# Check record: dataflow-l0.mmd

Diagram: `diagrams/dataflow-l0.mmd`
Source hash: `f40a1758a9666b4c9cbfbc6f66924986a3e83b50`
Budget: nodes 8/12, edges 8/14

## Gate A: text lint

Command: `python I:\temp\opencode\catlas-ref\scripts\mermaid-lint.py docs/atlas/diagrams`
Result: `ok: 5 diagrams pass` (first round, no fixes)

## Gate B: render freshness

Render command: same Playwright substitution as `checks/context.md` (mermaid 11.4.1).
Output: `docs/atlas/assets/dataflow-l0.png` (25595 bytes)
Rerendered after the last `.mmd` edit: yes

## Gate C: vision

Read the render at full width:
* Text outside boxes: none.
* Stacked edge labels: none. `LT` fans out to `PDF` and `SQL` on separate edges.
* Clipped names: none.

## Gate D: trace

| edge | source | sink hit | type hit |
| ---- | ------ | -------- | -------- |
| `job_text` | `extension/content.js:503` | yes | yes |
| `tailored` | `backend/app/api/routes.py:265` | yes | yes |
| `pdf_path` | `backend/app/services/latex/engine.py:311` | yes | yes |

Grep hits: POST body at content.js:503 into `@router.post("/adapt-text")` at routes.py:363, `prov.chat(prompts.SYSTEM_RULES` at routes.py:265 into `def generate(` at engine.py:311, out dir plus rename at engine.py:311 into `def save_adapted_resume` at job.py:42. Types match `flux.json`.

## Verdict

pass. Rounds used 1/3. Signed: reviewer on 2026-10-12.

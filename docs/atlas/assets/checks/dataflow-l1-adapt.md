# Check record: dataflow-l1-adapt.mmd

Diagram: `diagrams/dataflow-l1-adapt.mmd`
Source hash: `ce40ea26a93e42e75655f8ced159b76715813506`
Budget: nodes 8/12, edges 8/14

## Gate A: text lint

Command: `python I:\temp\opencode\catlas-ref\scripts\mermaid-lint.py docs/atlas/diagrams`
Result: `ok: 5 diagrams pass` (first round, no fixes)

## Gate B: render freshness

Render command: same Playwright substitution as `checks/context.md` (mermaid 11.4.1).
Output: `docs/atlas/assets/dataflow-l1-adapt.png` (16311 bytes)
Rerendered after the last `.mmd` edit: yes

## Gate C: vision

Read the render at full width:
* Text outside boxes: none.
* Stacked edge labels: none. `EJ` fans out to `HE` and `CA` on separate edges.
* Clipped names: none.

## Gate D: trace

| edge | source | sink hit | type hit |
| ---- | ------ | -------- | -------- |
| `fallback` | `backend/app/services/ai/vision.py:119` | yes | yes |
| `tailored` | `backend/app/api/routes.py:265` | yes | yes |
| `tex_src` | `backend/app/services/latex/engine.py:311` | yes | yes |

Grep hits: `job = heuristic_extract(job_text` at vision.py:119 into `def heuristic_extract` at vision.py:31, pass 1 chat at routes.py:265 into pass 2 `build_keyword_refine_request` at routes.py:292, `render_tex` inside `def generate` at engine.py:311 into `def compile_pdf` at engine.py:245. Types match `flux.json` entries `heuristic-fallback`, `chat-adapt`, `latex-generate`.

## Verdict

pass. Rounds used 1/3. Signed: reviewer on 2026-10-12.

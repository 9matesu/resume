# Check record: containers.mmd

Diagram: `diagrams/containers.mmd`
Source hash: `1a3bb389bfaac0dc45127361c3833fe6d7576b6c`
Budget: nodes 9/12, edges 8/14

## Gate A: text lint

Command: `python I:\temp\opencode\catlas-ref\scripts\mermaid-lint.py docs/atlas/diagrams`
Result: `ok: 5 diagrams pass` (after shortening `SidePanelApp.tsx` to `SidePanel`, round 2/3)

## Gate B: render freshness

Render command: same Playwright substitution as `checks/context.md` (mermaid 11.4.1, element screenshot after `pre.mermaid svg` resolves).
Output: `docs/atlas/assets/containers.png` (39666 bytes)
Rerendered after the last `.mmd` edit: yes. Two rewrites happened: bracket labels `class X["..."]` plus `cssClass` fail on mermaid 10 and 11 with `Syntax error in text`, so the file now follows the Catlas example form (`class X:::concrete` with a `+file` member). The `.mmd` file is the source of truth.

## Gate C: vision

Read the render at full width:
* Text outside boxes: none. Members are bare file names (`+content.js`).
* Stacked edge labels: none. 8 relations, no shared node pair.
* Clipped names: none. `host_main.py` at 12 chars is the longest member.

## Gate D: trace

| edge | source | sink hit | type hit |
| ---- | ------ | -------- | -------- |
| `calls` | `backend/app/api/routes.py:386` | yes | yes |
| `saves` | `backend/app/api/routes.py:336` | yes | yes |
| `spawn` | `native-host/host_main.py:175` | yes | yes |

Grep hits: `job_data = vision.extract_job_from_text(` at routes.py:386 into `def generate(` at engine.py:318, `res_rec = job_model.save_adapted_resume(` at routes.py:336 into `def save_adapted_resume` at job.py:42, `subprocess.Popen(` at host_main.py:175 into `backend/run.py:1`. Types match `flux.json`.

## Verdict

pass. Rounds used 3/3. Signed: reviewer on 2026-10-12.

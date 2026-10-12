# Check record: sequence-capture.mmd

Diagram: `diagrams/sequence-capture.mmd`
Source hash: `51b75b41ea744b5d6c0afec1813e0c081794d7a5`
Budget: nodes 7/12, edges 11/14

## Gate A: text lint

Command: `python I:\temp\opencode\catlas-ref\scripts\mermaid-lint.py docs/atlas/diagrams`
Result: `ok: 5 diagrams pass` (after shortening participant file to `SidePanel`, round 2/3)

## Gate B: render freshness

Render command: same Playwright substitution as `checks/context.md` (mermaid 11.4.1).
Output: `docs/atlas/assets/sequence-capture.png` (29140 bytes)
Rerendered after the last `.mmd` edit: yes. One rewrite: `classDef` lines are invalid inside `sequenceDiagram` on mermaid 10 and 11, so they were dropped following the Catlas example. Gray/white styling does not apply to sequence participants.

## Gate C: vision

Read the render at full width:
* Text outside boxes: none. Participants use the two-line `role<br/>file` form.
* Stacked edge labels: none. The `alt/else` block separates ok from falha.
* Clipped names: none.

## Gate D: trace

| edge | source | sink hit | type hit |
| ---- | ------ | -------- | -------- |
| `auto_capture` | `ui/src/SidePanelApp.tsx:160` | yes | yes |
| `send_msg` | `ui/src/chrome.ts:45` | yes | yes |
| `job_text` | `extension/content.js:407` | yes | yes |

Grep hits: `handleAutoCapture` at SidePanelApp.tsx:160 calls `startAutoCapture()` at SidePanelApp.tsx:166, `chrome.tabs.sendMessage(tab.id, { type: 'resume-capture-auto' })` at chrome.ts:45 into the listener at content.js:497, auto POST at content.js:407 into `@router.post("/adapt-text")` at routes.py:377. Failure branch matches `body.length < 80` at content.js:441 and the short-text 400 at routes.py:381.

## Verdict

pass. Rounds used 3/3. Signed: reviewer on 2026-10-12.

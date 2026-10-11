# Studio v3 AI panel: usability backlog

Status: **proposal, not accepted work.** Written 2026-10-08 from one owner screenshot (panel about 400 px wide, a step run in progress, one image attached) cross-checked against the source. Nothing here changes behavior. Wording and layout changes alter the product's look, so each slice needs the owner's go-ahead before implementation (see [Decisions needed](#decisions-needed)).

Evidence tags: **[code]** the string or behavior was found in the source; **[shot]** seen only in the screenshot, not reproduced in a browser run.

## Corrections to the first review

- The Stop button is **not** unnamed: it has `aria-label="Stop request"` and a tooltip (`index.html`). It is icon-only to sighted users (UX-04, low).
- "Observed model capabilities" is a **collapsed** `<details>` developer diagnostic (`ai-reference-files.js:16`), not an empty heading. The problem is that it is shown to every user (UX-11).
- Remove (UX-13) looked faint only because the screenshot was taken **while a request ran**: the references area is disabled then (`setBusy()`), and `tokens.css:8` gives every disabled button `opacity:.48`. Its default state was not shown to be low contrast, so UX-13 is withdrawn.
- "Waiting for the AI service · 0 s" is the elapsed time of **one request** (`ai-response-reader.js:17-18`); it restarts every turn of a step run, so a healthy run keeps showing "0 s" (UX-03).

## Backlog

Priority: **P1** the user cannot tell what is happening; **P2** layout and scrolling; **P3** the references area; **P4** wording; **P5** needs an audit first.

| ID | P | Issue | Source | Acceptance criterion |
|---|---|---|---|---|
| UX-01 | P1 | Step lines use internal terms: "Changed the draft", "Made a note", "Handed over the result" **[code]** | `agent-step-labels.js` | No visible step line contains "draft", "note" or "operations"; each line says in plain words what changed and its outcome; the technical code stays in the tooltip. |
| UX-02 | P1 | "rejected, trying again" gives no reason and no hint whether to act **[code]** | `agent-step-labels.js` | A rejected step shows a short plain reason class (for example outside the selected elements, invalid value) and says whether the AI continues on its own. |
| UX-03 | P1 | Status line mixes per-request seconds, a phase and a raw token count, so "Waiting … 0 s" appears during a working run **[code]** | `ai-response-reader.js`, `agent-provider.js:22`, `ai-panel.js:190` | During a step run the line shows the run's total elapsed time and the current phase; it never shows a reset "0 s" while steps are completing; the token figure is secondary or tied to a stated budget. |
| UX-04 | closed | Stop is an icon with no visible text **[code]**. Owner decision: keep as is. | `index.html` | None; closed by owner decision. |
| UX-05 | P2 | Three nested scroll regions (log, references area, panel) **[shot]** | `ai-panel.css:23,32` | At 400 x 800 at most one region scrolls at a time during a run; verified with a browser run. |
| UX-06 | P2 | Top of the conversation clipped; the request text is out of view **[shot]** | `ai-panel.css` | After sending, the user's own message stays reachable without manual scrolling; no bubble is cut off at the top edge. |
| UX-07 | P2 | One attached image fills most of the panel **[shot]** | `ai-reference-files.js` | With one attachment the references area is collapsed or height-capped and the conversation keeps at least half the panel height at 400 x 800. |
| UX-08 | P3 | Three ways to attach: plus button, "Add reference" link, native "Choose Files" **[shot]** | `index.html`, `ai-reference-files.js` | One visible attach control; the native file input is hidden but still operable by keyboard through that control. |
| UX-09 | P3 | Native control says "No file chosen" while a file is listed **[shot]** | `ai-reference-files.js` | No visible text contradicts the attached list. |
| UX-10 | P3 | The same privacy and image message appears three times **[code]** | `reference-images.js`, `ai-reference-files.js`, `ai-panel.js` | One notice states what is sent and to whom; the others are removed or only appear when they add new information. |
| UX-11 | P3 | Developer diagnostic shown to all users **[code]** | `ai-reference-files.js:16` | Hidden by default for normal users (settings or an explicit action); the existing `studio-v3-boss-demo.spec.js` check is updated, not deleted. |
| UX-12 | P3 | PDF-reading mode selector is visible when only an image is attached **[shot]** | `ai-reference-files.js:10` | The selector appears only when a PDF is attached or about to be. |
| UX-13 | withdrawn | Remove looked low-contrast **[shot]**, but that is the disabled style used while a request runs (`opacity:.48`), not its default look. | `tokens.css:8`, `ai-reference-files.js` | None unless a contrast measurement of the default state fails (then reopen). |
| UX-14 | P4 | The default "Whole form" scope uses a warning colour and long copy **[shot]** | `ai-panel.js`, `ai-panel.css:34` | The default state is neutral; the explanation is one short line; the amber style is kept only for states that need attention. |
| UX-15 | P4 | Technical words reach the user: "Demo gateway", "provider", "OCR", "layout interpretation" **[shot]** | several | A glossary decision is recorded; visible copy uses it consistently. |
| UX-16 | P4 | "1 page(s)" and "image-only, no extracted text" read like an error for a plain image **[code]** | `ai-reference-files.js:60` | An image shows its name and size only; the no-text note appears for PDFs only. |
| UX-17 | P5 | Whether step results are announced to screen readers is unverified | `ai-chat-view.js` | An audit with a real screen reader is recorded; any gap becomes its own item. |
| UX-18 | P5 | Status is carried partly by colour (amber, orange, green); contrast unmeasured | `ai-panel.css` | Contrast is measured and recorded; each state also differs by text or icon. |

## Constraints for any slice

- Existing tests assert the current wording and must be updated in the same change, never skipped: `studio-v3-agent-labels.test.js` (UX-01, UX-02), `studio-v3-chat-panel.test.js`, `studio-v3-ai-response-reader.test.js` and `studio-v3-stream.spec.js` (UX-03), `studio-v3-boss-demo.spec.js` (UX-11), `studio-v3-ai-references-layout.spec.js` (UX-07, UX-13), `studio-v3-agent-steps.spec.js`.
- Authority, scope and privacy behavior must not change: Preview → Apply → Undo, derived scope, reference sharing rules and the data-value-free context stay as documented in [STUDIO_V3_AI_CHAT.md](STUDIO_V3_AI_CHAT.md).
- Layout items (UX-05 to UX-07) need real-browser evidence at 400 x 800 and one wide viewport in all three engines; a unit test cannot establish them. Firefox needs extra care because it intermittently cannot reach the re-navigated preview frame in Playwright (read page thumbnails instead; see PR #32 and #33).
- Each file stays at most 300 lines; `ai-panel.js` is already 255.

## Suggested slices

1. **S1, low risk:** UX-08, 09, 11, 12, 16 (the references area; no wording of the run itself).
2. **S2, copy:** UX-01 to UX-03, 10, 14, 15 (needs the glossary decision).
3. **S3, layout:** UX-05 to UX-07 (needs browser evidence in three engines).
4. **S4, audit:** UX-17, 18.

## Decisions (owner, 2026-10-08)

- **Stop (UX-04): keep as is.** Icon plus the "Stop request" tooltip and accessible name stay. Item closed, no change.
- **Terminology (UX-15, UX-01): move all technical words to business language.** The exact replacement for each word ("Demo gateway", "provider", "draft", "OCR", "note") is still to be confirmed by the owner before S2; S1 does not touch the run-progress wording.
- **Capability diagnostic (UX-11): move it to the Settings menu**, out of the references area.
- **Order: S1 first** (references area), then S2.

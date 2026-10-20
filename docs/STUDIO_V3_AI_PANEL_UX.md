# Studio v3 AI panel: usability backlog

Status: **2026-10-15 implementation authorized by the user**, following the earlier 2026-10-08 screenshot/source review. The new cycle implements the general-form conversation, compact references, Settings diagnostics, neutral scope and anchored composer. This does not silently close every older backlog item or constitute production/visual approval; current evidence and remaining gates are in [General AI readiness](STUDIO_V3_GENERAL_AI_READINESS.zh-CN.md).

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

- Existing behavior/wire/geometry checks migrate with the interface. Tests that pin wording, source structure or obsolete defaults are deleted, not re-pinned to new copy. Preserve substantive scope, disclosure, Stop, restore and Apply/Undo checks.
- Authority, scope and privacy behavior must not change, except the 2026-10-20 owner decision below: Preview → Apply → Undo, derived scope, reference sharing rules and the data-value-free context stay as documented in [STUDIO_V3_AI_CHAT.md](STUDIO_V3_AI_CHAT.md).
- Layout items (UX-05 to UX-07) need real-browser evidence at 400 x 800 and one wide viewport in all three engines; a unit test cannot establish them. Firefox needs extra care because it intermittently cannot reach the re-navigated preview frame in Playwright (read page thumbnails instead; see PR #32 and #33).
- Each changed non-generated file stays at most 300 lines; split by responsibility if necessary.

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

## Current-cycle decisions, 2026-10-15

- User authorized a professional Claude/ChatGPT-style general-form chat experience for non-coders. No separate approval request is needed for these reversible implementation changes.
- One conversation/context scroll owner, anchored composer, compact attachments and expandable change details replace the screenshot-era nested layout. General-form starters include an explicitly read-only review action.
- The one-use sharing controls remain unchecked and explicit inside a disclosure. Opening it does not authorize sending values or pixels.
- Keep the material Demo/fictional-data boundary visible: plain language cannot conceal the service recipient or imply confidential-data approval.
- UX-01/02/03 and real screen-reader/contrast audit are not declared closed by this layout work. Historical owner decisions and findings above remain dated records.
- Pi/Oh My PI workflow reuse does not add terminal privileges or qualify the full G6–G9 coding-agent milestones.


## Owner decision, 2026-10-20

- The panel shows a short conversation and plain activity lines such as "Updated table row color" or "Adjusted header spacing". Technical properties, the raw diff and its JSON move into a collapsed Details block. Step lines no longer use "draft", "note" or "operations" (progress on UX-01; UX-02 and UX-03 are not closed).
- Ordinary layout edits are applied to the open form automatically after local checks and the paper preview pass; the allowlist and fallbacks are in [STUDIO_V3_AI_CHAT.md](STUDIO_V3_AI_CHAT.md#automatic-apply-owner-decision-2026-10-20). This replaces the "Preview → Apply must not change" constraint for the allowlisted operations only. No production, G6–G9 or visual-approval claim is made.

## Assistant redesign batch 1, 2026-10-20

- Header adds the BETA pill, editing subtitle and a keyboard-accessible Version history popover; the visible Demo/fictional-data notice remains.
- History is read-only: it lists retained snapshot revision numbers plus the current bus revision, marking the latter as Current. Undo/redo allocate monotonic revisions that need not have their own snapshot entry; missing or pruned revisions are not fabricated. No history navigation semantics change.
- Version history is disabled during requests, Apply and recovery. Escape closes it before the panel and returns focus to its trigger.
- User messages use a neutral person icon and blue-tinted bubble; assistant and working messages use a sparkle avatar. Assistant cards use the theme surface and border.
- New messages retain an epoch-millisecond `at` field through snapshots; validation accepts its absence for older conversations, which show no timestamp. Times use the user's locale and local timezone; provider conversation context remains role/text only.
- Added unit coverage: timestamp recovery and invalid values, legacy recovery, icon-only avatars, busy history states, monotonic revision listing and keyboard dismissal.
- Unverified: tests, build, service-worker output, 400 x 800 and wide-screen screenshots, theme contrast and screen-reader behavior. This batch was edit-only; the manager runs verification. No visual approval or backlog closure is claimed.

## Applied change card redesign (2026-10-20, batch 2)

- Applied cards use the stored numeric `appliedRevision`, a success-tinted frame, existing activity lines and an Undo button gated by `canUndo` and `applying`.
- View changes toggles the existing initially collapsed technical disclosure, synchronizes `aria-expanded` with native disclosure toggles, and scrolls the disclosure into view. The raw table and JSON remain inside it.
- The footer counts raw diff entries, not grouped activity lines, and displays local message time only when a valid `at` value exists. Legacy messages without a revision do not invent one.
- Ready proposals retain Preview/Apply/Discard, intent routing and disabled gates. Previous-form and earlier-edit history notices remain visible.
- Added behavior coverage for revision/count consistency, disclosure interaction, Undo routing/gating, missing timestamps and ready-state action gates.
- Unverified: unit execution, real Undo interaction, browser rendering at 400 x 800 and desktop, contrast, keyboard/screen-reader behavior, build and service-worker output. This batch is edit-only; verification belongs to the manager.

## Suggested actions and composer (2026-10-20, batch 3)

- Host-owned suggestions rotate deterministically through ten fixed prompts, five at a time, wrapping after the second group. Refresh makes no model or network request. Logo, payment QR and footer examples explicitly remain fictional; QR asks for a placeholder, not real payment details.
- Empty conversations show only the existing welcome starters. Suggested actions appear after a message exists and disappear when the conversation is cleared. Chips reuse the existing prompt-fill/focus handler and never submit; chips and refresh are disabled during requests, Apply, recovery and reference reading.
- The composer places the growing textarea above a wrapping toolbar containing the existing attachment control, derived scope selector, keyboard hint and send/stop controls. IDs, accessible names, scope hint hooks and Enter/Shift+Enter handling are retained.
- Sharing permissions remain an explicit disclosure below the composer; reference files and element tags stay in the conversation context. Recipient/status notices and the visible fictional-data boundary are retained. Existing theme variables supply surfaces, borders and focus colors.
- Added unit coverage for pool rotation/wrap, fill-without-send, busy gates, welcome/suggestion exclusivity and toolbar scope/send/stop behavior.
- Unverified: unit execution, build/precache output, actual attachment/scope interactions, textarea growth, mobile Tab trap, 400 x 800 and desktop rendering, theme contrast and screen-reader behavior. This batch permits file edits only; the manager runs commands and browser verification.

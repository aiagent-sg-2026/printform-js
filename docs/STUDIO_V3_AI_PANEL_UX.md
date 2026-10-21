# Studio v3 AI panel: usability backlog

Status: **2026-10-15 implementation authorized by the user**, following the earlier 2026-10-08 screenshot/source review. The new cycle implements the general-form conversation, compact references, Settings diagnostics, neutral scope and anchored composer. This does not silently close every older backlog item or constitute production/visual approval; current evidence and remaining gates are in [General AI readiness](STUDIO_V3_GENERAL_AI_READINESS.zh-CN.md).

Evidence tags: **[code]** the string or behavior was found in the source; **[shot]** seen only in the screenshot, not reproduced in a browser run.

## Batch 20 unreachable suggestions cleanup (2026-10-21)
- Removed the always-hidden suggestions module, layout/render calls and dedicated styles; no replacement suggestion bar is mounted. Welcome starters retain prompt-fill-only behavior and their existing busy-state guards.
- Removed obsolete hidden-bar assertions while retaining welcome lifecycle, prompt focus/no-send, form isolation and composer scope/send/stop coverage. E2e specs remain manager-owned and unchanged.
- Unverified: edit-only batch; unit tests, builds, browser behavior and screenshots require manager verification. No shell or git commands were run.

## Batch 19 type scale (owner 2026-10-21)
- Supersedes earlier recipient-notice requirements: the composer reason is empty and hidden unless references are reading, image support is blocked, or source cleanup blocks Send. Send enablement is independent of visible notice text. Settings retains “Demo AI gateway · use fictional data only”; explicit per-run sharing and commit policy are unchanged.
- Panel tokens: `--ai-fs-meta:12px`, `--ai-fs-small:13px`, `--ai-fs-body:14px`, `--ai-fs-title:15px`, `--ai-fs-heading:17px`. Body weight 400, controls 500, titles 600, line-height 1.4–1.5. Metadata and controls intentionally supersede the older blanket 14px minimum.
- Scope is 13px/500, 32px tall with 4px 10px padding on desktop. At widths ≤900px or coarse pointers, scope and form inputs use 16px; scope stays 36px tall with 2px 8px padding. Attach/send are 36px on fine desktop and 44px on mobile/coarse pointers.
- Welcome starters are auto-width wrapping pills with an 8px gap and a 17px heading; prompt-fill-only behavior remains unchanged. The composer stays anchored. Narrow settings use a viewport-bounded, internally scrolling surface. Sharing permissions and the removed subtitle remain absent from the main column.
- Unit coverage retains blocking/readiness transitions and consent isolation. Browser coverage migrates the empty-state, layout matrix/budget, simple panel and image-check cases; sharing interaction now scrolls settings rather than the conversation and retains viewport/no-inference checks.
- Unverified: edit-only batch; manager must run unit tests/builds/e2e and review 1440×900, 390×844, 360×640, 400×800 and 320×568 screenshots, coarse-pointer targets, themes, focus and screen-reader behavior. No shell or git was used.

## Batch 18 simple and clean (owner/client 2026-10-21)
- Supersedes the earlier header, sharing-placement, applied-card and suggestion presentation: icon-only Version history, no subtitle/policy paragraph/flow list/composer keyboard hint, and four welcome starters only. Starters still fill without sending; Enter and Shift+Enter behavior is unchanged.
- Sharing permissions now live in the settings menu with the same unchecked, explicit per-run controls. Consent errors point to sharing in ⋯ settings; host policy denials cannot be bypassed by those controls. The recipient notice remains visible: “Demo AI · use fictional data only”.
- Current applied cards show Applied, Undo and one native Details disclosure. Undo describes the committed numeric revision accessibly; the toolbar remains the visible revision source. Details groups plain activity, retained steps and raw table/JSON. Answers/errors without a card retain their own step disclosure; history states remain distinguishable.
- Manual proposals say Needs your approval and retain Preview/Apply/Discard gates. Redundant completion statuses remain polite live announcements but are visually hidden; errors and blocking reasons stay visible.
- Design and single-step prompts request at most two short sentences in the person's language, including finish summaries, without describing tools, drafts or inspection. This changes reply guidance, not grants, inspection requirements or commit policy.
- Added Chromium scenarios for 1440×900 and 400×800: empty panel innerText ≤200 characters, collapsed applied card ≤60, Details activity/steps, visible recipient, unchecked settings permissions and keyboard access. Updated affected unit/e2e structure expectations without changing authority assertions.
- Unverified: manager must run unit tests, builds and browser scenarios; no shell/git commands were run. The reported prior empty panel was approximately 430 visible characters; expected new visible copy is below 200, and the current collapsed applied card is approximately 20 characters. These are targets/estimates, not measured browser results. Theme contrast, clipping, single-scroll layout, 44px targets and screen-reader announcements need runtime review. Agent prompt release fingerprints may require the normal manager-owned release process; protected release files were not changed.

## Retained tool steps (2026-10-21, batch 16)
- Completed answers, proposals and failed/blocked runs retain the last 40 plain step labels (160 characters each) on the assistant message before live progress is cleared. A native, initially collapsed "Worked in N steps" disclosure precedes the change card; success/failure symbols supplement color. Live progress still shows the latest six steps.
- Successful `onStep` events add only a registered `skillId` or `operationCount`; labels never include raw tool arguments or form values. Operation counts intentionally supersede the earlier UX-01 wording restriction. Inspection result labels retain their existing plain status.
- Recovery rejects malformed or user-owned steps with `INVALID_CHAT_RECOVERY`; snapshots preserve steps, but model conversation context remains role/content only. Preview, Apply, Undo, scope and sharing authority are unchanged.
- Unit and scripted-gateway e2e coverage includes retained history, collapsed rendering, failed steps, validation, safe details and reload. Unverified: test/build execution, release-review hashes, narrow/wide rendering, themes and keyboard/screen-reader behavior; this batch is edit-only.

## Batch 13h, 2026-10-21
- Replace the open `give … a/an` lookahead with zero to three alphabetic modifier words followed by a closed formatting-attribute whitelist. Preserve the definite-object, `me/us`, question-mark, `or`, blocked-noun and response-target guards.
- Grammar and host-grant cases cover letter grades, readability scores and quick checks as read-only, while retaining the five requested formatting commands as drafting/design requests.
- Tests and runtime verification remain with the manager for this edit-only batch.

## Batch 13g, 2026-10-20
- One shared response-target guard prevents `ADDED_EDIT` commands from granting drafting when the stripped instruction targets an answer, explanation, assessment or informational presentation. Direct and preservation-plus-added-edit commands share this guard; original `EDIT` verbs are unchanged.
- Grammar cases cover all 15 reported information requests, preservation-plus-added-edit rejection, the eight requested drafting examples and an original edit verb with explanation wording. Existing read-only and unsafe-proposal assertions are retained.
- The guard does not match `description`, so the description-column drafting request remains eligible. Tests and runtime verification remain with the manager for this edit-only batch.

## Batch 13d, 2026-10-20
- In `ADDED_EDIT` only, `give` requires an immediately following definite object word (`the|this|that|these|those|it|its|each|every|all`) and excludes `overview|summary|explanation|description|answer|list|breakdown|report|review|idea|ideas|suggestion|suggestions|example|examples|advice|feedback` anywhere before the next `.`, `!`, `?` or end.
- Preserve the original `EDIT` list and existing `me/us`, question-mark and `or` gates. Both grammar and host-grant cases cover the four reported information requests and three authorized visual edits.
- Unit tests and runtime verification remain with the manager for this edit-only batch.

## Batch 13c, 2026-10-20
- Preserve the original direct-edit verbs and ordering. Batch 13 additions grant drafting only when the stripped instruction contains neither `?` nor `？` and the added verb is not immediately followed by `or`; preservation-plus-edit requests use the same gate.
- Retain the `give me/us` exclusion and explicit read-only restrictions. Grammar and host-profile regression cases cover informational questions, alternatives, direct edits and stripped source questions.
- Test execution remains with the manager; this edit-only batch has no runtime verification.

## Batch 12, 2026-10-20
- Keep the composer scope selector at 16px to avoid mobile input zoom; retain its bounded pill width and single toolbar row.
- Opening references scrolls the trailing notice into view within the conversation, keeping the retry action reachable and the composer anchored.
- Approval help explicitly includes data bindings, the data collection, page setup and source code; runtime and visual verification remain with the manager.

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
- Owner widening, 2026-10-20 (batch 11): inspected layout and static-content edits apply automatically, including text, labels, headings, logo, section changes, field order and static field additions/removals. Data-binding keys, collection, page setup, unknown operations and every source-workspace run remain manual Preview → Apply; Undo remains revision-bound. The exact allowlist and removal/diff rule are in [STUDIO_V3_AI_CHAT.md](STUDIO_V3_AI_CHAT.md#automatic-apply-owner-decision-2026-10-20). This supersedes the earlier narrow layout allowlist, without changing scope, privacy, inspection or the three source exclusions. No production, G6–G9 or visual-approval claim is made.

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

## Corrective layout batch 4, 2026-10-20

- The conversation uses `flex:1 1 auto; min-height:0`. Header copy and controls share a grid row; subtitle and the always-visible Demo boundary use single ellipsized lines. History is icon-only in panels at most 480px wide, with its accessible name retained.
- Whole-form scope guidance stays in the DOM and selector tooltip/accessibility description without a visible banner. Selected scope uses one compact line; scope derivation is unchanged.
- Suggested actions use one horizontally scrolling, snap-aligned chip row under a 44px heading row (96px total including padding). They are hidden for empty conversations and during requests, Apply, restore or reference reading; prompt-fill and refresh behavior remain local.
- The composer toolbar no longer wraps. Its keyboard hint is hidden in compact panels. Recipient text remains visible; complete consent/source state is readable inside Sharing permissions without granting permission. Blocking reasons retain their text in a height-capped scrollable notice.
- Status text and live-region behavior remain intact; visual display is one ellipsized line with full text in its tooltip. The current applied card's redundant state paragraph is visually hidden only while its Undo control exists; history states remain visible.
- Welcome copy describes automatic layout/text edits and approval for bindings or page setup (updated by batch 11). Logo and QR suggestions use image and QR icons from the existing inline SVG helper.
- Unit coverage adds busy/reading suggestion visibility, consent state transitions in the disclosure, and status tooltip/announcement preservation. No e2e specs or authority/policy rules were changed.
- Unverified: no shell, Git, tests, builds or browser runs were performed in this edit-only batch. The 300px/340px conversation gates, full applied-card visibility, 104px header and other measured budgets require the manager's existing layout-budget spec and screenshots at 400x800 and 1440x900. Theme contrast, keyboard/screen-reader behavior and service-worker output also remain unverified.

## Screenshot polish (2026-10-20, batch 5)

- The subtitle occupies its own full-width row without truncation. The Demo notice remains in the DOM inside Sharing permissions; the composer recipient notice remains unchanged and visible.
- Version history shows its text above the 480px viewport breakpoint. Desktop panels have a 480px minimum displayed width to keep the title and all header controls on one row; narrow viewports retain the icon-only control.
- Technical details use a secondary, normal-weight disclosure with a CSS chevron and explicit focus ring. The raw table/JSON, default collapsed state and View changes toggle remain unchanged.
- Heading text, table collection, logo, page setup and field text changes have content-specific activity descriptions. Current applied cards use green checks; ready, expired and historical cards use muted dots.
- Applied-card secondary text uses the existing ink token rather than the muted token on its green-tinted background. Theme contrast still requires measurement.
- Added unit coverage for every operation type's activity semantics, historical/current card distinction and the View changes disclosure round trip. No policy, agent implementation or e2e files changed.
- Unverified: unit tests, build, both layout/empty-state e2e gates, 400 x 800 and 1440 x 900 rendering, desktop resize behavior, keyboard focus and measured 4.5:1 contrast. This batch allows file edits only; the manager performs execution and screenshot review.

## Single scroll owner restoration (2026-10-20, batch 6)

- Sharing permissions returns to `.ai-context` inside `.ai-conversation-scroll`, superseding the batch 3 footer placement. Expanded permissions and reference files share the conversation scroll surface.
- Removed the footer-only height cap and overflow rules; the disclosure retains 14px text. The scroller keeps `flex:1 1 auto; min-height:0`; composer and suggestions remain non-growing.
- The short recipient notice stays under the composer. Full consent state and the Demo notice stay inside the disclosure; permission IDs, summary updates, authorization and source-workspace queries are unchanged.
- Chromium local-file DOM/CSS smoke at 400 x 800, 320 x 568 and 1440 x 900 found only the conversation scroll owner, no horizontal overflow, and fully visible pixel permission, prompt and send controls after scrolling to the end. Native text-checkbox toggles retained visibility at both narrow sizes.
- Unverified: application JavaScript did not initialize in the local-file smoke. PDF attachment/expanded references, dynamic permission updates, inference-request absence, post-exchange layout budgets, applied-card visibility, all four acceptance e2e specs, unit tests, build, other engines, themes and keyboard/screen-reader behavior still require manager verification. No shell, Git or test commands were run; e2e and unit files are unchanged.

## Batch 11 gate repair, 2026-10-20

- Reference-consumption tests await the automatic label Apply performed by Send instead of applying the consumed proposal again. They assert exactly one commit, applied status on success, unchanged revision on failure, and the original reference-clearing/preservation outcomes.
- The bundled form-authoring skill exceeded the 16000-character bound because the short commit policy is repeated in it; the short policy text was shortened. The bound is unchanged.

## Batch 18 simple and clean gate repair (owner/client 2026-10-21)

- Shorten the welcome chip from Improve readability to Improve spacing without changing its prompt or fill-only behavior. From the manager's measured 202 characters, this removes four characters: expected 198 at both tested viewport sizes.
- Check approval guidance in settings and whole-form scope help, not the removed welcome paragraph. Remove obsolete applied-status wording pins while retaining commit count, revision, Undo and restoration assertions.
- Assert the exact Responses envelope keys instead of banning the word tools inside system instructions; retain the credential-leak assertion and endpoint, role, payload and usage checks.
- Open settings before exercising sharing controls in narrow-screen interaction coverage; retain viewport, consent and no-inference checks.
- Unverified: manager must rerun unit, browser and layout gates. Release-review stale dispositions remain blocked: their files are outside this repair's permitted edit scope; no hashes or review checks were bypassed.

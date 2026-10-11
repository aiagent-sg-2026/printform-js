# Studio v3 framework-native Pi authoring

The sidepanel keeps a bounded conversation and composer. Send is the deliberate
action accepting the adjacent recipient/context notice. No consent checkbox
or background send is used. Enter sends; Shift+Enter and IME Enter do not.
There is no request preview control; what is sent is the bounded context described in
the studio v3 doc. The recipient notice is the line "Sent to the Demo gateway · use fictional data only"
under the message box, which stays on screen for the whole conversation, plus the text in
the Settings menu. If the current context differs from the one prepared when the user
started typing, Send refreshes it and stops before inference.

Edit scope is derived, not chosen: elements added with Add to chat limit the edit to
those references; with none, the whole form is editable. A proposal that touches
anything outside the references is rejected (`UNSAFE_SCOPE`).

## Panel layout

- **Empty conversation.** An illustration, "What would you like to improve?", four starter
  chips (they fill the message box and send nothing), an Attach reference card, the numbered
  Ask AI, Preview, Apply flow. The illustration gives way on wide
  windows up to 940px high and on any window up to 760px high; the view starts at its top.
- **Scope card**, above the conversation: "Scope: Whole form" (amber) or "n selected
  element(s)" (blue), with "Changes will be previewed before applying." and how to limit a
  change. The control mirrors the derived scope; it does not set it. Choosing Whole form
  removes every reference. "Selected elements" is disabled when there are none, and the
  control is locked while a request or Apply runs. On windows up to 760px high only the first
  line is kept.
- **Composer.** A plus button (attach a reference), a one-line message box that grows with
  its text (capped by CSS) and a paper-plane Send. Files can be dropped on the composer or
  anywhere in the conversation. The composer is a column in which only the References area
  and the element tags shrink and scroll inside themselves; the message box, Send, its reason
  and the status line keep their size, so they stay on screen on a phone or a short window.
- **Image support.** Attaching an image (or a visual PDF) checks the model's image support at once;
  it sends no reference file, only the model list request. The result and its "Check image support"
  retry button sit in a row pinned to the bottom of the scrolling References area, so the button is
  never hidden when the references are tall. Changing the references clears the result, and the next
  image attached is checked again.
- **The line under the message box.** One element, two contents. Normally it shows the
  recipient notice. When Send is disabled for image support that is not confirmed, or while
  references are still being read, the reason replaces it (amber) and goes back to the
  notice when the cause is gone. It is tied to Send with `aria-describedby`. Other disabled
  states (a running request, Apply, restore) are visible elsewhere and keep the notice.
- **Header.** Settings (the "…" menu) and Close. There is no Back button.

## Working in steps

An edit request can run as a tool loop instead of one reply. The model works on a private draft copy of the
form and calls registry-defined local tools: `get_capabilities` (release, tools, schemas and knowledge index),
`read_skill` (bundled product guide), `get_context` (structure, bindings, authoring targets), `apply_operations` (the same
typed operations and checks as a single proposal, at most 24 per call), `inspect_draft` (a real print preview of the
draft), `undo_step`, `take_notes`, `finish` (hands the result over) and `report_blocked`. Each step is checked against the previous
one by the same parser and scope rules, and numeric/financial bindings are also checked against the initial run baseline;
the live form is never touched. Removal does not erase protection when an identity is re-added. `finish` turns the draft into one
proposal with the net change, and the usual Preview, Apply and Undo take it. A missing, stale or failed inspection
rejects `finish` with a recoverable `AGENT_INSPECTION_REQUIRED` or `AGENT_INSPECTION_BLOCKED` tool error. The agent must
inspect the exact final draft successfully before finishing. Label and field aliases merge as one property in the net
change list; restoring that property to its initial value removes it from the list.

Limits, all in the gateway config: 1000 tool calls per run, a stop after the same failing step repeats 5 times, and 60
minutes from entry into the multi-step loop, after model discovery. The panel and Pi lane use the same configured
agent deadline. Single-step runs retain the 225-second Send limit; a fallback from agent mode re-arms that short limit.
Each provider request still has its own 60-second limit. Stop works at any time and cancels the request in flight.
A run also stops if the live form changes. The panel
shows the latest steps while it works; a rejected step is shown as such and the model sees its error code and repairs it.

Each turn resends the conversation (the gateway keeps no state), with encrypted reasoning replayed from the previous
turn; older tool results are folded and the request has a size limit. A fresh gateway session starts every 15
requests. This needs the gateway to allow client-executed function tools for the project (`agent_tools_enabled`) and a
native OpenAI route. If the gateway refuses tools, the panel says so once, uses the single-step flow, and does not ask
again until the page is reloaded or the setting is switched. Disabling "Work in steps (beta)" in the settings menu uses
the single-step flow. Questions also run in steps, under a read-only effect grant, unless steps are off or unavailable.
The setting is on by default and remembered in the browser. Confirmed image
support permits image-bearing agent runs; otherwise their pixels cannot be sent.

Long runs and cost. A run has a token budget (2,000,000; no next request starts once accounted usage reaches it) and the
status line shows the tokens so far. One admitted response may cross that budget; this is not an exact billing ceiling.
Usage counts must be non-negative safe integers and consistent. A missing total is derived from valid input and output
counts; a valid total can be used with unavailable components, which remain `null` in the host usage projection.
Missing or inconsistent total consumption stops the run with `AGENT_USAGE_UNAVAILABLE`, without another request or a
proposal. Unknown consumption is never reported as zero. The model can keep notes with `take_notes`: they replace its earlier notes, are
capped at 2,000 characters, and are shown to it on every turn together with the steps still in the draft, so they
survive folded results and dropped turns. When the request grows past 400,000 characters the oldest turns are replaced
by one message carrying the notes and the step list, and only the newest four turns stay; a call is never left without
its result.

Reference images (and the pages of a visual PDF) go with non-streaming requests on the first four turns only, because the gateway
keeps no state and every turn would resend them; after that a line says they are gone and the model works from its
notes. They need the same confirmed image support as the single-step flow. A PDF's extracted text and positions reach
the agent through `get_context`. Designing a new form from an image or PDF is not done here: the agent amends the
current form.

## Authoring and questions

A request that reads like a question is read-only: any proposal returned for it is rejected
(`UNSAFE_PROPOSAL`). Wording that names fonts and sizes counts as a question unless it also
contains a change verb (change, set, make, increase, reduce, adjust, improve, enhance, tighten,
enlarge, shrink). The starting actions in the empty state must stay edit requests, and a test
checks each of them against this rule.

In a step run the host builds a frozen effect grant before the first model call. A question gets the read-only grant:
the model is shown only the read, notes, `finish_answer` and `report_blocked` tools, so it cannot change a draft or
propose a change, and an answer needs a prior read of a guide, the form context or an inspection. Any other request
gets the design grant (private draft plus a proposal for Preview and Apply). The question check can only narrow the
grant; it never widens it, and no argument, model text or reference text can change it. Data and coding grants exist
by name only and fail as unavailable until their tools are added.

Apply is idempotent. The host mints one intent key per proposal (never from the model) and the Apply button carries it.
A second click, a queued repeat or a late repeat for a key already seen waits for the original outcome and does nothing
more, so there is one commit and no error for the harmless repeat. The same key with different content is rejected
(`INTENT_CONFLICT`); a new proposal gets a new key. A failed outcome is replayed, never retried blindly. The ledger keeps
the last 64 keys in memory only.

Ordinary questions use a closed answer envelope in the single-step flow and remain read-only. Font
questions use measured computed typography in the committed sandbox preview,
with stable label/value/title/page-number IDs. Zoom is separate from print size.
Missing measurements are explicitly unavailable.

Edits use a proposal with either the legacy style/width edits or at most 24
framework-native operations. The canonical design contract and capabilities are
in [Authoring](STUDIO_V3_AUTHORING.md). Operations can add/remove/reorder fields
and columns, author labels and nonfinancial static text, rebind supported source
paths, set independent label/value styles, section layout/order/pagination,
paper geometry and existing embedded raster assets. No arbitrary HTML, CSS,
JavaScript, shell, filesystem, formula or model code runs.

Existing numeric-bound fields cannot become static/image or receive replacement
text/format. Financial-bound fields additionally retain their existing pointer.
New static financial/number fields are rejected. Labels, styles and structural
placement remain editable. ERP dataset values and calculations never change.

Whole template permits the supported design surface. Selected section permits
its actual owned children. A selected field permits only itself and its exact
label; label selection permits only label/showLabel/labelStyle. Similar ID
prefixes do not establish ownership. Referenced selections can contain up to
eight stable elements, each with up to 500 characters of user comments.
Add to chat is available from paper, structure and properties. Chips support
remove, highlight and locate. Deleted, older, cross-document or recovered tags
block Send until explicitly removed and added again.

## Bounded single-step inspected run

A single-step Send uses the pinned real Pi AgentHarness/MemorySessionRepo and Demo provider
extension. The gateway accepts ordinary text completions; local validated
operations implement authoring. A run allows at most three model requests and
three real isolated print-preview inspections, with Stop and a 60-second
client timeout. Invalid proposals or blocked geometry can trigger a repair
within that cap. A blocked final candidate is never reported as passing.

Each repair resends the reviewed context and previous model proposal. Newly
added local diagnostics are allowlisted error codes, known component IDs,
geometry and numeric counts only. No rendered text, samples, amounts, raw
images, selectors, files or diagnostic messages enter that dynamic boundary.
Context identity, data, revision, selection, references and epoch are rechecked
before each remote request and around every local inspection.

The final candidate has one complete Before/After diff, including implicit
binding cleanup and added/removed field definitions. Local inspection never
commits. The user must still choose Preview and then Apply. Apply requires
current passing layout/data checks and draft Apply/Discard/Stay protection,
then rechecks identity at CommandBus queue execution. It creates one history
entry. Card Undo is bound to that exact bus/revision/epoch. Printing/exporting
are disabled while an unapplied candidate is visible, including restore failures.

## Disclosure and storage

Initial automatic context contains stable IDs, types, style/structure numeric
settings, measured font facts, known framework/declared-schema pointer paths
and types, and at most six recent eligible messages capped at 3,000 characters.
Raw dataset object keys are never enumerated for AI; custom paths explicitly
typed in the request/comments can be resolved locally without exposing values.
Row-relative candidates identify their collection, so collection and columns
can change atomically. Secret-like declared keys are omitted.

Business labels/text, dataset values, amounts and asset bytes are not automatic
context. User-entered requests/comments and eligible conversation are shared
as disclosed. Recovered text stays untrusted. No gateway registration, grant,
private key or provider native tool configuration changes. Discovery sends no
document. Demo tokens and Pi sessions remain memory-only and are cleared.
Usage is reported only when supplied; if any step lacks usage, aggregate usage
is unavailable. A client timeout cannot undo a request already received remotely.

Conversation retains 12 messages capped at 4,000 characters. Validated diff
history shares the parser's 360-entry cap. Keep work & update retains only
whitelisted text/diffs/input and inert references, within the existing 4 MiB
verified local backup guard. Recovered proposals never regain Preview/Apply;
references require fresh re-addition. Failed recovery keeps the protected backup.
Desktop resizing, mobile paper-return and normal draft/database protections
remain available. Native printer output and visual design still need owner review.

## Reference PDF failures

The local PDF reader names why a file failed. A damaged or undecodable file reports
"damaged or could not be decoded". A failure that names a missing function or global
(for example `Map.prototype.getOrInsertComputed` on an older browser) is the browser's
gap, so it reports "This browser cannot run the PDF reader" and says PNG/JPEG/WebP
references still work. Errors about the file itself (PDF.js format errors, invalid
structure, bad data reads) never produce the browser message. The reader uses the
pdf.js legacy build so that older browsers run it at all.

## Gateway failures

A failed Demo request is named by HTTP status plus the gateway's own code (or its published
wording), and the message says what to do next. No route left (`DEMO_ALL_ROUTES_EXHAUSTED`)
is recognised on both 429 and 503. A 429 for the session request or concurrency cap
(`DEMO_SESSION_REQUEST_LIMIT`, `DEMO_SESSION_CONCURRENCY_LIMIT`) says to wait a few seconds
and send again; each Send starts a fresh session, so that works. A 429 whose wording names
the daily quota says the allowance is used up until tomorrow. Any other 429 keeps the
generic "limit reached, try later". A Cloudflare 524 (origin silent for about 100 s) reaches
the browser as a network failure, so that message also says the service may be too slow.

## Gateway probe

`studio-v3/gateway-probe.html` is a diagnostic page for checking what the real Demo gateway does with the tool loop's
wire format. It runs the same transport as the panel and sends three tiny requests with fictional text: the model list,
one function call (`read_skill`, a stand-in for a skill reader), and one replay of that call with its result and encrypted
reasoning. It shows PASS or FAIL per check with codes and counts only, never request or response bodies, and offers the
result as text to copy. It must be opened from the published site, because the gateway allows that origin; the origin is
never set by hand. It is a separate bundle (`scripts/build-studio-v3.mjs`), not part of the app shell.

Real run, 2026-10-07, from the published site: the model list returned 6 aliases (`demo-auto` used); the model called
`read_skill` with the right argument and an encrypted reasoning item; the replay of the call, its result and the reasoning
was accepted and the model answered. So function tools are enabled for the project and the replay format works.

## Status of the tool loop

Verified against the real gateway: function tools, one call with its argument, and the replay with encrypted reasoning
(the probe above). Verified only against a scripted gateway: everything else, namely long runs (request size, session
rotation every 15 requests, token expiry), the full `apply_operations` flow, reference images with tools, streamed progress
and the session request and concurrency caps.

The first v3 capability registry and bundled guide are implemented. Nine tools and thirteen authoring operation schemas
are declared in `agent-registry.js` / `agent-operation-schemas.js`; tools use those contracts directly. `get_capabilities`
returns the release identity, supported operations, skill index and actual step limits. `read_skill` loads the bounded
`form-authoring` guide from trusted bundled product text. The step prompt contains orchestration rules rather than a copy
of the single-step operation manual. These resources use local browser tools, not Pi's filesystem/shell skill loader.

Builds generate capabilities, knowledge index, guide, agent manifest and capability changes. The bundle embeds the same
release/package identity. Before its first model request, a built step run checks the immutable release manifest against
that identity and the page asset prefix; unavailable/mixed resources stop the run. The complete package joins the
hash-verified offline shell. Unbundled tests use an explicitly unverified development identity.

Synthetic Pi and browser tests cover discovery, guide reading, editing, inspection, Apply/Undo and a mixed-release block.
The real model's independent guide uptake and full task competence are not yet qualified. Creating a new form, asset
import, source execution, dataset mutation and preview-image observation remain outside this first slice. The gateway
probe's `read_skill` stand-in is separate from the new product tool. See [Registry maintenance](STUDIO_V3_AGENT_REGISTRY.md).

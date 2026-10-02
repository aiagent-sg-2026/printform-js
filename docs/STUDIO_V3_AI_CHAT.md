# Studio v3 continuous AI editor

The sidepanel keeps a bounded conversation and a bottom composer. Enter sends
only after explicit sharing consent; Shift+Enter inserts a newline and IME
composition never sends. Stop aborts the active browser request. Retry restores
the failed message to the composer for review; it does not send automatically.
The folded settings expose the actual Demo alias, discovery and Clear action.

## Questions and edits

Ordinary questions use a closed `{kind:"answer",message}` envelope and are
read-only. For current font sizes, the client replaces model number claims with
actual measured facts from the committed print preview. The source identifies
semantic field/section IDs and typography roles. For example, the default base
font is 9 pt, the fixed title is 18 pt, company value 12 pt and table headings
8 pt. These are measured values, not a claim that every node uses the base font.
Paper Zoom does not change computed print font sizes. Missing facts are clearly
unavailable, including hidden or unrendered fields.

Edits use `{kind:"proposal",summary,edits}`. The existing bounded parser still
owns the edit whitelist and produces actual Before/After values. Empty, mixed,
malformed or unsupported patches fail without changing the form. Global accent
color does not recolor every heading; base font does not change fixed titles.

| Scope | Supported changes |
| --- | --- |
| Whole template (default) | Existing global style tokens and column widths |
| Selected item column | That column's width only |
| Selected items section | Existing item column widths only |
| Other selected field/section | Read-only answers; use Whole for global styles |

Live selection is shown above the composer. Any selection, Scope, document or
revision change expires the active proposal and invalidates late replies. An
epoch prevents changing away and back from reviving it. Queue execution checks
the exact proposal, selection, Scope, bus, revision, base design and generation.

Preview uses the same print runtime with unchanged ERP data and revision. Apply
requires passing layout/data validation and existing draft protection. It makes
one CommandBus history entry. The applied card offers Undo only while that exact
edit remains current; the toolbar history remains the standard navigation path.
A completed self-commit is recorded as Applied even though its canonical change
invalidates pending AI work. No model code, financial calculation or auto-apply
route is introduced.

## Provider and disclosure

This remains the real pinned upstream Pi AgentHarness/MemorySessionRepo with a
browser provider extension. Each Send performs one ordinary Demo completion,
then invokes one locally validated answer or preview tool and stops. Continuous
conversation is bounded UI context, not an unrestricted autonomous coding CLI.
There is no invented Python harness. Demo native tools, arbitrary schemas,
files, background execution and web search remain disabled and absent from the
wire. The existing github-pages project and browser-provided exact Origin are
reused. No new registration, grant, key or gateway configuration is needed.

Sharing details show the exact JSON: user input, style/column settings, numeric
font facts and the last at most six eligible messages capped at 3,000 characters.
User and assistant text is untrusted and never promoted to system/tool roles.
Messages from another document are excluded from follow-ups. Business text,
labels, bindings, sample data and amounts are excluded from automatic context.
Anything the user types may contain private text, so each Send needs deliberate
consent to the displayed payload. Provider usage is shown only when reported;
missing usage is unavailable, not zero. Demo tokens and Pi sessions stay in
memory and are cleared after runs. They are never exported or persisted.

## History, mobile and updates

The panel retains at most 12 messages, each at most 4,000 characters. Clear
explicitly removes conversation; if input or active work exists it asks before
discarding that work. Historical conversation alone is not an unsaved template.
Only current input, an active proposal or request enters the update pending-work
check. Close preserves conversation; Return to paper hides the panel. A mobile
Preview returns to the paper automatically, and reopening AI retains that
current preview for deliberate Apply. The mobile panel fills the viewport and
traps keyboard focus; controls use coherent accessible SVGs.

Desktop panel width can be changed with pointer drag or the keyboard separator
(Arrow keys, Home/End). A validated 320..600 px preference is kept locally. The
existing paper ResizeObserver recomputes Fit page; width/zoom never changes
revision, print dimensions or data.

Keep work & update explicitly backs up whitelisted conversation text and diffs
along with existing protected drafts. Recovered diffs and legacy v1 proposals
are expired history: no candidate, Preview, Apply, token or running session is
restored. New requests require new consent. A failed recovery retains its
backup under the existing download/confirmed-discard safeguards.

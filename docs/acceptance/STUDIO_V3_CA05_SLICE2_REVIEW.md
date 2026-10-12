# CA-05 Slice 2 Independent Review

Reviewer role: independent read-only reviewer, not the implementation author.
Scope: semantic authorization, run lifecycle, actual provider dispatch/response boundaries,
independent value/pixel policy, protected conversation history, and retained wire custody.
No production, test, policy, Git, public, live-provider, or paid-provider mutations were performed.
Only this ignored evidence directory was written under the parent's explicit authorization.
Final frozen artifact/report/raw-wire verification passed as documented below.

## Initial actionable finding

P2: UI completion/cancellation before or without a step run retained live observation authority.

Affected pre-review sources:

- `/Users/yapweijun/Documents/GitHub/printform-js/studio-v3/ai-panel.js:99` (`cancel`),
  line 146 (`finish`), and line 213 (`send` finalization).
- `/Users/yapweijun/Documents/GitHub/printform-js/studio-v3/ai-observation-authorization.js:27`
  through line 29 (asynchronous mint accepted without an end/cancellation generation check).

`consume` minted a grant for all UI send paths. Revocation existed only in
`runPanelAgent.finally`, leaving direct completion, discovery failure, and cancellation
during SHA-256 mint outside that boundary. Independent real AIPanel + JSDOM reproductions
found ended UI states with valid branded authority. Reusing the retained host object and
its original runId through the real tool loop and Demo transport generated two outgoing
recording-stub requests containing the fictional `REVIEW_ONLY_LABEL_CANARY`, without
another UI approval. Cancellation while both digest promises were pending allowed active
authority to be written after the cancelled UI state was established.

The ordinary next Send creates another runId and does not automatically reuse this object.
This was a lifecycle/replay-authority defect, not evidence of automatic next-Send disclosure,
a malicious model minting authority, a real external disclosure, or broader G4 approval.

## Source fix independently rechecked

The implementation author added `AIObservationAuthorization.end`, epoch invalidation for
pending mints, and end calls from UI cancel/finish. The reviewer made no source changes.

The original independent script now observes no active authority after direct completion,
discovery failure, or cancellation during SHA. A separate verification script retains the
actual minted object across completion/failure and proves it is rejected as
`OBSERVATION_AUTHORIZATION_STALE`; replaying either object through the actual step transport
produces zero outgoing provider requests. A next consume revokes the previous object, and
the fresh object remains valid only until end. Source-level finding is resolved on the
hashes below; final artifact/report verification also passed on the rebuilt identity below.

## Commands actually executed

All commands ran from `/Users/yapweijun/Documents/GitHub/printform-js`.

- `node .printform-studio/ca05-evidence/slice2-independent-review/lifecycle-repro.mjs`
  before/after: exit 0; evidence in `lifecycle-before.json` and `lifecycle-after.json`.
- `node .printform-studio/ca05-evidence/slice2-independent-review/lifecycle-verification.mjs`
  after: exit 0; retained-object denial and zero outgoing requests.
- `node .printform-studio/ca05-evidence/slice2-independent-review/wire-audit.mjs`
  exit 0; original report/source/wire/check/mutation/history hashes and raw-wire assertions.
- `node .printform-studio/ca05-evidence/slice2-independent-review/boundary-verification.mjs`
  exit 0; Real/Unknown values blocked even with value/pixel flags, synthetic values separately
  allowed, arbitrary/pixel canaries excluded, initial-session stale dispatch sends zero requests,
  401 refresh refuses the third stale request, stale response rejects while accounting 12 tokens,
  and protected history survives snapshot/restore with ordinary history preserved.
- `node .printform-studio/ca05-evidence/semantic-wire-mutation.mjs positive`
  exit 0; `mutant` exit 1 at `actual outgoing semantic payload canary`.
  Independent rerun records and unchanged handler hash are in `mutation-independent.json`.
- Inline Node crypto audit: 36 original metadata hash pairs matched; four manifest resource
  hashes, all manifest identities, 12 source-to-site-dist equalities, and root/pinned app equality
  matched before source repair. `wire-audit-before.json` preserves the subsequent original
  source/evidence audit of 34 pairs, excluding the two already-verified built files.
- Read-only `git status --short`, branch identity, `rg`, `nl`, and bounded documentation reads.

No full suite/build/browser rerun was performed by the reviewer. Their existing command/log
records were inspected and hashed, not represented as newly executed independent tests.
One first invocation of the retained-object script used an incorrect relative import depth
and failed before collection (`ERR_MODULE_NOT_FOUND`); the path was corrected only in this
ignored reviewer script, then the command passed. The failed attempt receives no test credit.

## Independent retained-wire results

Chromium, Firefox, WebKit semantic wires each contain 10 requests and two unique receipts,
with revisions `[0,0]`. Exact function-call pairing and independently canonicalized content
SHA-256 match. Default-denied and following unapproved-run bodies contain neither label nor
static-text canary; both approved bodies contain both canaries. Unknown values, arbitrary
secret keys, and pixel canaries are absent throughout. Recovery uses a distinct run/receipt.

The three numeric wires each contain 11 requests and four unique receipts with revisions
`[0,0,0,1]`; their pairing and content/release hashes are corroborated without extending
this review into new slice-1 acceptance. The historical eight-request wire contains the
unapproved echoed text; its retained historical manifest matches its recorded package identity.

## Frozen identities

Original report MD: `b4c22037588743b176f6c2add3eea566a51c941d170a10acbeecb24bc8fd5ee9`

Original report JSON: `267d7ca4da5d67d7b63dd208b10ade3392b3dc3bc9fc4477ade61a05aa64919a`

Initial panel: `d9c7b7cb7d9941f4519adb4f3d2e16934efda3de7b4416bf91be805d209f4820`

Initial authorization: `754a21d3f0fd78315b5eab32b3cf7cff216fed4bc3769cc7fbcfe6da698da4b0`

Rechecked panel: `443df34c8224d5488bdc2c4942eadbe226bceec270af4d17bb9f966538c1356d`

Rechecked authorization: `2d5c76f2778172c4e59c84c98a123175a00d5aeb8b05cf679b4fd093ee247845`

Unchanged policy: `ada02e7dbffe4b727a9a53ebd381cbe125a65730c10f8fb599ca81d9f040e601`

Original built app: `c628094a029be9c713d17e568d33540d392d9132323c7a8f6824e1cafe5071a7`

Original manifest: `9f959b70261db50d79f43e3bf496254931d5753203e876d145d8a5aa450dc3a7`

All source/wire/check hashes and detailed command outcomes are retained in adjacent JSON.

## Remaining limits and minimum acceptance

No other actionable source finding was identified within this bounded review.
The required rebuild, new manifest/app/source identities, resource hashes, and retained raw
semantic wire positive/negative/history assertions have now been corroborated. Keep lifecycle regressions for direct answer, discovery
error, cancellation during pending mint, old-object replay, and next-consume revocation.

G4 remains open: pixels, crops, image modality, compaction image preservation, and independent
visual reconstruction comparisons were not implemented or approved by this review. No live
model competence, real provider spend, sensitive pixel disclosure path, or full CA-04 parity
was qualified. Routed instruction modules and `.agent/rules/03-verification.md` are absent;
the review follows the available core rules and explicit review acceptance boundary.

## Final frozen artifact verification

Executed `node .printform-studio/ca05-evidence/slice2-independent-review/final-artifact-audit.mjs`
with exit 0 after the implementation author froze the final MD/JSON, source, build, and wires.
Detailed results are retained in `final-artifact-audit.json`. No full/build/browser rerun was
performed by the reviewer. The current logs report 199 files / 1649 tests for both explicit
full and build regression, 66 contract examples / 27 reviewed changes, and 6 browser passes;
their bytes, command strings, and exit statuses were independently inspected and checked.

41 metadata SHA-256 pairs match, including all 14 listed sources, six current raw wires,
13 check logs, historical/mutation records, manifest, and app. Twelve runtime sources match
their site-dist copies. Root and pinned app/manifest match; the four manifest resources match
in both locations (eight resource assertions). The bundled app carries the current package
identity and both final report files match their site-dist copies. Initial archived report
hashes and six pre-review wire hashes remain unchanged; historical failure metadata stays
separate and its package identity differs from both reviewed success artifacts.

The six new raw wires all pair their receipts with the exact calls and current manifest
identity; independently sorted content SHA-256 matches. Semantic wires retain 10 requests
and two fresh run-owned receipts per engine: default and subsequent unapproved bodies have
no authorized-text/echo canaries, positive approvals have both, and value/secret/pixel canaries
are absent. Both semantic observations bind the same candidate but different run and policy
identities. Numeric corroboration retains 11 requests / four receipts per engine; generations
`[0,1,3,0]` prove edit/undo-to-identical-candidate bytes obtains another receipt, and the later
revision uses another run. This is corroboration within the review boundary, not full G4 credit.

Final report MD SHA-256: `841b41328201d800912b68da8a31fe33cb89ec12b6384581b4eb2229620fda8a`

Final report JSON SHA-256: `14c5f08816d498af9e2d48829841fbf153dbbab6f3800c5fa02093147d76bee5`

Final package: `d1361af68b92c4cfd8596360bcc6aed7a4f10ed793bb2c8c93b5720a6b7fa620`

Final app SHA-256: `dc07c21d110156cc2ae23af96b5385ce745079214f258017f37f612be3ac7764`

Final manifest SHA-256: `5c08fb6adb6d9ca9e91679a86a53d85a969f0c3918351c7bcb7c1393fa34b981`

Disposition: the one independently confirmed P2 is resolved and its saved-object replay
produces zero outgoing requests. No unaddressed actionable finding remains within the
reviewed slice-2 scope. G4, CA-04, real-provider competence/spend, and visual/pixel paths remain open.

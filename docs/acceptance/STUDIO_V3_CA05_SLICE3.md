# CA-05 slice 3 — receipt-bound fictional page/crop retrieval

Status: **Ready for review under the approved fictional static profile. CA-05 is Partial; full G4 remains open.**

Branch: `codex/studio-v3-ca05-observation`; base HEAD: `774db9283b444d5e75aa13e529856dfe8347e402`. Direct human approval authorizes only default-off per-run fictional page/crop development and testing. No real customer data or paid provider was used.

## Scope and ownership

- `observation-policy.js` retains text/value authority and enforces independent fictional pixel consent plus explicit host pixel-deny. Real-classified documents, embedded raster/signatures and encoded pixels are rejected; crops cannot bypass denied bound values. No automatic Imported/Real/Unknown value classification is added.
- `preview-pixels.js` captures the current active candidate in the existing opaque-origin sandbox. A canary rejects blank/unsupported foreignObject rendering. It rasterizes the whole measured page before cropping, removes selection decoration, declares scale and rejects unsupported content. Limits reuse `REFERENCE_LIMITS`.
- `observation-pixels.js` validates PNG signature/chunks/CRC/dimensions/bytes, hashes actual bytes and owns run-local custody. `retrieve_page` consumes the actual latest receipt and returns a new receipt with an opaque evidence ID, page/crop and selection hash. Capture and hashing recheck authority; cancellation rejects late publication.
- `agent-wire.js` sends the current PNG in a host-authored image input bound to the actual capture call/result. Compaction pins that pair and folding retains its result. Missing pairing/untracked image blocks fail; negotiated image support and aggregate image budgets are enforced without dropping pixels. Dispatch rechecks after session acquisition/401 refresh.
- Rejected unchanged operations preserve valid pixels. Accepted edits, undo, changed host state, expired/revoked grants and fresh observations invalidate old evidence. Protected answers remain excluded from later/recovered provider history.

CA-04 parallel authoring parity gaps do not block this preview/read service. Its service files and parity register are hash-identical to the starting dirty tree. Earlier acceptance reports are preserved. No CA-04 implementation or aggregate closure credit is claimed.

## Verification

| Check | Result |
| --- | --- |
| New pixel / wire / consent units | **38/38** (25 + 7 + 6) |
| Focused units plus prior semantic/consent/contracts | **6 files / 71 tests passed** |
| Full `npx vitest run --maxWorkers=1 --no-file-parallelism` | **204 files / 1752 tests passed** |
| `npm run check:studio-v3-agent` | Pass; 72 executable examples / 28 digest-bound reviewed changes |
| `npm run build:site` | Pass; its full 204-file / 1752-test run also passes |
| Metadata-only update checks / rebuilt site | **5 files / 23 tests passed**; site rebuilt with current identity |
| Validate/AI panel via actual transport and stubbed provider | **9/9**, Chromium / Firefox / WebKit; 3 new pixel paths plus 6 receipt/semantic regressions |
| Remove host image payload step mutation | Expected failure (exit 1); positive and restored recovery exit 0 |
| Independent raw-wire/resource/dependency audit | **114 requests / 42 receipts / 9 evidence IDs / 15 image-bearing requests; 8 resource copies / 138 dependency hashes** |

The browser fixture runs Validate All before capture. It tests default denial, separate single-run consent, page/crop capture, no reuse in an unapproved next run, revision-change revocation, invalid-page rejection and fresh inspection/recovery. PNG hashes, tool-call pairing and actual receipt geometry are independently checked. Cropped RGBA pixels equal the corresponding full-page pixels exactly; the blue canary exceeds 50 actual pixels in each engine. The unit canary is also independently inflated with Node zlib. Compaction is exercised through the actual transport with more than 400000 context characters.

Native JSON reporter evidence is retained at `.printform-studio/ca05-slice3/browser-published-json.report.json`; independent audit at `.printform-studio/ca05-slice3/audit-published.json`. [Machine evidence](STUDIO_V3_CA05_SLICE3.json) records exact commands, elapsed times, source hashes, failures/recovery and final identity. It binds the latest browser receipts to this metadata-refreshed artifact; full runtime verification is retained from the unchanged implementation.

## Final identity

- contractHash: `4fcda4ac93deb4bc96ec243fcca26ccf75611c7b0b49b8c16ff56db750dff87b`
- knowledgeHash: `f7c76533aff5b4850f651d6fb352c533203c550c9a856c8e95601ed9ab08f32d`
- packageHash: `212f0a9f9b05036f32cff363aeb709b97105be667e9802fb2756cc2f8d4abf81`
- appHash: `65834f5bed0948996fd99504ddaa14504e741edcf3e38b808f2d57b331b938a5`
- manifestHash: `79eb484ddabfd15d994dcd9a165662edd4889becb22943d0e7aba6fd5c2043cb`

## Failures and recovery

Retained failures include the initial revision freshness test (1/41), browser fixture loader failure (0 cases executed), crop/height assertions (3/3), unsaved-revision assertion (3/3), corrupt unit-PNG inflate and evidence-reporter audit. They are not reclassified as invalid environments. The current guards, genuine PNG fixture, crop implementation and native JSON reporter pass the recorded recovery checks. Additional boundary regressions protect rejected-operation retention and cancellation during receipt hashing. Earlier successful checks are retained as intermediate snapshots rather than relabeled as final-artifact evidence.

## Remaining limits

This slice proves the approved fictional page/crop retrieval and actual outgoing wire. It does not close full G4: final comparison and deterministic deliberate text/section/width/alignment/pagination defects remain for later slices. DOM rasterization does not establish native-print fidelity or general-document quality. Sensitive-asset authorization, real-data transmission, downstream-vendor retention and live-provider qualification remain unapproved/unrun. All tests use local/stubbed providers. No deployment, commit, push, PR or merge occurred.

The requested `.agent/rules/03-verification.md` is absent. This report uses the available verification module and explicit acceptance requirements. TASK, ledger and registry record only bounded evidence and retain Partial/proposed status. Stop for review.

# Studio v3 visual capability follow-up

## Current evidence

PR10 merged as main `73035954db3511acdae1fc361c78273674b64cb8` with reviewed tree `f540c545b8a6a321c641d09d0c23dd0f4beafa6b`. Main CI `37072963318` and its automatic Pages deployment succeeded on 2026-10-02. Public HTML and the normal UI version both identify that main commit.

At 23:21 UTC on 2026-10-02, the registered public Studio origin's normal **Discover available models** action displayed these sanitized facts for both `demo-fast` and `demo-auto`: `capabilities.responses: true`, `capabilities.multimodal: true`, `capabilities.chat_completions: true`, `capabilities.streaming: true`, and `capabilities.structured_output: true`. The UI reported no document sent. This establishes the current advertised field names, not successful visual interpretation.

The public release passed synthetic catalogue/A5 (45 rows, four pages, RM12,150, zero quality issues), text PDF extraction, oversized embedded image rejection, visual PDF cancellation/retry and JPEG scanned-page local preview checks. Images were not sent. The cloud-browser download event timed out despite a Save toast, so that observation alone was not a pass. A separate isolated Air Chromium check on the exact public revision subsequently closed the gap: 14,656 downloaded bytes, switch to blank, Open restored 45 rows/three pages, and re-save differed only in documentId. It reported no runtime/console/HTTP errors and closed its isolated browser. The earlier cloud timeout was not reproduced and its cause is unknown; it is not an established product defect. Exact-main CI also covers saved-byte parsing/reopen. Physical printing remains untested.

## Narrow change

Accept image eligibility only from strict boolean `true` on both `capabilities.responses` and `capabilities.multimodal` for an existing allowlisted Demo alias. Missing, false, string-valued, inferred and historical metadata remains insufficient. No endpoint, origin registration, credential, privilege or parser-limit changes are included.

The existing bounded Responses route sends only explicitly attached local image/page previews alongside reviewed context. Existing selected-scope, protected financial binding/value, untrusted-reference, Preview/Apply/Undo and cancellation boundaries remain applicable. Discovery is renewed before inference; revoked capability must prevent dispatch.

## Required evidence and gates

- Unit: exact contract, malformed/absent/revoked capabilities, failed discovery, clearing and cancellation races, bounded Responses payload and no remote images.
- Hosted Chromium/Firefox/WebKit: actual PNG and scanned-PDF parsing, capability discovery, explicit Send to a controlled provider, selected-label Preview/Apply/Undo, unchanged supplied totals, unsupported/revoked capability, late reply after Stop, rejected financial mutation. These prove application behavior, not model perception.
- Independent exact-head source review and full build/check/protocol validation before Draft PR publication.
- Actual live visual interpretation is still OPEN until this reviewed code is available through the registered public origin. Use one fictional geometric/color reference, no customer records. Ask the model to identify visual content not supplied as text, then validate a bounded layout edit with Preview/Apply/Undo and unchanged data. Never bypass the denied local origin or enable arbitrary URLs/tools/files.
- A Draft PR is not authorization to merge or manually deploy. No physical-print or universal PDF memory-sandbox claim is made.

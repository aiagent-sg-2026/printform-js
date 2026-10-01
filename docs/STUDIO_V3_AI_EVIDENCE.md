# Studio v3 bounded AI layout slice — review evidence

Base: `fd32f9085930df86744ecd8819e4c89db405efc5` (main). Branch:
`feat/studio-v3-ai-editor`. Local isolated clone:
`/Users/yapweijun/Documents/Codex/2026-10-01/task-4/printform-v3-ai`.
Both prior checkouts were inspected and retained without edits.

## Architecture and compatibility

Official source verified at the repository's reviewed Pi commit
[`b2602be77cb7b0de45dd616407fd210daa48aa75`](https://github.com/earendil-works/pi/commit/b2602be77cb7b0de45dd616407fd210daa48aa75):
[Harness specification](https://github.com/earendil-works/pi/blob/b2602be77cb7b0de45dd616407fd210daa48aa75/packages/agent/docs/harness.md),
[package family](https://github.com/earendil-works/pi/blob/b2602be77cb7b0de45dd616407fd210daa48aa75/README.md),
and installed public exports/types were checked. Pi is TypeScript/JavaScript;
`AgentHarness`, lanes, hooks, `MemorySessionRepo`, and pi-ai provider/stream
extension APIs are real pinned upstream objects, exercised by unit/browser tests.
No Python harness, CLI shell, file access or local inference daemon is invented.

Existing v2 migration and qualification source was read before implementation.
v2's embedded panel is still AGRUN; PI-00..04 qualify actual Harness/browser
surfaces independently. Their direct-BYOK transport cannot be sent unchanged
to the policy-restricted Demo API. v3 therefore uses an explicit provider
extension: one plain-text JSON envelope is strictly checked and mapped to one
local `preview_layout` tool. Native provider tools/schemas remain absent. The
local tool compiles a candidate but has no commit/export/financial capability.
The sole human Apply path compiles the validated design to FormSpec and uses
the existing v3 controller/CommandBus, preview/runtime, history and file format.

No dependencies, versions, registrations, grants or credentials were added.
`github-pages` is the project ID found in the existing source and guide.
Browser Origin is supplied by normal CORS, never a fabricated request header.
Default selected alias is `demo-fast`; `demo-auto` can be selected explicitly.
Only discovered aliases are eligible. This selection is independent of coding
worker model restrictions. No success is claimed for an undiscovered live alias.

## Live provider blocker

Actual Chromium calls on 2026-10-01:

| Browser Origin | Existing project | Session endpoint | Result |
| --- | --- | --- | --- |
| `http://127.0.0.1:4174` | `github-pages` | `https://gpt.yapweijun1996.com/demo/session` | HTTP 403, no token |
| `https://yapweijun1996.github.io` | `github-pages` | same | HTTP 403, no token |

These are real calls from pages at the listed Origins, not intercepted
fixtures and not forged Origin headers. No inference request or user business
data was sent. The exact project ID comes from `studio-v2/ui/agent-demo-gateway.js:2`,
`studio-v2/AGENT_SETUP.md` (Current browser Demo Gateway) and the historical
read-only source record `docs/STUDIO_V2_S17_PI04_EVIDENCE.md:101`.
KB retrieval returned older v2 provider/history memories, not a current live
registration row. No gateway admin registration API/configuration was read.
The probe retained HTTP status only, not the response message; the public
probe parsed JSON but found no safe `error.code`/`code` value to report.
HTTP 403 does not prove an unregistered origin: wrong project, disabled Demo,
Turnstile or project/origin policy remain unclassified. No repeat denied
request or alternate project ID guessing is authorized. Gateway registration/session access must be checked
by its owner; earlier September registration success does not establish current
availability. We did not alter the server or retry with a different project/key.
Models/capabilities and inference success remain blocked by session issuance.
The opt-in `scripts/probe-studio-v3-demo.mjs` uses only bundled fictional data
and stores sanitized paths/statuses/UI outcomes, never tokens, bodies or traces.

## Deterministic verification

- New unit gates: strict allowlist, unsafe/extra/duplicate/prototype/type/range
  edits, unchanged ERP values/bindings/data, one CommandBus undoable commit,
  actual Harness tool run, failed/malformed result, abort and late reply,
  stale bus/revision/base, delayed queue identity/generation, Demo wire fields,
  401 refresh/expiry/rejected refresh, absent aliases, rate/server failure,
  truncated/oversized/native-tool replies, zoom allowlist/storage failure.
- New three-engine browser cases: explicit disclosure/consent; single alias
  request; diff and actual runtime preview; Apply/Undo with unchanged ERP values
  and A4 dimensions; malicious/malformed responses; 403 and 401 retry; cancel,
  stale edit/new-document disclosure; draft Stay/Apply; default Fit page,
  increment/reload/invalid value/refit; SVG labels and mobile keyboard focus.
- Existing v3 suites cover all files, datasets/IndexedDB, failures, field tree,
  draft recovery, history, standalone output, A4 PDF, 0/1/45/100/500-row and
  bilingual pagination plus the five required desktop/tablet/mobile viewports.
- Browser commands use `PLAYWRIGHT_SKIP_BROWSER_GC=1` and `--workers=1`.
  Shared browser installation was not installed, replaced or garbage-collected.
- A sandbox-only initial full run could not open localhost sockets. The full
  build was rerun with localhost permission; those failures are not pass credit.

Local final gates passed **650/650 unit tests** across 113 files and
**111/111 Studio v3 browser tests** across Chromium, Firefox and WebKit
(37 per engine, including 8 new AI cases per engine). Build/site generation
passed. Exact-head aggregate CI is recorded in the draft PR after the final
reviewed commit. Screenshots and browser receipts are attached to the CI artifact
and retained locally under `output/playwright/` / `test-results/`.

## Independent review and release boundary

Independent reviewer examined source without changing files or running browsers.
Findings repaired before final verification: disclosure refresh after installing
another document; queued Apply identity/generation checks; truthful session
failure wording after a 401 refresh; disabled interactions while Apply completes;
draft Stay visibility/focus and mobile Tab trapping. Final independent source review reported no remaining major findings; the
reviewer verified the repaired state with Node/JSDOM checks. The draft PR
records this review and the exact commit. No merge or Pages/public release is authorized here.
The live session blocker and native printer/production qualification remain open.

# Studio v3 version updates and mobile view

The current app build is shown in the status bar on desktop and mobile as
`v3 · <12-character source SHA>`. The full SHA is the label's title and the
`printform-source-revision` metadata. It describes the loaded page, rather than
the service worker that may have been activated by another tab.

## Update lifecycle

- v3 registers `./sw.js` with its own `/studio-v3/` scope and cache prefix.
  v2 registration, cache and update UI are untouched.
- The build stamps immutable `releases/<full SHA>/` URLs for bundled JS,
  styles, chunks and both existing print runtimes. Preview and HTML export
  use the same release's runtimes through the existing serializer.
- Installation fetches the complete generated shell and verifies every
  file's SHA-256 before completing. Download/integrity failure removes only
  that incomplete new cache. The previous worker and work remain available.
- A waiting build displays **Update to `<SHA>`**. **Check for updates** retries
  discovery/download. Checking and installing never reload a page.
- Only confirmed Update sends the exact-build activation message and reloads
  this tab. Other tabs continue editing on their immutable old resources;
  they offer the new build, without changing their loaded version label.
- Update requires an online browser navigation. Offline checks/confirmation
  retain the old page and work and ask for a manual retry after reconnecting;
  going online never triggers a reload. This also avoids WebKit's observed
  offline navigation error. Navigation failure is bounded and stops the
  pending navigation before editing is re-enabled, retaining the backup.
- Old shell caches are retained for these open clients. Storage quota errors
  fail installation rather than clear other work. No IndexedDB, localStorage,
  dataset, imported document or gateway response is removed or cached.
- `local` builds deliberately avoid offline caching, preventing a fixed local
  cache from hiding changes. Upgrade tests use two different 40-character
  build IDs, real installed workers and the deployed asset structure.

## Protecting work

The dialog always offers **Keep work & update**, **Discard work & update** and
**Stay** (also Escape). Keep requires an explicit user choice to temporarily
persist document data locally in this tab's sessionStorage. It stores the
controlled template, active and baseline data/source, history, field/binding/
style/locale/JSON/table drafts, AI input and bounded conversation/diffs. It contains no
Demo token, authorization header, model session, arbitrary executable markup
or provider credential. It never saves or overwrites a database dataset.

Before activation, the bounded snapshot is serialized, written, read back
byte-for-byte and decoded; every saved draft form/control must be rebuildable.
Recovery regenerates controlled HTML/CSS/FormSpec and preserves revision and
history. Saved datasets and their compare-and-swap revisions are untouched.
Invalid JSON/table input stays an unapplied draft. Recovered AI diffs are validated and displayed as expired conversation history;
legacy v1 proposals also become expired. They cannot Preview or Apply. Send a
new request for the recovered form; consent resets and no request resumes. Confirmed update cancels in-flight inference only
after persistence succeeds. Stay preserves the running request and work.

Storage quota/security/verification errors block activation. Failed recovery
retains its backup and exposes a download and a separately confirmed Discard
recovery backup action. Download alone never removes the backup; explicitly
discarding that retained backup enables another update.
Snapshots larger than 4 MiB require saving/exporting first. Tab-only database
fallback blocks Update so its in-memory saved records cannot be lost. File
reads, edits and database writes must finish before a snapshot/update.
Successful recovery removes the temporary backup. Session storage is not a
portable save or protection against closing/clearing the browser session.

## Mobile and accessibility

The viewport remains `width=device-width,initial-scale=1` without a
`maximum-scale` or `user-scalable` restriction. Editable text is at least 16px
on layouts up to 1100px, including property/binding inputs, dataset tables,
JSON, AI text and Zoom select, to reduce iOS focus enlargement. This preserves
OS/browser accessibility and pinch zoom; automated WebKit is not a claim that
every Safari/device gesture is suppressed. Paper Zoom remains separate,
defaults to Fit page, validates remembered localStorage values, and refits
when the available workspace changes. Print dimensions/data/revision do not
change when the viewport or panels change.

## Verification

`tests/studio-v3-update.test.js` covers build manifests, verified persistence,
malformed/unsafe recovery, runtime pinning, bounded checks and shell policy.
`e2e/studio-v3-upgrade*.spec.js` uses a real two-build HTTP server with SHA-bound
assets, real workers and synthetic nonprivate work. It exercises desktop,
tablet/mobile, offline protection/retry, failed/mixed downloads, old/new concurrent
clients, drafts/history/datasets, AI preview/cancellation, malformed recovery,
quota/tab-only failure, delayed file reads and keyboard/mobile typography.
The gateway adapter in these deterministic tests prevents model calls; it
does not assert live provider availability. Existing v3 and aggregate v2
gates still run with browser workers=1 and `PLAYWRIGHT_SKIP_BROWSER_GC=1`.

An existing pre-PWA v3 tab has no updater and needs one ordinary user reload
to receive this first release. Subsequent releases support the Update button.
Native printer output remains an owner review boundary; this is a Pilot.

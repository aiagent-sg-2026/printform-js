# Gallery preview and release contract

## Catalogue order

`js/order.js` is the display-order owner. The manifest has no chronological field.
PF numbers represent successive additions, so the explicit convention is descending
**numeric** PF number (PF-063 first), not invented timestamps. Number ties and unknown
legacy numbers retain their input order; canonical manifest objects are never changed.
All filters, locale changes and history restoration operate on this same ordered list.

## Native preview dialog

`shared/dialog.css` owns dialog geometry, viewport/safe-area constraints, surface,
spacing, border, elevation and layer tokens. It follows the project's existing native
`dialog` pattern; no framework or Studio-wide stylesheet is introduced.
`shared/dialog.js` owns background locking/restoration, backdrop policy (outside the
border only), Tab traversal including same-origin iframe controls, Escape and focus
return. Native `showModal()` makes the background inert. `js/modal.js` owns only design
metadata, navigation, readiness/error state and actions.

The iframe's **native document** is the only document-preview scroll owner. Neither
the dialog nor its flex body scrolls; the body has `min-height:0`. Header, close and
footer actions remain outside the iframe. There is no transform, print-page scaling,
wheel interception or touch cancellation. On narrow screens the document may need
native horizontal panning to preserve its authored paper width. Toolbar changes and
long datasets change the native scroll range immediately, without height polling.
Readiness polling is bounded; a failed preview keeps an Open design recovery link.
No postMessage bridge is needed: the preview is same-origin. Escape handlers are
detached on navigation/close and the page-wide controller is created once.

## PWA versions and update safety

Gallery retains its own scope, worker and cache prefix; Studio/user storage is untouched.
The site build stamps `printform-build` into the loaded HTML and copies modules,
styles, templates, shared assets and engine into immutable `releases/<build>/` paths.
The footer labels the **loaded page**, never network metadata or another tab's worker.
A source checkout without the site build is explicitly local/unversioned.

Installation checks network-only `build-info.json`, downloads the complete release,
verifies SHA-256 for every precached resource, and rechecks build identity. Any failed
asset or integrity check deletes only the incomplete new application shell cache.
The active build remains usable. Metadata requests bypass shell and HTTP caches.
Root navigation uses the active shell, not new HTML mixed with cached old modules.

The existing Gallery policy is preserved: discover/download automatically, but
**activate and reload only on Update now**. Check for updates really calls
`registration.update()` and reports checking, current, available, offline or failure.
A waiting/active worker must report a different, installed build before it is offered.
New activation requests target that exact build and reload at most once after controller change.
For migration, the original one-field `SKIP_WAITING` user action is also accepted only
from a same-origin Gallery-scope client; unrelated clients and mismatched build IDs
cannot activate the waiting worker.
No open preview is interrupted; close it first, then choose Update now. URL filters
and browser history survive the reload. Another tab's activation never reloads this
tab; its old immutable resources remain usable until that tab chooses to update.

Reconnect schedules one delayed check (network stacks may lag connectivity events),
not activation. Browsers can report online despite network failure, especially after
an offline cached reload; the failure is visible and the manual check retries it.
Unsupported SW is explicit. Retried activation includes a new bounded timeout.
Old shell caches are retained while clients exist, protecting old tabs; activation
with no clients cleans obsolete Gallery shells. This is conservative retention, not
a global storage reset. Long-running installations may retain several old shells
until a client-free activation. Quota errors fail a new install safely.

## Verification

- `tests/gallery/order.test.js`: numerical order, stable fallback/ties, immutable input.
- `tests/gallery/update.test.js`: safety/state/retry contracts, including unsupported SW.
- `e2e/gallery-preview.spec.js`: actual wheel, PageDown/Up, mobile CDP touch gesture,
  first/last-page reachability, dynamic A4/A5 and short/long data, short viewport,
  PF055/056/057/063, focus, Tab/Escape, background restoration and recovery.
- `e2e/gallery-upgrade.spec.js`: bounded real localhost A/B builds and real workers,
  waiting activation, no unsolicited reload, multi-tab versions, filters, offline,
  reconnect, same-version, failed download and corrupted assets. Fixture cleanup is
  owned by the test. No production deployment/profile/cache is used.

A screenshot showing 53 designs cannot establish its cause. An old active worker's
cache-first manifest can preserve an older catalogue, and the prior mixed HTML/module
policy was unsafe, but historical deployment/cache state is not available to prove
which occurred. A pre-fix open page still needs its existing Update now action or an
ordinary reload to receive the new updater; no code can retroactively replace its JS.

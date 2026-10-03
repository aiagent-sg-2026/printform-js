# PR11 browser-acceptance repair

This follow-up preserves frozen source `1e99d25765b22869b47c2ccb35c43e4634c3d6b1`
(tree `f93d8c8b55d2a36498b763c2176cc5772fc5191c`) and repairs findings from
[CI run 37083112339](https://github.com/yapweijun1996/printform-js/actions/runs/37083112339).
The original browser run was still executing when these bounded fixes were
prepared. This document does not claim that its later engines or the repaired
revision passed browser acceptance.

## Verified findings and fixes

1. Apply and Undo correctly display a revision plus “unsaved template”. New tests
   expected only `r1` or `r2`. They now require the exact revision and dirty label;
   actual Save downloads must clear dirty without changing revision. Visual-input
   cases also require unchanged `r0` before Apply, exact 12pt/700 after Apply and
   exact `r2` dirty state plus restored typography after Undo.
2. New chooses a compatible remembered dataset or the first title-sorted record.
   Nine A4 cases incorrectly assumed the first unsorted catalogue fixture. No Save
   race was found. Tests now explicitly select their fixture, inspect active ID
   and name before every Save, read the downloaded bytes and compare all source
   data, keeping edited labels and reopen checks. New's selection/title/currency
   and save identity are locked by 22 unit tests.
3. Bank campus fixtures have two supplied allocation rows. They cannot be forced
   to prove long-form pagination. All seven real 64-row campus fixtures still must
   span pages; every case retains row-order, headings, page numbers, totals/notes,
   overflow and standalone-export equivalence checks.
4. A4 page errors reproduced an unsafe getter access injected by Playwright
   1.62.0's `serviceWorkers: 'block'` mode. Its initialization script reads
   `navigator.serviceWorker` in every frame, including the intentionally opaque
   preview iframe; that getter throws SecurityError without `allow-same-origin`.
   The document runtime has no service-worker code. The A4 spec now uses normal
   service-worker handling. It still rejects page errors and keeps the exact
   `allow-scripts allow-modals` sandbox. No error filtering or permission expansion
   was introduced.
5. The composer footer query also matched printed footer copies in thumbnail
   shadow roots. It now requires the one `body > footer.status-bar` and keeps the
   same status, source, version and update-control checks.
6. Firefox exposed a real source-editor focus race: uncancelled 50ms open/close
   timers could steal a subsequent text-editor or toolbar selection. This panel
   uses synchronous `display:none` visibility, so focus now moves synchronously.
   Its original browser locale-focus assertion is unchanged. Nine new tests fail
   on the old implementation and pass with the fix, including five locales and
   rapid close/reopen. The inspector's separate animated focus mechanism is
   unchanged.

## Local verification

- `npm run build:site`: exit 0, 139 test files / 1,048 tests, then full assets and
  static-site generation.
- `npm run check`, `npm run check:agrun` and three v2 sample protocol/attestation
  validations pass.
- Independent isolated review: 74 focused tests pass; no known source blocker in
  the reviewed patch. The new focus tests demonstrably reproduce the old failure.
- `git diff --check` passes. Browser discovery is not execution.

No test has been changed to accept arbitrary revision prefixes, alternate data,
missing printed rows, errors, or arbitrary focus destinations. The next gate is
exact-head hosted browser execution, followed by the existing ten-form visual/PDF
and real-model acceptance requirements. This repair task did not push or deploy.

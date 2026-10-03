# Real model acceptance ledger

This ledger records explicit synthetic UI runs separately from mocked-provider browser tests. A green parser/layout check does not establish that the requested design was implemented. Never transmit customer records or user screenshots in these checks.

| UTC | Public revision | Input / model | Observed result | Acceptance |
|---|---|---|---|---|
| 2026-10-02 23:45 | 73035954db3511acdae1fc361c78273674b64cb8 | `row data table bg style use yellow`; demo-fast; text only, no attachment | Read-only answer explains that table-row background fill is not exposed. Revision remains r0. UI reports 4,987 tokens. | Honest unsupported result; user requirement remains unmet. This attempt did not reproduce the screenshot's false yellow-row promise. |

| 2026-10-02 23:52 | 73035954db3511acdae1fc361c78273674b64cb8 | Only make the Ship to label 12pt bold; selected field scope; demo-fast; no attachment | One inspection round, proposal changes only label-customer-ship labelStyle. Explicit Preview computed Ship to at16px/700; existing values and total unchanged. UI reports5,206tokens. Apply interaction timed out and cloud tab disappeared before outcome verification. | Proposal/Preview pass; Apply/Undo/roundtrip for this live run INCOMPLETE due to browser interruption, not counted as success. |

Two explicit Sends have been performed for this ledger. Internal provider call count is not asserted where the normal UI does not expose it. No visual-media request has been dispatched by this acceptance run.

## Required completion matrix

For each of ten distinct A4 business forms: choose its template, choose a kind-compatible fictional source, ask the registered real model for a concrete bounded design change, inspect requested visual effects rather than summary text, Preview, explicitly Apply, manually edit, Undo, Save actual bytes, Open again and verify bindings/currency/amounts/layout, then inspect print preview and multi-page results. Include long names and long line-item cases. Record requested versus actual changes and failures individually.

Also cover standalone synthetic image and scanned/text PDF input, same scope/value protection, Stop and late responses, capability revocation, invalid/oversized references, compact and mobile composer/chooser behavior. Live image interpretation remains open until the reviewed capability change is deployed on the already registered origin. Do not bypass origin restrictions or confuse normal model metadata with successful perception.

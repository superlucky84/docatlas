# Checkout — Implementation plan

Phases with entry criteria, baseline tests, and exit criteria. Each phase lists the IDs it covers
(`Refs:`) and, once done, the files it changed (`Files:`).

[Requirements](./REQUIREMENTS.md) · [Design](./DESIGN.md) · [Manual checks](./MANUAL_TEST_CHECKLIST.md)

## Phase 1 — Cart lock and totals: done

Refs: RQ-2, DC-2, M-2

Entry: DC-2 closed.

- [x] Lock prices through `POST /cart/lock`.
- [x] Show tax and shipping before the pay button.

Baseline tests: totals and lock-expiry unit tests pass.
Exit: M-2 passes on a local build.

Files:
- `services/checkout/cart-lock.js` (added)
- `services/checkout/totals.js` (added)
- `services/checkout/totals.test.js` (added)
- `web/checkout/summary.js` (modified)
- `docs/checkout/IMPLEMENT.md` (modified)

## Phase 2 — Guest session: done

Refs: RQ-1, DC-1, M-1

Entry: DC-1 closed.

- [x] Issue a signed guest session cookie.
- [x] Create orders for guests without an account.

Baseline tests: session signing and guest order tests pass.
Exit: M-1 passes on a local build.

Files:
- `services/checkout/session.js` (added)
- `services/checkout/session.test.js` (added)
- `services/checkout/orders.js` (modified)
- `services/checkout/legacy-cart.js` -> `services/checkout/cart.js` (renamed)
- `docs/checkout/IMPLEMENT.md` (modified)

## Phase 3 — Payment intent: in progress

Refs: RQ-3, DC-3, M-3

Entry: payments sandbox keys are available. DC-3 must close before retries are built.

- [x] Request a payment intent after the address step.
- [ ] Keep the cart and address after a decline (RQ-3).
- [ ] Retry timed-out payments — blocked by DC-3.

Baseline tests: a decline keeps the cart; order creation is idempotent.
Exit: M-3 passes on a local build.

## Phase 4 — Test Hardening

Refs: RQ-1, RQ-2, RQ-3

- [ ] Cover expired locks, double submits, and slow payments.

Exit: every phase's baseline tests pass, and no critical review finding is open.

## Phase 5 — Integration Test

Refs: M-1, M-2, M-3

- [ ] Run end-to-end checkout against the payments sandbox.

Exit: M-1 to M-3 pass on a staging build.

## Handoff

- Done: Phases 1 and 2; the payment intent step of Phase 3.
- Next: keep the cart and address after a decline (RQ-3).
- Blockers: DC-3 retry policy is `TBD`.
- Latest commit: 4f2c1ab.

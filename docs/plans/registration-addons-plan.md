# Registration Add-ons (Merch) — Implementation Plan

Source: research memo "Selling Merch Through Registration" (wodsmith-merch-addons-research.wzrrd.sh, June 11 2026).
Decision: **Option A — in-flow registration add-ons** with a platform-owned catalog, sold inside the existing
registration Stripe Checkout Session. **Gated behind a team entitlement** so platform admins control which
organizing accounts can sell merch.

## Scope (Phase 1, scoped hard)

- Organizer defines add-on products (name, description, price, optional image URL, size variants,
  availability) on a new **Merch** page in the organizer dashboard.
- Athletes see an optional **Event merch** section in the registration form; selections become extra line
  items in the same Stripe Checkout Session and extra `commerce_purchases` rows (type `ADDON`).
- The checkout-completed workflow records add-on purchases **without** creating registrations, enforcing
  per-variant stock with an atomic conditional update + auto-refund on loss.
- Fulfillment: counts-by-variant report + per-athlete pickup list on the Merch page. Venue pickup only.
- Availability controls: `availableUntil` deadline (default mode; evaluated end-of-day in the competition's
  IANA timezone, same semantics as `registrationClosesAt`) and optional per-variant `stockQty`.

Out of scope (Phase 2+): post-registration purchases, standalone store, shipping, registration-refund
prompts for accompanying merch refunds, per-variant price overrides, custom personalization fields.

## Entitlement gate (the admin control)

- New feature key `REGISTRATION_ADDONS = "registration_addons"` in `src/config/features.ts` plus a
  `features` table row (seeded in `scripts/seed/seeders/02-billing.ts`; insert the same row in production).
- The existing admin UI at `/admin/entitlements` lists features straight from the `features` table and
  grants/revokes per team via `grantTeamFeature`/`revokeTeamFeature` — the new feature appears in the
  dropdown automatically. No new admin surface needed.
- Enforcement (server is the authority):
  - All organizer CRUD server fns call `hasFeature(organizingTeamId, FEATURES.REGISTRATION_ADDONS)` and
    throw when missing.
  - The athlete-facing catalog fn returns an empty list when the organizing team lacks the feature
    (covers entitlement revoked after products were created).
  - `initiateRegistrationPaymentFn` rejects `addOns` items when the team lacks the feature.
  - Organizer Merch page renders a locked state when not entitled.

## Schema (drizzle, `apps/wodsmith-start/src/db/schemas/`)

New file `competition-products.ts`:

- `competition_products`: id (`cmpprod_` ULID), competitionId, name, description, imageUrl,
  priceCents, maxPerAthlete (nullable = no cap), availableUntil (nullable `YYYY-MM-DD` varchar(10)),
  status (`ACTIVE | HIDDEN | ARCHIVED`), sortOrder, commonColumns. Index on competitionId.
- `competition_product_variants`: id (`cmpvar_` ULID), productId, label (e.g. "L"), stockQty
  (nullable = untracked), soldQty (default 0), sortOrder, commonColumns. Index on productId.
  Products may have zero variants (no-size items); purchases then carry a null variantId.

`commerce.ts` additions to `commerce_purchases`: `variantId` (nullable) + `quantity` (default 1).
Each add-on line item gets its own purchase row whose `productId` references a lazily-created
`commerce_products` row (`type=ADDON`, `resourceId=<competition_products.id>`), mirroring how
registration purchases lazily create their product row. Purchase metadata stores
`{ addonProductId, addonName, variantLabel, quantity, unitPriceCents }` for reporting resilience.

Migration generated with `pnpm db:generate --name=registration-addons` (no hand-written SQL).

## Pricing & fees

- Per-unit all-in charge = `calculateCompetitionFees(priceCents, { ...competitionFeeConfig, platformFixedCents: 0 })`
  — merch pays the percentage platform fee but **not** the $2 fixed fee (memo recommendation), and follows
  the competition's existing pass-stripe/pass-platform configuration.
- Purchase totals = per-unit breakdown × quantity (no rounding drift between the fee summary, the Stripe
  line item `unit_amount × quantity`, and the recorded purchase row).
- Coupons never discount merch: the discount base remains the registration subtotal only
  (`couponDiscount = min(amountOff, registration fees)`), unchanged.

## Checkout flow changes (`initiateRegistrationPaymentFn`)

- Input gains `addOns: [{ productId, variantId?, quantity }]` (optional, duplicates rejected).
- Validation: entitlement on organizing team; product belongs to competition, `ACTIVE`, deadline not
  passed (`isDeadlinePassedInTimezone`); variant required iff product has variants and must belong to it;
  quantity ≤ maxPerAthlete; soft stock check (`soldQty + qty ≤ stockQty`).
- The all-free shortcut only applies when registration total after coupon AND add-on total are both zero —
  a free division + paid shirt routes through Stripe (free divisions still register immediately inside the
  paid path, as today).
- Add-on purchases are appended to `purchaseIds`/`lineItems`; session metadata unchanged in shape
  (`purchaseIds` comma list), so the webhook fan-out needs no changes.

## Workflow branch (`stripe-checkout-workflow.ts`)

`createRegistration` short-circuits to `completeAddonPurchase` when the purchase's product type is `ADDON`:

1. Idempotency: already COMPLETED → skip.
2. Stock (only when variantId + stockQty set): atomic
   `UPDATE ... SET sold_qty = sold_qty + qty WHERE id = ? AND (stock_qty IS NULL OR sold_qty + qty <= stock_qty)`;
   zero rows affected ⇒ oversold ⇒ mark purchase FAILED + partial refund of the add-on amount
   (`reverse_transfer: true, refund_application_fee: false`, matching `refundRegistrationFn`) + REFUND event.
3. Deadline mode needs no re-check (commitment made at checkout creation; Stripe's 30-minute session expiry
   bounds the race).
4. Group behavior: if every registration purchase in the same checkout session has FAILED (capacity
   auto-refund path), the add-on is refunded too instead of completing. (Workflows per purchase run in
   parallel, so a rare ordering race can still complete an add-on before a registration fails — logged,
   accepted for v1.)
5. Otherwise mark COMPLETED + `recordPaymentCompleted`. Returns null so email/Slack registration steps skip.

`checkout.session.expired` already cancels all PENDING purchases for the session — covers add-ons for free.

## Server fns (new `src/server-fns/competition-addon-fns.ts`)

- `listCompetitionAddonsFn` (organizer; products + variants + sold counts + `entitled` flag)
- `getPublicCompetitionAddonsFn` (athlete; entitled + ACTIVE + deadline-not-passed only; includes per-unit
  all-in charge and per-variant soldOut flags)
- `createCompetitionAddonFn` / `updateCompetitionAddonFn` (with variant upsert) / `archiveCompetitionAddonFn`
- `getAddonSalesReportFn` (counts by product/variant over COMPLETED purchases + pickup list)
- Auth mirrors coupons: site admin or organizing-team admin/owner; mutations also require the entitlement.

## UI

- **Organizer**: new route `/compete/organizer/$competitionId/merch` + "Merch" sidebar entry under
  Business + breadcrumb label. Locked card when not entitled; otherwise product CRUD (price in dollars,
  variants editor with optional stock, availability date, max per athlete, status) and the two fulfillment
  tables.
- **Athlete**: `AddOnsSection` between the coupon section and fee summary in both registration form
  variants; card per product with size select, quantity stepper, availability copy, sold-out states.
  `FeeSummarySection` gains add-on lines and includes them in the total. Selections ride along in
  `initiateRegistrationPaymentFn`'s `addOns` input. Zero friction to skip.

## Tests

- Pure logic in `src/utils/addon-availability.ts`: availability (status/deadline/timezone), variant stock
  math, per-unit fee multiplication — unit tested.
- `competition-addon-fns` validation tested with `FakeDrizzleDb` mocks, following `coupon-fns.test.ts`.

## Risks / explicit decisions

- Merch platform fee is %-only (no $2 fixed). Single-line change in `buildAddonFeeConfig` if revisited.
- `settings.store.enabled` toggle from the memo is **not** implemented: the entitlement is the
  account-level gate and per-product status (ACTIVE/HIDDEN/ARCHIVED) is the organizer kill switch; a third
  competition-level toggle adds surface without need.
- Add-on refunds beyond the automatic oversold/group cases are organizer-via-Stripe-dashboard for v1
  (`charge.refunded` webhook already records them in the ledger).
- Merch does not transfer with registrations (`purchase_transfers` untouched — it targets a specific
  purchase row, and add-on rows are never linked to registrations).
- Production rollout requires inserting the `registration_addons` feature row (same one-time step used for
  prior features); after that, enablement is entirely via `/admin/entitlements`.

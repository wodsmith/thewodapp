# Commerce

WODsmith handles competition registration payments through Stripe Connect, with coupon support and purchase transfers.

## Stripe Connect

Organizers connect their Stripe accounts to receive registration fee payouts directly.

Server functions in `src/server-fns/stripe-connect-fns.ts` handle account linking. The platform collects a configurable fee percentage (`platformFeePercentage`, default 2.5%) and flat fee (`platformFeeFlatCents`, default $2.00) on each registration.

## Registration Checkout

Athletes pay registration fees via Stripe Checkout, handled by `src/workflows/stripe-checkout-workflow.ts`.

Competitions set a `defaultRegistrationFeeCents` (default $0 = free). Division-specific fees can override the default. The checkout flow creates a Stripe session, redirects the athlete, and a webhook confirms payment.

Stripe Checkout sessions do not enable Stripe-hosted promotion-code entry. WODsmith coupons are collected before checkout and allocated across registration purchase rows before the session is created; merch remains outside the discount base. The destination-charge application fee is the sum of the post-discount purchase allocations. Coupon redemption is recorded once when the whole session settles.

## Coupons

Discount codes that reduce registration fees, defined in `src/db/schemas/coupons.ts`.

Organizers create coupons per competition with percentage or fixed-amount discounts, usage limits, and expiration dates. Athletes can apply a coupon link or manually enter the code on registration before checkout.

### Registration coupon entry

Athletes enter WODsmith coupon codes before leaving for Stripe Checkout.

[[apps/wodsmith-start/src/components/registration/registration-sections.tsx#CouponCodeSection]] renders the manual entry field on public and invite registration forms. It calls [[apps/wodsmith-start/src/server-fns/coupon-fns.ts#validateCouponForCheckoutFn]] through the registration form hook, stores the same session coupon payload used by coupon links, and passes the validated code to [[apps/wodsmith-start/src/server-fns/registration-fns.ts#initiateRegistrationPaymentFn]]. This keeps link-based and manual coupon application on the same server-side discount path.

## Registration Add-ons

Organizers sell merch (e.g., event tees with sizes) inside the registration flow. Selections become extra line items in the same Stripe Checkout Session and extra `ADDON` purchase rows; pickup is at the venue.

The catalog lives in [[packages/wodsmith-db/src/schemas/competition-products.ts#competitionProductsTable]] and [[packages/wodsmith-db/src/schemas/competition-products.ts#competitionProductVariantsTable]]. Each add-on line item is its own `commerce_purchases` row (with `variantId` + `quantity` columns) referencing a lazily created `commerce_products` row (`type=ADDON`, `resourceId` = catalog product id). Organizer CRUD, the athlete-facing catalog, and fulfillment reports (counts-by-variant + pickup list) live in `src/server-fns/competition-addon-fns.ts`. The organizer Revenue page and series revenue rollups stay registration-only (add-on purchases are excluded by their null divisionId); merch revenue is reported on the Merch page.

### Entitlement Gate

Selling add-ons is gated behind the `registration_addons` team feature, granted per organizing team by platform admins at `/admin/entitlements` — full admin control over which accounts can sell merch.

Server functions are the authority: CRUD mutations throw without the feature ([[apps/wodsmith-start/src/server-fns/competition-addon-fns.ts#createCompetitionAddonFn]]), the public catalog ([[apps/wodsmith-start/src/server-fns/competition-addon-fns.ts#getPublicCompetitionAddonsFn]]) returns an empty list when the feature is missing or the organizer has no verified Stripe account, and [[apps/wodsmith-start/src/server-fns/registration-fns.ts#initiateRegistrationPaymentFn]] rejects `addOns` input for unentitled teams. The organizer Merch page renders a locked state instead of the editor.

### Pricing and Coupon Scope

Merch pays the percentage platform fee but not the $2 fixed fee, and follows the competition's fee pass-through configuration.

[[apps/wodsmith-start/src/utils/checkout-fees.ts#calculateCheckoutFees]] prices the complete session and allocates the single Stripe percentage-plus-fixed processing fee across its purchase rows without losing cents. Merch quantity is multiplied into its base price before this calculation, so Stripe's fixed fee is never repeated per shirt or per line. The registration form uses the same helper as the server. Coupons never discount merch: the discount base stays the registration subtotal only. A free division plus a paid add-on routes through Stripe, and the free registration remains pending until payment succeeds.

### Availability

Products support an optional order deadline, per-variant stock, and a per-athlete purchase limit.

The deadline-only setup is the recommended default. `maxPerAthlete` includes completed purchases and unexpired pending checkout reservations across every variant, not only the current request.

The deadline is a `YYYY-MM-DD` string evaluated end-of-day in the competition's IANA timezone (same semantics as `registrationClosesAt`), checked at checkout creation by [[apps/wodsmith-start/src/utils/addon-availability.ts#isAddonPurchasable]] with no webhook re-check — Stripe's 30-minute session expiry bounds the race. Stock (`stockQty`/`soldQty` on variants) gets a soft check at submit and an authoritative claim in the workflow.

### Checkout Session Settlement

One webhook event reconciles every registration and add-on purchase in the Stripe Checkout Session as a unit.

[[apps/wodsmith-start/src/workflows/stripe-checkout-workflow.ts#processCheckoutSession]] creates or resolves every registration first, including zero-dollar placeholder purchases. Merch completes only after at least one registration succeeds. If all registrations fail, every session line is refunded by its own recorded amount; partial registration failure refunds only that registration line.

[[apps/wodsmith-start/src/workflows/stripe-checkout-workflow.ts#completeAddonPurchase]] claims variant stock and flips the purchase PENDING→COMPLETED in one transaction. The conditional status update is the idempotency gate, so retries cannot claim stock twice. Oversold merch gets a line-level refund. [[apps/wodsmith-start/src/workflows/stripe-checkout-workflow.ts#refundCheckoutPurchase]] calls Stripe before marking an add-on failed, uses a stable per-purchase idempotency key, and rethrows Stripe errors for workflow retry. Destination-charge refunds reverse the organizer transfer.

### Session-level settlement tests

These focused tests protect ordering, transaction fee allocation, and retry-safe refunds across a multi-line checkout.

#### Registration completes before merch

The workflow settles a successful registration before it completes the attached add-on purchase.

#### Free registration waits for paid merch

A zero-dollar division included with paid merch is represented by a pending purchase and is not registered before Stripe confirms payment.

#### Retries preserve registration notifications

If a later merch or refund operation makes settlement retry after registration completed, the workflow reconstructs its registration result so invite and notification steps still run.

#### Failed registration refunds every session line

When no registration line succeeds, the workflow issues one exact partial refund for each registration and add-on purchase in the session.

#### Refund failures remain retryable

A Stripe refund error leaves an add-on pending and escapes the workflow step so its durable retry can attempt the same idempotent refund again.

#### Oversold merch refunds only its line

An add-on that loses the stock race is failed and refunded by its own amount without refunding an otherwise successful registration.

#### One transaction fee per checkout

The fee calculator applies Stripe's fixed processing component once to the complete Checkout Session and allocates it exactly across purchase rows.

## Purchase Transfers

Registered athletes can transfer their registration to another person.

Transfer functions in `src/server-fns/purchase-transfer-fns.ts` and `purchase-transfer-accept-fns.ts` handle creating, accepting, and cancelling transfers. Cancel accepts either `MANAGE_COMPETITIONS` on the organizing team or cohost `editRegistrations` on the competition team.

## Entitlements

Subscription-based feature gating for organizing teams (e.g., competition creation limits).

Admin-managed via `src/server-fns/admin-entitlement-fns.ts`. Teams have a `currentPlanId` linking to their subscription tier. The entitlements schema tracks feature access and usage.

## Financial Events

An audit log of all monetary transactions (registration payments, refunds, transfers).

Stored in `src/db/schemas/financial-events.ts` for accounting and reconciliation.

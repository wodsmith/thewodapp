# Commerce

WODsmith handles competition registration payments through Stripe Connect, with coupon support and purchase transfers.

## Stripe Connect

Organizers connect their Stripe accounts to receive registration fee payouts directly.

Server functions in `src/server-fns/stripe-connect-fns.ts` handle account linking. The platform collects a configurable fee percentage (`platformFeePercentage`, default 2.5%) and flat fee (`platformFeeFlatCents`, default $2.00) on each registration.

## Registration Checkout

Athletes pay registration fees via Stripe Checkout, handled by `src/workflows/stripe-checkout-workflow.ts`.

Competitions set a `defaultRegistrationFeeCents` (default $0 = free). Division-specific fees can override the default. The checkout flow creates a Stripe session, redirects the athlete, and a webhook confirms payment.

Stripe Checkout sessions do not enable Stripe-hosted promotion-code entry. WODsmith coupons are collected before checkout and, when applied, are attached to the session as a transient Stripe coupon discount.

## Coupons

Discount codes that reduce registration fees, defined in `src/db/schemas/coupons.ts`.

Organizers create coupons per competition with percentage or fixed-amount discounts, usage limits, and expiration dates. Athletes can apply a coupon link or manually enter the code on registration before checkout.

### Registration coupon entry

Athletes enter WODsmith coupon codes before leaving for Stripe Checkout.

[[apps/wodsmith-start/src/components/registration/registration-sections.tsx#CouponCodeSection]] renders the manual entry field on public and invite registration forms. It calls [[apps/wodsmith-start/src/server-fns/coupon-fns.ts#validateCouponForCheckoutFn]] through the registration form hook, stores the same session coupon payload used by coupon links, and passes the validated code to [[apps/wodsmith-start/src/server-fns/registration-fns.ts#initiateRegistrationPaymentFn]]. This keeps link-based and manual coupon application on the same server-side discount path.

## Registration Add-ons

Organizers sell merch (e.g., event tees with sizes) inside the registration flow. Selections become extra line items in the same Stripe Checkout Session and extra `ADDON` purchase rows; pickup is at the venue.

The catalog lives in [[apps/wodsmith-start/src/db/schemas/competition-products.ts#competitionProductsTable]] and [[apps/wodsmith-start/src/db/schemas/competition-products.ts#competitionProductVariantsTable]]. Each add-on line item is its own `commerce_purchases` row (with `variantId` + `quantity` columns) referencing a lazily created `commerce_products` row (`type=ADDON`, `resourceId` = catalog product id). Organizer CRUD, the athlete-facing catalog, and fulfillment reports (counts-by-variant + pickup list) live in `src/server-fns/competition-addon-fns.ts`.

### Entitlement Gate

Selling add-ons is gated behind the `registration_addons` team feature, granted per organizing team by platform admins at `/admin/entitlements` — full admin control over which accounts can sell merch.

Server functions are the authority: CRUD mutations throw without the feature ([[apps/wodsmith-start/src/server-fns/competition-addon-fns.ts#createCompetitionAddonFn]]), the public catalog ([[apps/wodsmith-start/src/server-fns/competition-addon-fns.ts#getPublicCompetitionAddonsFn]]) returns an empty list when the feature is missing or the organizer has no verified Stripe account, and [[apps/wodsmith-start/src/server-fns/registration-fns.ts#initiateRegistrationPaymentFn]] rejects `addOns` input for unentitled teams. The organizer Merch page renders a locked state instead of the editor.

### Pricing and Coupon Scope

Merch pays the percentage platform fee but not the $2 fixed fee, and follows the competition's fee pass-through configuration.

Pricing is per-unit all-in ([[apps/wodsmith-start/src/server/commerce/addons.ts#getAddonUnitBreakdown]]) multiplied by quantity ([[apps/wodsmith-start/src/server/commerce/addons.ts#multiplyFeeBreakdown]]), so the form summary, Stripe line item, and purchase row are cent-identical. Coupons never discount merch: the discount base stays the registration subtotal only. A free division plus a paid add-on routes through the Stripe path (the all-free shortcut requires zero add-ons).

### Availability

Two optional controls per product: an `availableUntil` order-by deadline and per-variant stock; deadline-only is the recommended default.

The deadline is a `YYYY-MM-DD` string evaluated end-of-day in the competition's IANA timezone (same semantics as `registrationClosesAt`), checked at checkout creation by [[apps/wodsmith-start/src/utils/addon-availability.ts#isAddonPurchasable]] with no webhook re-check — Stripe's 30-minute session expiry bounds the race. Stock (`stockQty`/`soldQty` on variants) gets a soft check at submit and an authoritative claim in the workflow.

### Checkout Workflow Branch

ADDON purchases complete without creating registrations: the checkout workflow branches on the purchase's product type before the registration idempotency checks.

[[apps/wodsmith-start/src/workflows/stripe-checkout-workflow.ts#completeAddonPurchase]] claims variant stock with an atomic conditional `UPDATE` (zero rows affected = oversold → mark FAILED + partial refund of just that line with `reverse_transfer`), refunds the add-on when every registration purchase in the same session already FAILED (capacity auto-refund grouping), and otherwise marks the purchase COMPLETED with a `PAYMENT_COMPLETED` financial event. Per-purchase workflows run in parallel, so a registration that fails *after* the add-on completes keeps the add-on sold — rare, logged, accepted for v1.

## Purchase Transfers

Registered athletes can transfer their registration to another person.

Transfer functions in `src/server-fns/purchase-transfer-fns.ts` and `purchase-transfer-accept-fns.ts` handle creating, accepting, and cancelling transfers. Cancel accepts either `MANAGE_COMPETITIONS` on the organizing team or cohost `editRegistrations` on the competition team.

## Entitlements

Subscription-based feature gating for organizing teams (e.g., competition creation limits).

Admin-managed via `src/server-fns/admin-entitlement-fns.ts`. Teams have a `currentPlanId` linking to their subscription tier. The entitlements schema tracks feature access and usage.

## Financial Events

An audit log of all monetary transactions (registration payments, refunds, transfers).

Stored in `src/db/schemas/financial-events.ts` for accounting and reconciliation.

# Commerce

WODsmith handles competition registration payments through Stripe Connect, with coupon support and purchase transfers.

## Stripe Connect

Organizers connect their Stripe accounts to receive registration fee payouts directly.

Server functions in `src/server-fns/stripe-connect-fns.ts` handle account linking. The platform collects a configurable fee percentage (`platformFeePercentage`, default 2.5%) and flat fee (`platformFeeFlatCents`, default $2.00) on each registration.

## Registration Checkout

Athletes pay registration fees via Stripe Checkout, handled by `src/workflows/stripe-checkout-workflow.ts`.

Competitions set a `defaultRegistrationFeeCents` (default $0 = free). Division-specific fees can override the default. The checkout flow creates a Stripe session, redirects the athlete, and a webhook confirms payment.

## Coupons

Discount codes that reduce registration fees, defined in `src/db/schemas/coupons.ts`.

Organizers create coupons per competition with percentage or fixed-amount discounts, usage limits, and expiration dates. Applied during checkout.

## Purchase Transfers

Registered athletes can transfer their registration to another person.

Transfer functions in `src/server-fns/purchase-transfer-fns.ts` and `purchase-transfer-accept-fns.ts` handle creating, accepting, and cancelling transfers. Cancel accepts either `MANAGE_COMPETITIONS` on the organizing team or cohost `editRegistrations` on the competition team.

## Entitlements

Subscription-based feature gating for organizing teams (e.g., competition creation limits).

Admin-managed via `src/server-fns/admin-entitlement-fns.ts`. Teams have a `currentPlanId` linking to their subscription tier. The entitlements schema tracks feature access and usage.

## Financial Events

An audit log of all monetary transactions (registration payments, refunds, transfers).

Stored in `src/db/schemas/financial-events.ts` for accounting and reconciliation.

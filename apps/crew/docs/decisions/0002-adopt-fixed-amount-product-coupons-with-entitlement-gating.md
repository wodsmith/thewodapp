---
status: "proposed"
date: 2026-03-02
decision-makers: "Zac Jones"
consulted: "Stripe best practices, course-builder PR #578 patterns"
informed: "WODsmith engineering team"
---

# Adopt fixed-amount product coupons with entitlement gating

## Context and Problem Statement

Organizers need to offer fixed-dollar discounts (e.g., "$20 off") for competition registrations via shareable links. Today, the checkout flow (`src/server-fns/registration-fns.ts`) creates Stripe Checkout Sessions with inline `price_data` and has no concept of coupons or discount codes.

The system should be **generic** — a `productCoupon` model with a `type` field — so it can support future product types beyond competitions. For this first iteration, the UI is competition-only.

Key constraints:
- Existing Stripe integration uses inline `price_data` (no pre-created Stripe products), so `applies_to` scoping is impossible — scoping must be app-side.
- The entitlement system (`src/server/entitlements.ts`, `src/config/features.ts`) already supports team-level feature flags with overrides, which we will use to gate coupon creation.
- PlanetScale/MySQL with Drizzle ORM. IDs use ULID with prefixes (`src/db/schemas/common.ts`).
- Cloudflare Workers runtime (async-only crypto, KV sessions).
- Visitors may arrive via coupon link **before** creating an account, so the code must persist through signup.

Reference: [course-builder PR #578](https://github.com/badass-courses/course-builder/pull/578) — two-table coupon model with lazy Stripe coupon creation at checkout.

## Decision Drivers

* Organizers want to distribute fixed-dollar discount links to attract registrations
* Must work for unauthenticated visitors (persist through account creation)
* Must integrate with existing Stripe Checkout Session flow without breaking Connect transfers
* Must be gated behind an entitlement so only authorized teams can create coupons
* Should track coupon usage for organizer visibility (light analytics)
* If coupon covers 100% of fee, skip Stripe entirely (free registration path)
* Must not over-engineer — percentage coupons, stacking, and non-competition products are future work

## Considered Options

* **Option A: App-managed product coupons with lazy Stripe coupon creation** — Store coupons in our DB, create transient one-time Stripe coupons at checkout, persist codes via cookie for unauthenticated visitors
* **Option B: Stripe-native Promotion Codes** — Pre-create Stripe coupons and promotion codes, use `allow_promotion_codes: true` on Checkout Session

## Decision Outcome

Chosen option: **Option A — App-managed product coupons with lazy Stripe coupon creation**, because:

1. We use inline `price_data` (no pre-created Stripe Products), so `applies_to` scoping is impossible — we must enforce scoping app-side.
2. Full control over coupon lifecycle, limits, expiration, and analytics without Stripe dashboard dependency.
3. Proven pattern from course-builder PR #578 — lazy Stripe coupon creation with deterministic IDs for idempotency.
4. Naturally supports the "coupon >= fee → skip Stripe" free path.
5. Allows persisting coupon codes for unauthenticated visitors via cookie (Stripe Promotion Codes require the customer to type the code on Stripe's page).

### Consequences

* Good, because organizers get full control over coupon creation, limits, and expiration within the app
* Good, because coupon usage is tracked in our DB — enables the analytics dashboard without Stripe API calls
* Good, because the generic `productCoupon` model supports future product types without schema changes
* Bad, because transient Stripe coupons accumulate — must clean up in webhook handler after redemption
* Bad, because we own the coupon validation logic (expiration, limits, scoping) rather than delegating to Stripe
* Neutral, because the cookie-based persistence for unauthenticated visitors adds a new state management pattern

## Implementation Plan

### Phase 1: Database Schema

**New file: `src/db/schemas/coupons.ts`**

Two tables following the course-builder pattern, adapted for WODsmith conventions:

**`product_coupons` table** (organizer-facing coupon definitions):

| Column | Type | Description |
|--------|------|-------------|
| `id` | `varchar(255)` PK | `pcoup_${ulid()}` |
| `code` | `varchar(100)` UNIQUE | Shareable code (auto-generated or organizer-chosen) |
| `type` | `varchar(50)` | `'competition'` (extensible for future types) |
| `productId` | `varchar(255)` | The resource this applies to (e.g., competitionId) |
| `teamId` | `varchar(255)` | Owning team (multi-tenancy) |
| `createdBy` | `varchar(255)` | userId of creator |
| `amountOffCents` | `int` | Fixed dollar discount in cents |
| `maxRedemptions` | `int` NULL | Max uses (NULL = unlimited) |
| `currentRedemptions` | `int` default 0 | Current usage count |
| `expiresAt` | `datetime` NULL | Optional expiration |
| `isActive` | `tinyint` default 1 | Soft deactivation toggle |
| `createdAt` | `datetime` | Standard |
| `updatedAt` | `datetime` | Standard |

Indexes: `code` (unique), `(teamId, productId)`, `(productId, isActive)`.

**`product_coupon_redemptions` table** (usage tracking):

| Column | Type | Description |
|--------|------|-------------|
| `id` | `varchar(255)` PK | `pcred_${ulid()}` |
| `couponId` | `varchar(255)` | FK → `product_coupons.id` |
| `userId` | `varchar(255)` | Who redeemed |
| `purchaseId` | `varchar(255)` NULL | FK → `commerce_purchases.id` (NULL if free) |
| `competitionId` | `varchar(255)` NULL | Denormalized for queries |
| `amountOffCents` | `int` | Actual discount applied (snapshot) |
| `stripeCouponId` | `varchar(255)` NULL | Transient Stripe coupon ID (for cleanup) |
| `redeemedAt` | `datetime` | When applied |
| `createdAt` | `datetime` | Standard |
| `updatedAt` | `datetime` | Standard |

Indexes: `couponId`, `userId`, `purchaseId`.

**Update `src/db/schemas/common.ts`** — add:
```typescript
export const createProductCouponId = () => `pcoup_${ulid()}`
export const createProductCouponRedemptionId = () => `pcred_${ulid()}`
```

**Update `src/db/schema.ts`** — export new tables and relations.

### Phase 2: Entitlement Gating

**Update `src/config/features.ts`**:
```typescript
PRODUCT_COUPONS: "product_coupons",
```

This feature flag gates the "Create Coupon" UI for organizers. Check via existing `hasFeature(teamId, FEATURES.PRODUCT_COUPONS)`.

Admin can grant this to teams via existing entitlement override system (`teamEntitlementOverrideTable`).

### Phase 3: Coupon CRUD Server Functions

**New file: `src/server-fns/coupon-fns.ts`**

| Function | Auth | Description |
|----------|------|-------------|
| `createCouponFn` | Team admin + `PRODUCT_COUPONS` entitlement | Create a coupon for a product. Generates a random 8-char alphanumeric code if none provided. Validates: competition exists, competition belongs to team, amount > 0. |
| `listCouponsFn` | Team admin | List coupons for a competition with redemption counts. Powers the analytics table. |
| `getCouponByCodeFn` | Public (no auth) | Look up a coupon by code. Returns coupon details + competition info. Used by the coupon link landing and the checkout flow. Validates: active, not expired, under max redemptions. |
| `deactivateCouponFn` | Team admin | Soft-deactivate a coupon (set `isActive = 0`). |
| `validateCouponForCheckoutFn` | Authenticated user | Given a coupon code + competitionId, validate the coupon applies and return the discount amount. Called during registration payment flow. |

**New file: `src/server/coupons.ts`** — Business logic (createServerOnlyFn pattern):
- `validateCoupon(code, competitionId)` — checks active, not expired, under limit, matches product
- `recordRedemption(couponId, userId, purchaseId, amountOffCents, stripeCouponId?)` — inserts redemption record, increments `currentRedemptions`
- `cleanupStripeCoupon(stripeCouponId)` — deletes transient Stripe coupon after successful checkout

### Phase 4: Coupon Link & Cookie Persistence

**Coupon link format**: `https://wodsmith.com/compete/{slug}?coupon={CODE}`

**New file: `src/utils/coupon-cookie.ts`** — Cookie helpers:
```typescript
const COUPON_COOKIE_NAME = 'wod_coupon'
// Cookie value: JSON { code, competitionSlug, amountOffCents, competitionName }
setCouponCookie(data) // Set httpOnly=false cookie (client needs to read for banner), 7-day expiry
getCouponCookie() // Parse cookie
clearCouponCookie() // Remove after redemption
```

**Route handling** — In the competition route loader (`src/routes/compete/$slug/`), if `?coupon=` param present:
1. Call `getCouponByCodeFn` to validate the code
2. If valid: set cookie via `setCouponCookie`, redirect to clean URL (strip `?coupon=` param)
3. If invalid: ignore param, continue to page

The cookie persists through signup/login because it's set on the app domain.

### Phase 5: Coupon Banner UI

**New component: `src/components/coupon-banner.tsx`**

A persistent, dismissible banner (fixed bottom or top) that reads the coupon cookie and displays:
- Competition name (linked to competition page)
- Discount amount (e.g., "$20 off")
- "Applied automatically at checkout" message
- Dismiss button (clears cookie)

Rendered in the app layout when coupon cookie is present. Uses client-side cookie reading (not httpOnly).

### Phase 6: Checkout Integration

**Modify `src/server-fns/registration-fns.ts` → `initiateRegistrationPaymentFn`**:

After calculating `totalChargeCents` per division and before creating the Stripe Checkout Session:

1. Check for coupon: `validateCouponForCheckoutFn(code, competitionId)`
2. Calculate discounted total: `Math.max(0, totalChargeCents - coupon.amountOffCents)`
3. **Recalculate fees on discounted total** — call `calculateCompetitionFees` / `buildFeeConfig` with the discounted amount so platform fee and organizer net are proportional to what the customer actually pays
4. **If discounted total is 0** → Use existing free registration path (skip Stripe, create registrations immediately, record redemption with `purchaseId: null`)
4. **If discounted total > 0** → Create transient Stripe coupon:
   ```typescript
   const stripeCouponId = `wod-${couponId}-${purchaseIds[0]}`
   const stripeCoupon = await getStripe().coupons.create({
     id: stripeCouponId,
     amount_off: coupon.amountOffCents,
     currency: 'usd',
     duration: 'once',
     max_redemptions: 1,
     metadata: { couponId, purchaseId: purchaseIds[0] },
   })
   ```
5. Add `discounts: [{ coupon: stripeCouponId }]` to `sessionParams`
6. Store `couponId` and `stripeCouponId` in checkout session `metadata`
7. Update `commercePurchaseTable` metadata to include `couponCode` and `discountCents`

**Modify `src/workflows/stripe-checkout-workflow.ts`**:

After successful registration creation:
1. Read `couponId` and `stripeCouponId` from session metadata
2. Call `recordRedemption(couponId, userId, purchaseId, amountOffCents, stripeCouponId)`
3. Call `cleanupStripeCoupon(stripeCouponId)` to delete the transient Stripe coupon
4. Clear the coupon cookie (via response header in the success redirect)

### Phase 7: Organizer Coupon Dashboard

**New route: `src/routes/compete/$slug/manage/coupons.tsx`**

Gated behind `PRODUCT_COUPONS` entitlement check.

UI:
- **Create Coupon form**: amount (dollars, converted to cents), optional code override, optional max redemptions, optional expiration date
- **Coupons table**: code, amount off, usage (`currentRedemptions / maxRedemptions` or `currentRedemptions / ∞`), status (active/expired/maxed), created date, actions (copy link, deactivate)
- **Copy link button**: Copies `https://wodsmith.com/compete/{slug}?coupon={CODE}` to clipboard

### Patterns to Follow

* **ID generation**: `createProductCouponId` / `createProductCouponRedemptionId` in `src/db/schemas/common.ts` — prefix + ULID pattern
* **Server functions**: `createServerFn` in `src/server-fns/` with Zod input validation
* **Business logic**: `createServerOnlyFn` in `src/server/` for reusable logic
* **Entitlement checks**: `hasFeature(teamId, FEATURES.PRODUCT_COUPONS)` pattern from `src/server/entitlements.ts`
* **Stripe client**: `getStripe()` from `src/lib/stripe.ts`
* **Stripe coupon cleanup**: Delete transient coupons in webhook handler after successful checkout
* **Deterministic Stripe coupon IDs**: `wod-${couponId}-${purchaseId}` for idempotency on retries

### Patterns to Avoid

* **Do NOT use Stripe Promotion Codes** — We control the discount flow server-side; no need for customer-typed codes on Stripe's checkout page
* **Do NOT use `applies_to` on Stripe coupons** — We use inline `price_data`, not pre-created Products
* **Do NOT store coupon state in Stripe** — Our DB is the source of truth; Stripe coupons are transient
* **Do NOT allow `allow_promotion_codes: true`** on Checkout Sessions — conflicts with `discounts` param
* **Do NOT use percentage discounts** in this iteration — schema supports it later but UI/logic is fixed-amount only
* **Do NOT stack coupons** — One coupon per checkout maximum

### Dependencies

* No new packages required
* Stripe SDK already available via `src/lib/stripe.ts`
* Drizzle ORM, Zod, TanStack Router all already in use

### Configuration

* New feature flag: `PRODUCT_COUPONS` in `src/config/features.ts`
* No new env vars needed
* Cookie: `wod_coupon` (app domain, 7-day expiry, not httpOnly)

### Migration Steps

1. Add schema tables via `pnpm db:push` (local dev)
2. Seed `PRODUCT_COUPONS` feature in the features table
3. Grant entitlement override to test teams
4. Generate migration before merging: `pnpm db:generate --name=product-coupons`

### Verification

- [ ] `PRODUCT_COUPONS` feature flag exists in `src/config/features.ts` and is seeded in DB
- [ ] Team without entitlement cannot see or access coupon creation UI
- [ ] Team with entitlement can create a coupon with amount, optional code, optional max redemptions, optional expiration
- [ ] Generated coupon link (`/compete/{slug}?coupon={CODE}`) sets cookie and redirects to clean URL
- [ ] Cookie persists through account creation and login flow
- [ ] Coupon banner displays competition name, discount amount, and link to competition
- [ ] Dismissing banner clears the cookie
- [ ] At checkout, coupon is validated (active, not expired, under limit, matches competition)
- [ ] If coupon >= fee: registration created via free path, no Stripe session
- [ ] If coupon < fee: Stripe Checkout Session created with `discounts` containing transient coupon
- [ ] Transient Stripe coupon uses deterministic ID (`wod-{couponId}-{purchaseId}`)
- [ ] After successful checkout, redemption is recorded and `currentRedemptions` incremented
- [ ] After successful checkout, transient Stripe coupon is deleted
- [ ] Organizer dashboard shows coupon table with usage counts (`0/X` or `0/∞`)
- [ ] Expired and maxed-out coupons show appropriate status
- [ ] Copy link button works on coupon dashboard
- [ ] `pnpm type-check` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes

## Pros and Cons of the Options

### Option A: App-managed product coupons with lazy Stripe coupon creation

Two-table model in our DB. Coupons stored locally, transient Stripe coupons created at checkout time with deterministic IDs. Cookie-based persistence for unauthenticated visitors.

* Good, because full control over coupon lifecycle, limits, expiration, and scoping
* Good, because analytics dashboard reads from our DB — no Stripe API calls needed
* Good, because cookie persistence works for unauthenticated visitors (Stripe Promotion Codes require Stripe checkout page)
* Good, because deterministic Stripe coupon IDs provide idempotency on retries
* Good, because "coupon >= fee → free path" is straightforward to implement
* Good, because proven pattern (course-builder PR #578)
* Bad, because transient Stripe coupons must be cleaned up (webhook handler + potential cron fallback)
* Bad, because we own validation logic (expiration, limits, scoping) that Stripe could handle natively

### Option B: Stripe-native Promotion Codes

Pre-create Stripe Coupons, then create Promotion Codes from them. Use `allow_promotion_codes: true` on Checkout Sessions.

* Good, because Stripe handles validation, limits, and expiration natively
* Good, because no cleanup needed — Stripe manages coupon lifecycle
* Bad, because `applies_to` requires pre-created Stripe Products — we use inline `price_data`
* Bad, because `allow_promotion_codes: true` conflicts with `discounts` param — can't combine with other discount logic
* Bad, because customer must type the code on Stripe's checkout page — no pre-applied discounts
* Bad, because no cookie persistence for unauthenticated visitors
* Bad, because analytics requires Stripe API calls rather than local DB queries
* Bad, because "coupon >= fee → skip Stripe" requires separate logic outside Stripe's flow

## More Information

**Prior art**: [course-builder PR #578](https://github.com/badass-courses/course-builder/pull/578) — `coupon` + `merchantCoupon` two-table model. Key difference: course-builder supports both percentage and fixed; WODsmith is fixed-only for v1.

**Stripe API notes**:
- `stripe.coupons.create({ id, amount_off, currency, duration: 'once', max_redemptions: 1 })` — deterministic `id` acts as idempotency key
- `stripe.checkout.sessions.create({ discounts: [{ coupon: id }] })` — applies discount to entire session
- `stripe.coupons.del(id)` — cleanup after redemption
- Cannot combine `discounts` with `allow_promotion_codes: true`

**Stripe Connect fee recalculation**: When a coupon is applied, fees are recalculated on the **discounted total**, not the original price. The organizer's fee percentage stays the same, but absolute amounts decrease proportionally. This is standard platform behavior — the platform should not charge fees on money that was never collected. The existing `calculateCompetitionFees` / `buildFeeConfig` helpers in `src/server/commerce/fee-calculator.ts` should be called with the discounted `totalChargeCents` rather than the original amount.

**Revisit this ADR when**:
- Percentage-based coupons are needed (extend `product_coupons` with `percentOff` column, update validation)
- Coupon stacking is requested (currently one coupon per checkout)
- Non-competition product types need coupons (schema supports it; build product-specific UI)

---
status: proposed
date: 2026-03-05
decision-makers: [Zac Jones]
consulted: []
informed: []
---

# ADR-0003: Introduce Double-Entry Ledger for Payout Accounting

## Context and Problem Statement

Our financial system currently uses a **single-entry bookkeeping** approach. The `commerce_purchases` table stores denormalized fee breakdowns (`totalCents`, `platformFeeCents`, `stripeFeeCents`, `organizerNetCents`) computed at checkout time. This has worked for initial launch, but creates five concrete risks as transaction volume grows:

1. **No refund tracking** — Refunds are issued via the Stripe API (`stripe-checkout-workflow.ts`) but not recorded locally. We can't answer "which purchases were refunded?" without querying Stripe for every transaction.
2. **No audit trail** — Purchase status transitions (PENDING → COMPLETED → FAILED) are destructive updates. There's no record of when changes happened or what triggered them.
3. **No balance invariant enforcement** — Nothing ensures `totalCents = platformFeeCents + stripeFeeCents + organizerNetCents`. A fee calculation bug could silently create or lose money.
4. **No reconciliation path** — We can't compare local records against Stripe settlement reports. Disputes, chargebacks, and partial refunds in Stripe are invisible to our system.
5. **No chargeback awareness** — When Stripe debits us for a dispute, our system doesn't know. The organizer's revenue stats still show the original amount.

How should we upgrade our financial tracking to handle refunds, disputes, and reconciliation properly?

## Decision Drivers

* Must not break existing checkout or registration flows
* Must provide a clear audit trail for every financial event
* Must track refunds and disputes locally (not just in Stripe)
* Must enable reconciliation between our records and Stripe
* Must enforce that money never appears or disappears (balance invariants)
* Should be implementable incrementally — we don't need to rewrite everything at once
* Must work within D1 constraints (no transactions, 100 SQL parameter limit)

## Considered Options

* **Option A: Full double-entry ledger with journal entries and named accounts**
* **Option B: Refund tracking table + financial event log (lightweight audit trail)**
* **Option C: Status quo with manual Stripe reconciliation**

## Decision Outcome

Chosen option: **"Option B: Refund tracking table + financial event log"**, because it addresses the highest-risk gaps (refund tracking, audit trail, chargeback awareness) without the complexity of a full accounting system. It's incrementally upgradable to Option A if we later need formal ledger accounts for financial reporting.

Option A is the gold standard for payout systems (used by Stripe, Airbnb, Uber internally), but the implementation cost is high and our current transaction volume doesn't justify it. Option B gives us 80% of the value at 20% of the cost, and the event log table is the natural foundation for a future ledger.

### Consequences

* Good, because refunds and disputes become queryable locally
* Good, because every financial state change is recorded with timestamp, actor, and reason
* Good, because balance assertions catch fee calculation bugs at write time
* Good, because Stripe webhook handlers for disputes/chargebacks now update local state
* Good, because incrementally upgradable to full double-entry if needed
* Bad, because adds write overhead (one extra INSERT per financial event)
* Good, because backfill from Stripe ensures Jan 2026+ purchases have full event history from day one
* Neutral, because revenue stats queries remain unchanged — they still read from `commerce_purchases`

### Non-Goals

* Full double-entry ledger with named accounts (ASSETS, LIABILITIES, REVENUE) — deferred to Option A if needed
* Automated Stripe reconciliation reports — manual comparison for V1
* Modifying fee calculation logic — that stays as-is
* Retroactively generating event logs for purchases **before** January 2026

## Implementation Plan

### Phase 1: Financial Event Log Table

**New schema: `src/db/schemas/financial-events.ts`**

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { createId } from "@/utils/ids"

export const FINANCIAL_EVENT_TYPE = {
  PAYMENT_COMPLETED: "PAYMENT_COMPLETED",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  REFUND_INITIATED: "REFUND_INITIATED",
  REFUND_COMPLETED: "REFUND_COMPLETED",
  REFUND_FAILED: "REFUND_FAILED",
  DISPUTE_OPENED: "DISPUTE_OPENED",
  DISPUTE_WON: "DISPUTE_WON",
  DISPUTE_LOST: "DISPUTE_LOST",
  PAYOUT_INITIATED: "PAYOUT_INITIATED",
  PAYOUT_COMPLETED: "PAYOUT_COMPLETED",
  PAYOUT_FAILED: "PAYOUT_FAILED",
  MANUAL_ADJUSTMENT: "MANUAL_ADJUSTMENT",
} as const

export const financialEventTable = sqliteTable("financial_events", {
  id: text("id").primaryKey().$defaultFn(createId),
  purchaseId: text("purchase_id").notNull(),        // FK to commerce_purchases
  teamId: text("team_id").notNull(),                // organizer's team
  eventType: text("event_type").notNull(),           // from FINANCIAL_EVENT_TYPE
  amountCents: integer("amount_cents").notNull(),    // positive = money in, negative = money out
  currency: text("currency").notNull().default("usd"),
  // Stripe references
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeRefundId: text("stripe_refund_id"),
  stripeDisputeId: text("stripe_dispute_id"),
  // Context
  reason: text("reason"),                            // human-readable reason
  metadata: text("metadata", { mode: "json" }),      // arbitrary context (fee breakdown, etc.)
  actorId: text("actor_id"),                         // user who triggered (null for webhooks)
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  stripeEventTimestamp: integer("stripe_event_timestamp", { mode: "timestamp" }),
})
```

This table is **append-only**. Rows are never updated or deleted. Every financial event produces exactly one row.

**Example entries for a $100 registration that gets refunded:**

| eventType | amountCents | reason |
|-----------|-------------|--------|
| PAYMENT_COMPLETED | 10000 | Checkout completed for Division RX |
| REFUND_COMPLETED | -10000 | Division full during payment |

**Example entries for a dispute:**

| eventType | amountCents | reason |
|-----------|-------------|--------|
| PAYMENT_COMPLETED | 10000 | Checkout completed |
| DISPUTE_OPENED | -10000 | Stripe dispute dp_xxx opened |
| DISPUTE_LOST | 0 | Dispute resolved in customer's favor |

### Phase 2: Refund Tracking

**Enhance `stripe-checkout-workflow.ts`** — after `stripe.refunds.create()` succeeds, INSERT a `REFUND_COMPLETED` event:

```typescript
await stripe.refunds.create({
  payment_intent: session.payment_intent,
  reason: "requested_by_customer",
})

// NEW: Record refund locally
const db = getDb()
await db.insert(financialEventTable).values({
  purchaseId,
  teamId: purchase.teamId,
  eventType: FINANCIAL_EVENT_TYPE.REFUND_COMPLETED,
  amountCents: -purchase.totalCents,
  stripePaymentIntentId: session.payment_intent,
  reason: "Division filled during payment - automatic refund",
})
```

**Also record successful payments** — after marking a purchase COMPLETED, INSERT a `PAYMENT_COMPLETED` event with the fee breakdown in metadata:

```typescript
await db.insert(financialEventTable).values({
  purchaseId,
  teamId: purchase.teamId,
  eventType: FINANCIAL_EVENT_TYPE.PAYMENT_COMPLETED,
  amountCents: purchase.totalCents,
  stripePaymentIntentId: session.payment_intent,
  metadata: {
    platformFeeCents: purchase.platformFeeCents,
    stripeFeeCents: purchase.stripeFeeCents,
    organizerNetCents: purchase.organizerNetCents,
  },
})
```

### Phase 3: Dispute/Chargeback Webhook Handlers

**New webhook handlers in `src/routes/api/webhooks/stripe.ts`:**

Handle these Stripe events:
- `charge.dispute.created` → INSERT `DISPUTE_OPENED` event, update purchase status
- `charge.dispute.closed` → INSERT `DISPUTE_WON` or `DISPUTE_LOST` based on outcome
- `charge.refunded` → INSERT `REFUND_COMPLETED` if not already recorded (handles refunds initiated from Stripe dashboard)

This is the critical gap — today a chargeback silently reduces Stripe balance but our revenue stats still show the revenue.

### Phase 4: Balance Assertion

**Add a DB-level CHECK constraint** on `commerce_purchases`:

```sql
CHECK (total_cents = platform_fee_cents + stripe_fee_cents + organizer_net_cents)
```

This catches fee calculation bugs at INSERT time rather than letting them propagate silently. Apply via a Drizzle schema change.

**Note**: This is a data integrity safeguard, not a replacement for correct fee calculation. The fee calculator already computes these correctly — this just makes the invariant explicit and enforced.

### Phase 5: Backfill Historical Data from Stripe (Jan 2026+)

After the event log table exists (Phase 1) and the recording logic is live (Phases 2-3), backfill all historical transactions from January 1, 2026 onward. This ensures the ledger is complete from the start of meaningful transaction volume — no gap between "old" and "new" data.

**New script: `scripts/backfill-financial-events.ts`**

A one-time CLI script (not a server function) that:

1. **Fetches all COMPLETED purchases from D1** with `completedAt >= 2026-01-01`:

```typescript
const cutoff = new Date("2026-01-01T00:00:00Z")
const purchases = await db.select()
  .from(commercePurchaseTable)
  .where(
    and(
      eq(commercePurchaseTable.status, "COMPLETED"),
      gte(commercePurchaseTable.completedAt, cutoff),
    )
  )
```

2. **For each purchase with a `stripePaymentIntentId`**, fetch the PaymentIntent from Stripe to get authoritative amounts and check for refunds/disputes:

```typescript
const stripe = new Stripe(env.STRIPE_SECRET_KEY)

for (const purchase of purchases) {
  if (!purchase.stripePaymentIntentId) continue

  // Skip if events already exist for this purchase (idempotency)
  const existing = await db.select({ id: financialEventTable.id })
    .from(financialEventTable)
    .where(eq(financialEventTable.purchaseId, purchase.id))
    .limit(1)
  if (existing.length > 0) continue

  const pi = await stripe.paymentIntents.retrieve(
    purchase.stripePaymentIntentId,
    { expand: ["charges.data.refunds", "charges.data.dispute"] }
  )

  // ... generate events (see below)
}
```

3. **Generate `PAYMENT_COMPLETED` event** for every successful purchase, using the local fee breakdown as metadata:

```typescript
events.push({
  purchaseId: purchase.id,
  teamId: purchase.teamId,
  eventType: FINANCIAL_EVENT_TYPE.PAYMENT_COMPLETED,
  amountCents: purchase.totalCents,
  stripePaymentIntentId: purchase.stripePaymentIntentId,
  reason: "Backfill: checkout completed",
  metadata: {
    platformFeeCents: purchase.platformFeeCents,
    stripeFeeCents: purchase.stripeFeeCents,
    organizerNetCents: purchase.organizerNetCents,
    backfilled: true,
  },
  createdAt: purchase.completedAt,        // preserve original timestamp
  stripeEventTimestamp: purchase.completedAt,
})
```

4. **Check for refunds on the PaymentIntent** and generate `REFUND_COMPLETED` events:

```typescript
for (const charge of pi.charges.data) {
  if (charge.refunds?.data) {
    for (const refund of charge.refunds.data) {
      if (refund.status === "succeeded") {
        events.push({
          purchaseId: purchase.id,
          teamId: purchase.teamId,
          eventType: FINANCIAL_EVENT_TYPE.REFUND_COMPLETED,
          amountCents: -refund.amount,           // negative = money out
          stripePaymentIntentId: purchase.stripePaymentIntentId,
          stripeRefundId: refund.id,
          reason: `Backfill: ${refund.reason || "refund via Stripe"}`,
          metadata: { backfilled: true },
          createdAt: new Date(refund.created * 1000),
          stripeEventTimestamp: new Date(refund.created * 1000),
        })
      }
    }
  }
}
```

5. **Check for disputes** and generate `DISPUTE_OPENED` / `DISPUTE_WON` / `DISPUTE_LOST` events:

```typescript
for (const charge of pi.charges.data) {
  if (charge.dispute) {
    const dispute = charge.dispute as Stripe.Dispute

    events.push({
      purchaseId: purchase.id,
      teamId: purchase.teamId,
      eventType: FINANCIAL_EVENT_TYPE.DISPUTE_OPENED,
      amountCents: -dispute.amount,
      stripePaymentIntentId: purchase.stripePaymentIntentId,
      stripeDisputeId: dispute.id,
      reason: `Backfill: dispute ${dispute.reason}`,
      metadata: { backfilled: true },
      createdAt: new Date(dispute.created * 1000),
      stripeEventTimestamp: new Date(dispute.created * 1000),
    })

    if (dispute.status === "won") {
      events.push({
        purchaseId: purchase.id,
        teamId: purchase.teamId,
        eventType: FINANCIAL_EVENT_TYPE.DISPUTE_WON,
        amountCents: dispute.amount,  // money returned
        stripeDisputeId: dispute.id,
        reason: "Backfill: dispute resolved in our favor",
        metadata: { backfilled: true },
      })
    } else if (dispute.status === "lost") {
      events.push({
        purchaseId: purchase.id,
        teamId: purchase.teamId,
        eventType: FINANCIAL_EVENT_TYPE.DISPUTE_LOST,
        amountCents: 0,
        stripeDisputeId: dispute.id,
        reason: "Backfill: dispute resolved in customer's favor",
        metadata: { backfilled: true },
      })
    }
  }
}
```

6. **Batch insert events** using `autochunk` to respect the D1 100-parameter limit:

```typescript
import { autochunk } from "@/utils/batch-query"

await autochunk(
  { items: events, otherParametersCount: 0 },
  async (chunk) => db.insert(financialEventTable).values(chunk),
)
```

**Operational considerations:**

- **Stripe rate limits**: The script should respect Stripe's 100 requests/second limit. Add a 50ms delay between PaymentIntent fetches, or use `p-limit` to cap concurrency at 20.
- **Idempotency**: The script checks for existing events before inserting, so it's safe to re-run if interrupted.
- **Dry-run mode**: Add a `--dry-run` flag that logs what would be inserted without writing to D1. Run this first to verify counts.
- **Progress logging**: Log every 50 purchases processed so operators can monitor progress and estimate completion.
- **Metadata tagging**: Every backfilled event includes `backfilled: true` in metadata so they're distinguishable from live events in queries.
- **Run order**: Run this script **after** Phases 1-4 are deployed and **before** enabling any reconciliation queries (Phase 6). The event log must be complete before reconciliation makes sense.

**Also update `commerce_purchases.status`**: If a Stripe PaymentIntent shows as refunded but the local purchase is still COMPLETED, the script should flag it for manual review (log a warning, don't auto-update status). This prevents silent state changes on purchases that may have downstream effects (e.g., registration status).

### Phase 6: Reconciliation Query (Future)

Once the event log is populated, build a reconciliation function:

```typescript
async function reconcilePurchase(purchaseId: string) {
  const events = await db.select()
    .from(financialEventTable)
    .where(eq(financialEventTable.purchaseId, purchaseId))
    .orderBy(financialEventTable.createdAt)

  const netAmount = events.reduce((sum, e) => sum + e.amountCents, 0)
  const purchase = await db.query.commercePurchaseTable.findFirst({
    where: eq(commercePurchaseTable.id, purchaseId),
  })

  return {
    eventsTotal: netAmount,
    purchaseTotal: purchase.totalCents,
    balanced: netAmount === purchase.totalCents || netAmount === 0, // 0 if fully refunded
    events,
  }
}
```

This lets us answer "does our local state match reality?" for any purchase.

### Affected Files

| File | Change |
|------|--------|
| `src/db/schemas/financial-events.ts` | **New** — event log schema |
| `src/db/schema.ts` | Export new schema |
| `src/db/schemas/commerce.ts` | Add CHECK constraint to `commerce_purchases` |
| `src/workflows/stripe-checkout-workflow.ts` | Record PAYMENT_COMPLETED and REFUND_COMPLETED events |
| `src/routes/api/webhooks/stripe.ts` | Add dispute webhook handlers |
| `src/server/commerce/financial-events.ts` | **New** — helper functions for inserting events |
| `src/server-fns/commerce-fns.ts` | Add refund history query for organizer dashboard |
| `scripts/backfill-financial-events.ts` | **New** — one-time Stripe backfill script for Jan 2026+ data |

### Dependencies

No new packages. Uses existing Drizzle ORM and Stripe SDK.

### D1 Constraints

- No transactions needed — each event is a single INSERT
- Event log queries use `purchaseId` index, well within parameter limits
- Append-only pattern is ideal for D1's write characteristics

### Verification

- [ ] `PAYMENT_COMPLETED` event is recorded for every successful checkout
- [ ] `REFUND_COMPLETED` event is recorded when a division-full refund is issued
- [ ] Stripe dispute webhooks create `DISPUTE_OPENED` / `DISPUTE_WON` / `DISPUTE_LOST` events
- [ ] CHECK constraint prevents inserting purchases where fees don't sum to total
- [ ] Existing checkout flow is unaffected (event log is additive)
- [ ] Revenue stats still work (they read from `commerce_purchases`, not the event log)
- [ ] Backfill script in dry-run mode reports correct counts matching COMPLETED purchases from Jan 2026+
- [ ] Backfill script generates `PAYMENT_COMPLETED` events for all historical purchases with `stripePaymentIntentId`
- [ ] Backfill script discovers and records refunds from Stripe that are not tracked locally
- [ ] Backfill script discovers and records disputes/chargebacks from Stripe
- [ ] Backfill script is idempotent — re-running produces no duplicate events
- [ ] All backfilled events have `backfilled: true` in metadata
- [ ] Purchases with Stripe refund status but local COMPLETED status are flagged for review (not auto-updated)
- [ ] `pnpm type-check` passes
- [ ] `pnpm test` passes

## Pros and Cons of the Options

### Option A: Full double-entry ledger

Every financial event produces balanced debit/credit journal entries across named accounts (e.g., `stripe_holdings`, `platform_revenue`, `organizer_payable`).

* Good, because provides complete accounting-grade audit trail
* Good, because enables formal financial reporting (balance sheets, P&L)
* Good, because money flow is provably balanced at all times
* Bad, because significant implementation complexity (account management, entry balancing, reporting queries)
* Bad, because overkill for current transaction volume and reporting needs
* Bad, because requires rethinking revenue stats queries to read from ledger instead of purchase table

### Option B: Refund tracking + financial event log (chosen)

Append-only event log for all financial state changes, plus explicit refund/dispute tracking.

* Good, because addresses the highest-risk gaps immediately
* Good, because simple append-only writes, no complex balancing logic
* Good, because the event log is the natural foundation for upgrading to Option A later
* Good, because existing queries and flows stay unchanged
* Bad, because doesn't provide formal double-entry guarantees (money could theoretically appear/disappear between events)
* Neutral, because the CHECK constraint partially compensates for lack of formal balancing

### Option C: Status quo with manual reconciliation

Keep current system, periodically export Stripe reports and compare manually.

* Good, because zero implementation effort
* Bad, because refunds remain invisible locally
* Bad, because disputes/chargebacks are completely untracked
* Bad, because manual reconciliation doesn't scale and is error-prone
* Bad, because no audit trail for financial investigations

## Upgrade Path to Full Double-Entry

If transaction volume or regulatory requirements grow, Option B can be upgraded to Option A:

1. Add `accounts` table (named buckets: `stripe_holdings`, `platform_revenue`, `organizer_payable_{teamId}`)
2. Add `journal_entries` table with balanced debit/credit rows referencing accounts
3. Migrate `financialEventTable` data into journal entries (the event types map directly to entry patterns)
4. Switch revenue stats to query from ledger balances instead of purchase aggregations

The event log from Option B provides the raw data needed for this migration.

## More Information

* Industry references: [Accounting for Developers (Modern Treasury)](https://www.moderntreasury.com/journal/accounting-for-developers-part-i), [Accounting Patterns (Martin Fowler)](https://martinfowler.com/eaaDev/AccountingNarrative.html)
* Related: ADR-0002 (series revenue view) — the event log doesn't change revenue stats queries, so series revenue is unaffected
* Stripe dispute webhooks require enabling `charge.dispute.created` and `charge.dispute.closed` in the Stripe dashboard webhook configuration
* The append-only event log pattern is inspired by event sourcing — each event is an immutable fact. The purchase table remains the "current state" projection.

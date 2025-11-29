## 1.1 Database Schema

---

### Implementation Summary (2025-01-29)

**Status**: ✅ COMPLETED

**Files Created/Modified**:
- `src/db/schemas/commerce.ts` - New file with commerce tables and relations
- `src/db/schemas/common.ts` - Added 3 ID generators
- `src/db/schemas/competitions.ts` - Added 4 fee config fields + 3 payment tracking fields
- `src/db/schemas/teams.ts` - Added 3 Stripe Connect fields (Phase 2 prep)
- `src/db/schema.ts` - Added commerce export
- `src/db/migrations/0038_add-commerce-schema.sql` - Generated migration

**Decisions Made**:
1. Avoided circular imports by NOT adding FK reference from `competition_registrations.commercePurchaseId` to commerce table - used plain text field instead
2. Added type enums (`COMMERCE_PRODUCT_TYPE`, `COMMERCE_PURCHASE_STATUS`, `COMMERCE_PAYMENT_STATUS`) for type safety
3. Included `competitionDivisionFeesRelations` for easy querying with Drizzle ORM

**Questions Exposed**:
- None - schema follows plan specification exactly

---

### New Tables

**File**: `src/db/schemas/commerce.ts`

**`commerce_product`** - Purchasable products (competition registrations)

```typescript
import { commonColumns, createCommerceProductId, createCommercePurchaseId } from "./common"

export const commerceProductTable = sqliteTable('commerce_product', {
  ...commonColumns,
  id: text()
    .primaryKey()
    .$defaultFn(() => createCommerceProductId())
    .notNull(),
  name: text({ length: 255 }).notNull(), // "Competition Registration - [Event Name]"
  type: text({ length: 50 }).notNull(), // 'COMPETITION_REGISTRATION' | 'ADDON'
  resourceId: text().notNull(), // competitionId
  priceCents: integer().notNull(), // Base registration fee
}, (table) => [
  // Prevent duplicate products for same resource
  uniqueIndex('commerce_product_resource_idx').on(table.type, table.resourceId),
])
```

**`commerce_purchase`** - Purchase transaction records

```typescript
export const commercePurchaseTable = sqliteTable('commerce_purchase', {
  ...commonColumns,
  id: text()
    .primaryKey()
    .$defaultFn(() => createCommercePurchaseId())
    .notNull(),
  userId: text()
    .notNull()
    .references(() => userTable.id, { onDelete: 'cascade' }),
  productId: text()
    .notNull()
    .references(() => commerceProductTable.id, { onDelete: 'cascade' }),
  status: text({ length: 20 }).notNull(), // 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

  // Context for competition registrations
  competitionId: text(), // Stored directly for queries (not just in metadata)
  divisionId: text(), // Stored directly for queries

  // Amounts (all in cents)
  totalCents: integer().notNull(), // Amount charged to customer
  platformFeeCents: integer().notNull(), // Wodsmith revenue
  stripeFeeCents: integer().notNull(), // Stripe's fee
  organizerNetCents: integer().notNull(), // What organizer receives

  // Stripe references (using Checkout Sessions, not PaymentIntents directly)
  stripeCheckoutSessionId: text(), // Checkout Session ID
  stripePaymentIntentId: text(), // Set after checkout completes (from session.payment_intent)

  // Extensibility (JSON for team registration data, etc.)
  metadata: text({ length: 10000 }), // JSON

  completedAt: integer({ mode: 'timestamp' }),
}, (table) => [
  index('commerce_purchase_user_idx').on(table.userId),
  index('commerce_purchase_product_idx').on(table.productId),
  index('commerce_purchase_status_idx').on(table.status),
  index('commerce_purchase_stripe_session_idx').on(table.stripeCheckoutSessionId),
  index('commerce_purchase_competition_idx').on(table.competitionId),
])
```

**Relations**:

```typescript
export const commerceProductRelations = relations(commerceProductTable, ({ many }) => ({
  purchases: many(commercePurchaseTable),
}))

export const commercePurchaseRelations = relations(commercePurchaseTable, ({ one }) => ({
  user: one(userTable, {
    fields: [commercePurchaseTable.userId],
    references: [userTable.id],
  }),
  product: one(commerceProductTable, {
    fields: [commercePurchaseTable.productId],
    references: [commerceProductTable.id],
  }),
}))
```

### Schema Additions to Existing Tables

**`competition_division_fees` table** - Per-division pricing (NEW)

Since divisions (scaling_levels) can be reused across competitions, fees are stored per competition+division:

```typescript
export const competitionDivisionFeesTable = sqliteTable('competition_division_fees', {
  ...commonColumns,
  id: text()
    .primaryKey()
    .$defaultFn(() => createCompetitionDivisionFeeId())
    .notNull(),
  competitionId: text()
    .notNull()
    .references(() => competitionsTable.id, { onDelete: 'cascade' }),
  divisionId: text()
    .notNull()
    .references(() => scalingLevelsTable.id, { onDelete: 'cascade' }),
  feeCents: integer().notNull(), // e.g., 20000 = $200, 35000 = $350
}, (table) => [
  // Each division can only have one fee per competition
  uniqueIndex('competition_division_fees_unique_idx').on(table.competitionId, table.divisionId),
  index('competition_division_fees_competition_idx').on(table.competitionId),
])

// Add to common.ts:
export const createCompetitionDivisionFeeId = () => `cdfee_${createId()}`
```

**Example**: A competition with divisions priced differently:
| Division | Fee |
|----------|-----|
| Individual RX | $200 |
| Individual Scaled | $150 |
| Team of 3 | $350 |

**`competitions` table** - Add to `src/db/schemas/competitions.ts`:
```typescript
{
  // ... existing fields

  // Default registration fee (used if no division-specific fee exists)
  defaultRegistrationFeeCents: integer().default(0), // $0 = free by default

  // Fee configuration (nullable = use platform defaults)
  platformFeePercentage: integer(), // Basis points, null = default 250 (2.5%)
  platformFeeFixed: integer(), // Cents, null = default 200 ($2.00)
  passStripeFeesToCustomer: integer({ mode: 'boolean' }).default(false),
}
```

**Fee Resolution Logic**:
```typescript
// Get fee for a specific division
async function getRegistrationFee(competitionId: string, divisionId: string): Promise<number> {
  const divisionFee = await db.query.competitionDivisionFeesTable.findFirst({
    where: and(
      eq(competitionDivisionFeesTable.competitionId, competitionId),
      eq(competitionDivisionFeesTable.divisionId, divisionId),
    ),
  })

  if (divisionFee) {
    return divisionFee.feeCents
  }

  // Fall back to competition default
  const competition = await db.query.competitionsTable.findFirst({
    where: eq(competitionsTable.id, competitionId),
  })

  return competition?.defaultRegistrationFeeCents ?? 0
}
```

**`competition_registrations` table** - Add to existing schema:
```typescript
{
  // ... existing fields

  // Payment tracking
  commercePurchaseId: text().references(() => commercePurchaseTable.id),
  paymentStatus: text({ length: 20 }), // 'FREE' | 'PENDING_PAYMENT' | 'PAID' | 'FAILED'
  paidAt: integer({ mode: 'timestamp' }),
}
```

**`teams` table** (Phase 2 prep) - Add to `src/db/schemas/teams.ts`:
```typescript
{
  // ... existing fields
  stripeConnectedAccountId: text(), // Stripe Express account ID
  stripeAccountStatus: text({ length: 20 }), // 'NOT_CONNECTED' | 'PENDING' | 'VERIFIED'
  stripeOnboardingCompletedAt: integer({ mode: 'timestamp' }),
}
```

### ID Generators

**Add to `src/db/schemas/common.ts`**:
```typescript
// Commerce ID generators
export const createCommerceProductId = () => `cprod_${createId()}`
export const createCommercePurchaseId = () => `cpur_${createId()}`
```
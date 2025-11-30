# Phase 2: Stripe Connect Integration

**Goal**: Enable payouts to competition organizers
**Scope**: Multi-party payments with organizer revenue distribution

## Deliverables

1. **Connected Account Onboarding** - Express account creation
2. **Multi-Party Payments** - Application fees and transfers
3. **Payout Scheduling** - 14-day pre-event payout logic
4. **Organizer Dashboard** - Revenue tracking and history

---

## 2.1 Stripe Connect Onboarding Flow

```typescript
// src/actions/stripe-connect.action.ts
export const createConnectedAccountAction = createServerAction()
  .handler(async () => {
    const { user } = await getSessionFromCookie()
    const team = await getCurrentTeam()

    // Create Express Connected Account
    const account = await getStripe().accounts.create({
      type: 'express',
      country: 'US',
      email: user.email,
      capabilities: {
        transfers: { requested: true }
      },
      business_type: 'individual',
      metadata: {
        teamId: team.id,
        teamName: team.name
      }
    })

    // Save to database
    await db.update(teamsTable)
      .set({
        stripeConnectedAccountId: account.id,
        stripeAccountStatus: 'PENDING'
      })
      .where(eq(teamsTable.id, team.id))

    // Create account link for onboarding
    const accountLink = await getStripe().accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/compete/organizer/stripe/onboard`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/compete/organizer/stripe/complete`,
      type: 'account_onboarding'
    })

    return { url: accountLink.url }
  })
```

---

## 2.2 Multi-Party Payment Update

```typescript
// Update createCompetitionPurchaseAction to use connected accounts
const paymentIntent = await getStripe().paymentIntents.create({
  amount: feeBreakdown.totalChargeCents,
  currency: 'usd',
  automatic_payment_methods: { enabled: true },
  application_fee_amount: feeBreakdown.platformFeeCents, // Wodsmith keeps this
  transfer_data: {
    destination: organizingTeam.stripeConnectedAccountId // Organizer gets rest
  },
  metadata: {
    purchaseId: purchase.id,
    competitionId: input.competitionId
  }
})
```

---

## 2.3 Payout Tracking & Reporting

```typescript
// Track transfers for reporting purposes
// Note: Transfers happen automatically via Stripe Connect
// This is just for internal tracking and organizer dashboards

interface PayoutRecord {
  transferId: string
  competitionId: string
  organizingTeamId: string
  registrationId: string
  amountCents: number
  platformFeeCents: number
  status: 'pending' | 'paid' | 'failed'
  createdAt: Date
}

// Webhook handler for transfer events
async function handleTransferPaid(transfer: Stripe.Transfer) {
  // Update payout record status
  await db.update(commercePayoutsTable)
    .set({
      status: 'paid',
      paidAt: new Date()
    })
    .where(eq(commercePayoutsTable.stripeTransferId, transfer.id))

  // Update organizer's revenue dashboard
}
```

---

## 2.4 Connected Account Status Webhook

```typescript
// Handle account.updated events to track onboarding status
async function handleAccountUpdated(account: Stripe.Account) {
  const team = await db.query.teamsTable.findFirst({
    where: eq(teamsTable.stripeConnectedAccountId, account.id),
  })

  if (!team) return

  const status = account.charges_enabled && account.payouts_enabled
    ? 'VERIFIED'
    : 'PENDING'

  await db.update(teamsTable)
    .set({
      stripeAccountStatus: status,
      stripeOnboardingCompletedAt: status === 'VERIFIED' ? new Date() : null,
    })
    .where(eq(teamsTable.id, team.id))
}
```

---

## 2.5 Organizer Dashboard

### Revenue Overview Component

```typescript
// src/app/(compete)/compete/organizer/[slug]/revenue/page.tsx
export default async function RevenuePage({ params }: { params: { slug: string } }) {
  const competition = await getCompetition(params.slug)
  const revenue = await getCompetitionRevenue(competition.id)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{revenue.registrationCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gross Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              ${(revenue.grossRevenueCents / 100).toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Net Payout</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">
              ${(revenue.netPayoutCents / 100).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Registration breakdown table */}
      <RegistrationRevenueTable registrations={revenue.registrations} />
    </div>
  )
}
```

---

## Database Schema Additions

```typescript
// src/db/schemas/commerce.ts - Add for Phase 2

export const commercePayoutsTable = sqliteTable('commerce_payouts', {
  ...commonColumns,
  id: text()
    .primaryKey()
    .$defaultFn(() => createCommercePayoutId())
    .notNull(),
  teamId: text()
    .notNull()
    .references(() => teamsTable.id, { onDelete: 'cascade' }),
  competitionId: text()
    .notNull()
    .references(() => competitionsTable.id, { onDelete: 'cascade' }),
  purchaseId: text()
    .notNull()
    .references(() => commercePurchaseTable.id, { onDelete: 'cascade' }),

  amountCents: integer().notNull(),
  stripeTransferId: text(),
  status: text({ length: 20 }).notNull(), // 'PENDING' | 'PAID' | 'FAILED'

  paidAt: integer({ mode: 'timestamp' }),
}, (table) => [
  index('commerce_payouts_team_idx').on(table.teamId),
  index('commerce_payouts_competition_idx').on(table.competitionId),
  index('commerce_payouts_status_idx').on(table.status),
])
```

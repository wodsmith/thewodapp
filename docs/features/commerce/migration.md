# Migration & Deployment

## Migration Plan

### Step 1: Generate Migration

```bash
pnpm db:generate add-commerce-schema
```

### Step 2: Review Generated SQL

Check `src/db/migrations/` for new migration file, verify:
- All tables created with correct columns
- Foreign keys established
- Indexes on frequently queried columns (userId, productId, status)

### Step 3: Apply to Local Database

```bash
pnpm db:migrate:dev
```

### Step 4: Seed Initial Fee Configuration

```typescript
// src/db/seed-commerce.ts
await db.insert(commercePlatformFeeTable).values([
  {
    name: 'Wodsmith Platform Fee',
    type: 'PLATFORM',
    percentageBasisPoints: 250,  // 2.5%
    fixedCents: 200,              // $2.00
    isActive: true,
    createdAt: new Date()
  },
  {
    name: 'Stripe Processing Fee',
    type: 'STRIPE',
    percentageBasisPoints: 290,  // 2.9%
    fixedCents: 30,               // $0.30
    isActive: true,
    createdAt: new Date()
  }
])
```

### Step 5: Test Locally

- Run full payment flow with Stripe test mode
- Verify webhook handling
- Check database records

### Step 6: Deploy to Production

```bash
# Apply migration
pnpm db:migrate:prod

# Deploy application
pnpm deploy:prod

# Configure Stripe webhook in dashboard
# Point to: https://wodsmith.com/api/webhooks/stripe
```

---

## Files Overview

### New Files (Phase 1)

```
src/
├── db/schemas/
│   └── commerce.ts                          # Commerce tables (product, purchase, division_fees)
├── server/commerce/
│   └── fee-calculator.ts                    # Fee computation + getRegistrationFee()
├── actions/
│   └── commerce.action.ts                   # Server actions (initiateRegistrationPayment, etc.)
├── app/api/webhooks/stripe/
│   └── route.ts                             # Stripe webhook handler
├── app/(compete)/compete/[slug]/register/
│   └── success/
│       └── page.tsx                         # Payment success page
└── app/(compete)/compete/organizer/[slug]/settings/registration/
    ├── page.tsx                             # Organizer fee configuration page
    └── _components/
        └── registration-fee-settings.tsx   # Fee config UI component

docs/features/commerce/
├── README.md                                # Overview and index
├── phase-1-commerce-foundation.md           # Phase 1 details
├── phase-2-stripe-connect.md                # Phase 2 details
├── phase-3-future-enhancements.md           # Future features
├── migration.md                             # This document
├── testing.md                               # Test checklist
└── appendix.md                              # Fee examples, ERD
```

### Modified Files (Phase 1)

```
src/
├── db/
│   ├── schema.ts                            # Export commerce tables
│   └── schemas/
│       ├── common.ts                        # Add commerce ID generators
│       ├── competitions.ts                  # Add registrationFeeCents, fee config fields
│       └── teams.ts                         # Add Stripe Connect fields (Phase 2 prep)
├── app/(compete)/compete/[slug]/register/
│   ├── page.tsx                             # No changes needed
│   └── _components/
│       └── registration-form.tsx            # Add checkout redirect, fee display
├── lib/
│   └── stripe.ts                            # Already exists (verify)
└── utils/
    └── with-rate-limit.ts                   # Already exists (verify RATE_LIMITS.PURCHASE)

Root:
├── .env                                      # Add STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL
├── wrangler.jsonc                           # Add webhook secret binding
└── package.json                             # No new deps! (stripe already installed for server)
```

---

## Environment Variables

### Development (`.env`)

```env
# Stripe Test Mode
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Production (`wrangler.jsonc`)

```jsonc
{
  "vars": {
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": "pk_live_xxxxx",
    "NEXT_PUBLIC_APP_URL": "https://wodsmith.com"
  }
}
```

Secrets (set via `wrangler secret put`):
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

---

## Stripe Dashboard Configuration

### Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://wodsmith.com/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `account.updated` (Phase 2)
   - `transfer.paid` (Phase 2)
4. Copy signing secret to `STRIPE_WEBHOOK_SECRET`

### Test Mode vs Live Mode

- Development uses test mode keys (`sk_test_`, `pk_test_`)
- Production uses live mode keys (`sk_live_`, `pk_live_`)
- Webhook endpoints are environment-specific

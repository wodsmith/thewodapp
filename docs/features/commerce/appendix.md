# Appendix

## Stripe Resources

- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [PaymentIntents API](https://stripe.com/docs/api/payment_intents)
- [Webhooks Guide](https://stripe.com/docs/webhooks)
- [Express Accounts](https://stripe.com/docs/connect/express-accounts)
- [Stripe Checkout](https://stripe.com/docs/checkout)

---

## Fee Calculation Examples

### Scenario 1: Organizer Absorbs Stripe Fees (default)

| Registration Fee | Platform Fee | Total Charged | Stripe Deducts | Net Received | Wodsmith Keeps | Organizer Gets |
|------------------|--------------|---------------|----------------|--------------|----------------|----------------|
| $25.00 | $2.63 | $27.63 | $1.10 | $26.53 | $2.63 | $23.90 |
| $50.00 | $3.25 | $53.25 | $1.84 | $51.41 | $3.25 | $48.16 |
| $100.00 | $4.50 | $104.50 | $3.33 | $101.17 | $4.50 | $96.67 |
| $200.00 | $7.00 | $207.00 | $6.30 | $200.70 | $7.00 | $193.70 |

### Scenario 2: Customer Pays Stripe Fees (optional per competition)

*Uses algebraic formula: `total = (subtotal + stripeFixed) / (1 - stripeRate)`*

| Registration Fee | Platform Fee | Stripe Fee | Total Charged | Wodsmith Keeps | Organizer Gets |
|------------------|--------------|------------|---------------|----------------|----------------|
| $25.00 | $2.63 | $1.13 | $28.76 | $2.63 | $25.00 |
| $50.00 | $3.25 | $1.90 | $55.15 | $3.25 | $50.00 |
| $100.00 | $4.50 | $3.43 | $107.93 | $4.50 | $100.00 |
| $200.00 | $7.00 | $6.49 | $213.49 | $7.00 | $200.00 |

*Note: In Scenario 2, organizer receives exactly the registration fee they set. The Stripe fee is calculated to ensure that after Stripe deducts their percentage from the total, the remaining amount covers both the subtotal and the fixed Stripe fee.*

---

## Database ERD

```
┌──────────────────┐         ┌──────────────────┐
│  competitions    │         │  commerce_product│
│                  │         │                  │
│  id (PK)        │◄────────┤  resourceId (FK) │
│  name            │         │  id (PK)         │
│  registrationFee │         │  name            │
│  platformFee%   │         │  type            │
│  platformFeeFixed│         │  priceCents      │
└──────────────────┘         └──────────────────┘
                                      │
                                      │
                                      ▼
┌──────────────────┐         ┌──────────────────┐
│  users           │         │ commerce_purchase│
│                  │         │                  │
│  id (PK)        │◄────────┤  userId (FK)     │
└──────────────────┘         │  productId (FK)  │──┐
                             │  status          │  │
                             │  totalCents      │  │
                             │  platformFeeCents│  │
                             │  stripeFeeCents  │  │
                             │  stripePaymentId │  │
                             └──────────────────┘  │
                                      │            │
                                      ▼            │
                             ┌──────────────────┐  │
                             │ competition_reg  │  │
                             │                  │  │
                             │  id (PK)         │  │
                             │  userId (FK)     │  │
                             │  competitionId(FK)│ │
                             │  purchaseId (FK)◄┘──┘
                             │  isPaid          │
                             │  paidAt          │
                             └──────────────────┘
```

### Division Fees Relationship

```
┌──────────────────┐         ┌──────────────────────────┐
│  competitions    │         │ competition_division_fees│
│                  │         │                          │
│  id (PK)        │◄────────┤  competitionId (FK)      │
│  defaultFeeCents │         │  divisionId (FK)         │────┐
└──────────────────┘         │  feeCents                │    │
                             └──────────────────────────┘    │
                                                             │
                             ┌──────────────────┐            │
                             │  scaling_levels  │            │
                             │                  │            │
                             │  id (PK)        │◄───────────┘
                             │  label           │
                             │  teamSize        │
                             └──────────────────┘
```

---

## Platform Fee Formula

### Default Platform Fee
- **Percentage**: 2.5% (250 basis points)
- **Fixed**: $2.00 (200 cents)
- **Formula**: `platformFee = (registrationFee * 0.025) + $2.00`

### Stripe Processing Fee
- **Percentage**: 2.9% (290 basis points)
- **Fixed**: $0.30 (30 cents)
- **Formula**: `stripeFee = (totalCharge * 0.029) + $0.30`

### Pass-to-Customer Formula

When passing Stripe fees to customer, we need to solve for the total that covers Stripe's cut:

```
Given:
- subtotal = registrationFee + platformFee
- stripeRate = 0.029 (2.9%)
- stripeFixed = $0.30

We need: total - (total * stripeRate) - stripeFixed = subtotal

Solving:
total * (1 - stripeRate) = subtotal + stripeFixed
total = (subtotal + stripeFixed) / (1 - stripeRate)
total = (subtotal + 0.30) / 0.971
```

### Example Calculation

Registration fee: $50.00

**Step 1**: Calculate platform fee
```
platformFee = ($50.00 * 0.025) + $2.00 = $1.25 + $2.00 = $3.25
```

**Step 2**: Calculate subtotal
```
subtotal = $50.00 + $3.25 = $53.25
```

**Step 3 (Organizer Absorbs)**: Stripe fee from subtotal
```
stripeFee = ($53.25 * 0.029) + $0.30 = $1.54 + $0.30 = $1.84
totalCharge = $53.25
organizerNet = $53.25 - $1.84 - $3.25 = $48.16
```

**Step 3 (Customer Pays)**: Solve for total
```
total = ($53.25 + $0.30) / 0.971 = $55.15
stripeFee = ($55.15 * 0.029) + $0.30 = $1.90
organizerNet = $50.00 (exactly registration fee)
```

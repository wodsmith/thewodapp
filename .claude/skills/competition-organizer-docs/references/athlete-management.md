# Athlete Management Workflows

Workflows for managing registrations, athletes, and divisions.

## 1. Manage Registrations

| Attribute | Value |
|-----------|-------|
| **Route** | `$competitionId/athletes` |
| **Complexity** | Low |
| **Doc Type** | How-to |
| **Prerequisites** | Registration open, pricing configured |

### Key Components
- `AthleteList` - Registration management
- `RegistrationDetail` - Individual athlete view
- `PaymentStatus` - Payment tracking
- `WaiverStatus` - Waiver completion

### User Actions
1. View registered athletes
2. Filter by division, payment status, waiver status
3. Manually add/edit athletes
4. Process refunds
5. Transfer registrations between divisions
6. Export athlete list

### Documentation Requirements

**How-to Focus:**
- Process a registration transfer
- Handle refund requests
- Bulk export for check-in sheets
- Manually add walk-up registrations

---

## 2. Configure Pricing

| Attribute | Value |
|-----------|-------|
| **Route** | `$competitionId/pricing` |
| **Complexity** | Medium |
| **Doc Type** | Tutorial (initial), How-to (updates) |
| **Prerequisites** | Divisions configured |

### Key Components
- `PricingManager` - Price tier management
- `EarlyBirdConfig` - Time-based pricing
- `DiscountCodes` - Promotional codes
- `StripeConnect` - Payment processing

### User Actions
1. Set base registration price per division
2. Configure early-bird pricing windows
3. Create discount codes
4. Set payment processing (Stripe)
5. Configure refund policies

### Documentation Requirements

**Tutorial Focus:**
- Set up basic pricing structure
- Connect Stripe account
- Open registration

**How-to Focus:**
- Create early-bird tiers
- Manage discount codes
- Handle partial refunds

**Reference Focus:**
- Stripe fee calculations
- Refund policy options
- Price field configurations

---

## CI Change Detection

```yaml
triggers:
  "src/app/(main)/compete/$competitionId/athletes/**":
    workflows: [manage-registrations]
    priority: medium

  "src/app/(main)/compete/$competitionId/pricing/**":
    workflows: [configure-pricing]
    priority: high
```

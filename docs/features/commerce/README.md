# Stripe Commerce Implementation Plan

**Last Updated**: 2025-01-28
**Status**: Planning (Updated after review)
**Owner**: Engineering Team

## Overview

Implement a commerce system for competition registrations with variable platform fees, comprehensive fee tracking, and future support for Stripe Connect payouts to competition organizers.

## Document Index

| Document | Description |
|----------|-------------|
| [Phase 1: Commerce Foundation](./phase-1-commerce-foundation.md) | MVP - Basic registration payments, fee tracking |
| [Phase 2: Stripe Connect](./phase-2-stripe-connect.md) | Organizer payouts via Stripe Connect |
| [Phase 3: Future Enhancements](./phase-3-future-enhancements.md) | Advanced features and considerations |
| [Migration & Deployment](./migration.md) | Database migrations and deployment steps |
| [Testing & Success Criteria](./testing.md) | Test checklist and completion criteria |
| [Appendix](./appendix.md) | Fee examples, ERD, Stripe resources |

---

## Business Requirements

- **Platform Fee Structure**: Variable by competition
  - Default: 2.5% + $2.00 per transaction
  - Configurable per competition for flexibility
- **Stripe Processing Fee**: 2.9% + $0.30 per transaction
- **Stripe Fee Handling**: Organizer chooses who pays
  - Default: Organizer absorbs Stripe fees
  - Optional: Pass Stripe fees to customer (customer pays all fees)
  - Configurable per competition for flexibility
- **Fee Transparency**: Store and display all fee breakdowns
- **Refund Policy**: No refunds
- **Free Competitions**: Supported (skip payment flow when fee is $0)
- **Team Registration Payment**: Captain pays for entire team
- **Future Capability**: Stripe Connect payouts to organizers

---

## Key Architecture Decision

**Two-Phase Registration Flow**: To integrate commerce with the existing complex registration logic (team creation, membership, invitations), we use a two-phase approach:

1. **Phase 1 (Before Payment)**: Create registration with `paymentStatus: 'PENDING_PAYMENT'` - does NOT create team_membership or invite teammates yet
2. **Phase 2 (After Payment)**: Webhook completes the registration - creates team_membership, athlete team, invites teammates

This prevents orphaned records if payment fails while maintaining the existing registration logic.

---

## Revenue Examples (Registration Fee: $50)

**Option A: Organizer absorbs Stripe fee** (default)
```
Registration Fee:        $50.00
Platform Fee (2.5%+$2):  $3.25
---
Total Charged:           $53.25
Stripe deducts:          $1.84
Net received:            $51.41
Wodsmith keeps:          $3.25
Organizer receives:      $48.16
```

**Option B: Pass Stripe fees to customer** (configurable per competition)
```
Registration Fee:        $50.00
Platform Fee (2.5%+$2):  $3.25
Stripe Fee (2.9%+$0.30): $1.84
---
Total Charged:           $55.09
Wodsmith receives:       $3.25
Organizer receives:      $50.00 (exactly registration fee set)
```

Organizers can choose their preferred model when creating competitions.

---

## Payout Timing Strategy

### WodSmith Approach: Immediate Payouts

**Decision**: Pay organizers immediately after each registration (via Stripe Connect transfers)

**Rationale**:
- Organizers need working capital for event preparation (equipment, venue, prizes)
- Simpler to implement - no delayed payout logic or scheduling
- Lets organizers manage their own cash flow and risk
- Aligns with no-refund policy (organizers keep funds, handle cancellations themselves)

**Implementation** (Phase 2):
- Use Stripe Connect `transfer_data.destination` for automatic transfers
- Funds move to organizer's connected account as registrations come in
- Platform fee deducted automatically before transfer
- Organizer's Stripe account payout schedule determines when they receive funds (typically 2-day rolling)

---

## Implementation Phases Overview

| Phase | Goal | Scope |
|-------|------|-------|
| **Phase 1** | Commerce Foundation (MVP) | Basic registration payments, fees tracked, no payouts |
| **Phase 2** | Stripe Connect Integration | Multi-party payments with organizer revenue distribution |
| **Phase 3** | Future Enhancements | Advanced analytics, payout exports |

---

## Changes from Review (2025-01-28)

### Issues Addressed from `commerce-plan-review.md`:

| Issue | Resolution |
|-------|------------|
| **Server action pattern mismatch** | Changed from `createServerAction()` to plain async functions with `withRateLimit()` matching `credits.action.ts` |
| **Missing webhook idempotency** | Added dual idempotency checks (purchase status + registration existence) |
| **Missing common columns/ID generators** | Added `createCommerceProductId`, `createCommercePurchaseId` to schema |
| **Missing Drizzle relations** | Added `commerceProductRelations`, `commercePurchaseRelations` |
| **Missing divisionId as column** | Added `competitionId` and `divisionId` as proper columns on `commerce_purchase` |
| **Product deduplication issue** | Changed to find-or-create pattern with unique index |
| **Missing Stripe signature error handling** | Separated signature verification from processing errors with proper HTTP status codes |
| **Frontend error handling** | Added proper error state and user-friendly messages |
| **TypeScript `any` types** | Changed webhook handler to use `Stripe.PaymentIntent` type |

### Additional Improvements:

| Enhancement | Description |
|-------------|-------------|
| **Stripe Checkout** | Using hosted Stripe Checkout page instead of Stripe Elements - simpler, handles 3DS/Apple Pay automatically |
| **Organizer fee configuration** | Organizer UI at `/compete/organizer/[slug]/settings/registration` for setting fees |
| **Per-division pricing** | `competition_division_fees` table allows different fees per division (e.g., $200 Individual, $350 Team) |
| **Fee resolution logic** | Division fee -> competition default -> $0 (free) |
| **Free competition support** | $0 fee skips payment flow |
| **Team registration payment** | Captain pays for entire team; team data stored in metadata for webhook |
| **Two-phase registration** | Payment creates purchase first; webhook calls `registerForCompetition()` |
| **Resume abandoned checkout** | Existing pending checkouts are returned if still open |
| **Checkout expiration handling** | Webhook handles `checkout.session.expired` to mark purchases as CANCELLED |
| **Dynamic fee display** | Fee breakdown updates when user selects different division |
| **No frontend Stripe deps** | No @stripe/react-stripe-js needed - just redirect to checkout URL |

---

**Document Version**: 2.3
**Last Updated**: 2025-01-28
**Changes**:
- v2.3: Switched from Stripe Elements to Stripe Checkout (hosted page)
- v2.2: Added organizer fee configuration UI (section 1.5)
- v2.1: Added per-division pricing support
- v2.0: Initial review fixes
**Next Review**: After Phase 1 completion

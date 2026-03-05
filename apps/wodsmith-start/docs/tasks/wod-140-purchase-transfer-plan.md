# WOD-140: Purchase Transfer Implementation Plan

Transfer a purchase (and its associated registration) from one person to another. Built as a **generic purchase transfer system** that competitions hook into.

## Reference

- Linear: WOD-140
- Inspiration: [course-builder PurchaseUserTransfer](https://github.com/badass-courses/course-builder) — state machine with dedicated transfer table
- Existing patterns: `transferRegistrationDivisionFn` (WOD-139), `removeRegistrationFn` (soft-delete)

---

## Architecture Overview

```
 Organizer                     System                      Target User
 ────────                     ──────                      ───────────
    │                            │                             │
    │  1. Initiate transfer      │                             │
    │   (enter target email)     │                             │
    │ ─────────────────────────► │                             │
    │                            │  2. Create INITIATED        │
    │                            │     transfer record         │
    │                            │                             │
    │                            │  3. Send transfer email     │
    │                            │     with accept link        │
    │                            │ ──────────────────────────► │
    │                            │                             │
    │  Athletes page shows       │                             │
    │  "Transfer Pending" badge  │     4. Click accept link    │
    │                            │ ◄──────────────────────────  │
    │                            │                             │
    │                            │  5. If no account:          │
    │                            │     → Create account first  │
    │                            │     → Then accept           │
    │                            │                             │
    │                            │  6. Execute transfer:       │
    │                            │     • Move purchase         │
    │                            │     • Call product-type     │
    │                            │       handler (competition  │
    │                            │       registration, etc.)   │
    │                            │     • Mark COMPLETED        │
    │                            │                             │
```

---

## Step 1: Database Schema — `purchase_transfers` table

**File:** `src/db/schemas/commerce.ts`

```typescript
// Transfer states — two-phase: organizer initiates, target user accepts
export const PURCHASE_TRANSFER_STATUS = {
  INITIATED: "INITIATED",   // Organizer started transfer, awaiting target acceptance
  COMPLETED: "COMPLETED",   // Target accepted, transfer executed
  CANCELLED: "CANCELLED",   // Organizer cancelled before target accepted
  EXPIRED: "EXPIRED",       // Target never accepted within expiration window
} as const

export type PurchaseTransferStatus =
  (typeof PURCHASE_TRANSFER_STATUS)[keyof typeof PURCHASE_TRANSFER_STATUS]

export const purchaseTransfersTable = mysqlTable(
  "purchase_transfers",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createPurchaseTransferId())
      .notNull(),
    // The purchase being transferred
    purchaseId: varchar({ length: 255 }).notNull(),
    // Who currently owns the purchase
    sourceUserId: varchar({ length: 255 }).notNull(),
    // Email the organizer sent the transfer to
    targetEmail: varchar({ length: 255 }).notNull(),
    // Email the target user actually signed up / accepted with (may differ from targetEmail)
    acceptedEmail: varchar({ length: 255 }),
    // Resolved target userId (set when they accept — NULL until then)
    targetUserId: varchar({ length: 255 }),
    // Current state
    transferState: varchar({ length: 20 })
      .$type<PurchaseTransferStatus>()
      .notNull()
      .default("INITIATED"),
    // Who initiated the transfer (organizer userId)
    initiatedBy: varchar({ length: 255 }).notNull(),
    // Timestamps
    expiresAt: datetime().notNull(),    // e.g. 7 days from initiation
    completedAt: datetime(),
    cancelledAt: datetime(),
    // Optional notes from organizer
    notes: text(),
  },
  (table) => [
    index("purchase_transfers_purchase_idx").on(table.purchaseId),
    index("purchase_transfers_source_idx").on(table.sourceUserId),
    index("purchase_transfers_target_email_idx").on(table.targetEmail),
    index("purchase_transfers_state_idx").on(table.transferState),
  ],
)
```

**File:** `src/db/schemas/common.ts` — add ID generator:

```typescript
export const createPurchaseTransferId = () => `ptxfr_${ulid()}`
```

### Why a separate table (not just updating purchase.userId)?

1. **Pending state** — transfer exists before target accepts; need to track the in-between
2. **Audit trail** — who transferred what to whom, when, and who initiated it
3. **Expiration** — transfers that aren't accepted within the window auto-expire
4. **Reversibility** — can trace back original owner if needed
5. **Consistency** with course-builder pattern that's proven at scale

### Key schema decisions

- **`targetEmail` instead of `targetUserId`** — target may not have an account yet. `targetUserId` gets set when they accept.
- **`expiresAt`** — 7-day window. Organizer can cancel before expiration. After expiration, transfer is dead.
- **No `AVAILABLE` state** — course-builder uses AVAILABLE→INITIATED for self-service. We only need INITIATED (organizer-triggered) → COMPLETED/CANCELLED/EXPIRED.

---

## Step 2: Server Functions — Two-Phase Transfer

**File:** `src/server-fns/purchase-transfer-fns.ts`

### Phase 1: `initiatePurchaseTransferFn` (organizer action)

**Input:**
```typescript
const initiatePurchaseTransferInputSchema = z.object({
  purchaseId: z.string().min(1),
  targetEmail: z.string().email(),
  notes: z.string().optional(),
})
```

**Context available on the purchase itself (no extra lookups needed):**

The `commerce_purchases` table already has `competitionId`, `divisionId`, and `productId` denormalized on it. The athletes page loader already has registrations with `commercePurchaseId`. So the flow is:

1. Organizer clicks "Transfer to Person" on athletes page → passes `commercePurchaseId`
2. Server loads the purchase → has `competitionId` right there
3. Loads product via `productId` → gets `type` (COMPETITION_REGISTRATION, ADDON, etc.)
4. Dispatches to the right handler based on `type`

No dynamic product discovery needed — the purchase carries all context.

**Flow:**

1. **Auth** — `requireVerifiedEmail()`
2. **Load purchase** — exists, status = COMPLETED. Purchase has `competitionId`, `productId` directly.
3. **Load product** — get `type` to determine which handler to use
4. **Authorize by product type** — dispatch to handler's `authorize()`:
   - `COMPETITION_REGISTRATION` → use `purchase.competitionId` to find `organizingTeamId`, verify MANAGE_COMPETITIONS
5. **Check no active transfer** — no INITIATED transfer already exists for this purchase
6. **Validate target email** — not the same as source user's email, and not already registered in the same division (look up by email → userId → check active registrations)
7. **Product-type pre-flight validation** — dispatch to handler's `validateInitiate()`:
   - `COMPETITION_REGISTRATION` → verify linked registration is active, not removed
8. **Create transfer record** — `INITIATED` state, `expiresAt = now + 7 days`
9. **Send transfer email** — email to `targetEmail` with an accept link: `/transfer/$transferId`
10. **Return** `{ success: true, transferId }`

**What does NOT happen yet:** no registration changes, no purchase reassignment. The source athlete stays registered and competing until the target accepts.

### Product-type handler registry

```typescript
// src/server/commerce/transfer-handlers.ts

interface TransferHandler {
  authorize: (purchase: CommercePurchase, session: Session) => Promise<void>
  validateInitiate: (purchase: CommercePurchase) => Promise<void>
  validateAccept: (purchase: CommercePurchase, targetUserId: string) => Promise<void>
  executeTransfer: (purchase: CommercePurchase, targetUserId: string) => Promise<void>
}

const TRANSFER_HANDLERS: Record<CommerceProductType, TransferHandler> = {
  COMPETITION_REGISTRATION: competitionRegistrationTransferHandler,
  // ADDON: addonTransferHandler,  // future
}
```

The generic function resolves the handler via `product.type` and delegates. All competition-specific logic stays in the handler.

### Phase 2: `acceptPurchaseTransferFn` (target user action)

**Input:**
```typescript
const acceptPurchaseTransferInputSchema = z.object({
  transferId: z.string().min(1),
  // Competition-specific: registration questions + waiver signatures
  answers: z.array(z.object({
    questionId: z.string(),
    answer: z.string(),
  })).optional(),
  waiverSignatures: z.array(z.object({
    waiverId: z.string(),
  })).optional(),
})
```

**Flow:**

1. **Auth** — `requireVerifiedEmail()` (target must have a verified account)
2. **Load transfer** — must be INITIATED and not expired (`expiresAt > now`)
3. **No strict email match** — anyone with the link can accept (the link is the secret). The user who accepts may have signed up with a different email than `targetEmail`.
4. **Set `targetUserId`** and **`acceptedEmail`** — records who actually accepted and with what email
5. **Validate no conflicts** — target user doesn't already have an active registration in the same competition+division (for competition purchases)
6. **Execute product-type handler** — `handleCompetitionRegistrationTransfer()`
7. **Update purchase** — set `purchase.userId = targetUserId`
8. **Complete transfer** — set `transferState = COMPLETED`, `completedAt = now()`
9. **Return** `{ success: true }`

### Why `targetEmail` + `acceptedEmail`?

The organizer enters the email they have for the person (`targetEmail`). But that person may already have a WODsmith account under a different email, or may create one with a different email. We track both:
- `targetEmail` — where the invitation email was sent
- `acceptedEmail` — the email on the account that actually accepted
- This gives organizers visibility into who ended up with the transfer

### `cancelPurchaseTransferFn` (organizer action)

**Input:**
```typescript
const cancelPurchaseTransferInputSchema = z.object({
  transferId: z.string().min(1),
})
```

**Flow:**

1. **Auth** — `requireVerifiedEmail()`
2. **Load transfer** — must be INITIATED. Load purchase → product to determine type.
3. **Authorize by product type** — same dispatch as initiate (e.g. MANAGE_COMPETITIONS for competition purchases)
4. **Cancel** — set `transferState = CANCELLED`, `cancelledAt = now()`
5. **Return** `{ success: true }`

### `getPendingTransferFn` (for the accept page)

Public-ish server function that loads transfer details for the accept page. Returns:
- Purchase info (amount paid)
- Competition name, division, date
- Source athlete name
- For team registrations: team name, confirmed teammates (names), pending invitations (emails)

Enough for the target to understand what they're accepting — especially who their teammates are.

### Transfer accept page

**Route:** `/transfer/$transferId`

This is the landing page from the email link. Behavior:

- **Not logged in** → show transfer details + "Create Account" / "Sign In" buttons. After auth, redirect back to this page.
- **Logged in, email matches** → show transfer details + "Accept Transfer" button
- **Logged in, email doesn't match** → show error: "This transfer was sent to a different email address"
- **Transfer expired/cancelled/completed** → show appropriate status message

---

## Step 3: Competition Registration Transfer Handler

**File:** `src/server/commerce/transfer-handlers.ts`

### `handleCompetitionRegistrationTransfer()`

Called by the generic transfer function when the purchase is type `COMPETITION_REGISTRATION`.

**Operations** (modeled after `removeRegistrationFn` + `transferRegistrationDivisionFn`):

1. **Find the registration** linked to this purchase (`commercePurchaseId`)
2. **Update registration.userId** to target user
3. **Update registration.captainUserId** to target user (if individual)
4. **Deactivate source user's team membership** in the competition_event team
5. **Create new team membership** for target user in competition_event team
6. **Update registration.teamMemberId** to the new membership
7. **Delete heat assignments** (athlete needs re-scheduling)
8. **Delete scores** for source user in this competition's events
9. **Delete registration answers** — source user's answers (t-shirt size, dietary needs, etc.) don't apply to the new person. They'll need to re-answer if/when we add that flow.
10. **For team registrations** (teamSize > 1):
    - Transfer captaincy: update `captainUserId` to target user
    - Swap source→target in athlete team memberships
    - Keep teammates intact (they stay on the team)

### Edge cases

| Case | Behavior |
|------|----------|
| Target user already registered in same division | Block transfer, return error |
| Target user already registered in different division | Allow (they can be in multiple divisions) |
| Registration is REMOVED | Block transfer |
| Purchase has no linked registration | Block (data integrity issue) |
| Team registration | Transfer captain role, keep teammates |
| Free registration (no purchase) | Not applicable — transfer requires a purchase |

---

## Step 4: UI — Organizer: Initiate Transfer Dialog

**File:** `src/routes/compete/organizer/$competitionId/-components/transfer-registration-dialog.tsx`

Modeled after `TransferDivisionDialog`:

```
┌─────────────────────────────────────────┐
│  Transfer Registration                  │
│                                         │
│  Transfer [Athlete Name]'s registration │
│  in [Division] to a different person.   │
│                                         │
│  Recipient Email:                       │
│  ┌─────────────────────────────────┐    │
│  │ email@example.com               │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Notes (optional):                      │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ℹ An email will be sent to the        │
│    recipient. They must create an       │
│    account and accept the transfer.     │
│                                         │
│  ℹ The transfer expires in 7 days.     │
│                                         │
│           [Cancel]  [Send Transfer]     │
└─────────────────────────────────────────┘
```

**Props:**
```typescript
interface TransferRegistrationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  registration: {
    id: string
    athleteName: string
    divisionId: string | null
    divisionLabel: string | null
    commercePurchaseId: string | null
  }
  competitionId: string
}
```

### Athletes page — pending transfer indicator

Add a **Status** column as the first column in the athletes table. Empty by default, shows a badge for non-standard states:

| State | Badge |
|-------|-------|
| Active (default) | _(empty)_ |
| Transfer Pending | `Transfer Pending` (yellow/warning) |
| Removed | `Removed` (destructive/muted) |

This consolidates the existing "removed" row styling into the same column.

The dropdown menu for that registration should show "Cancel Transfer" instead of "Transfer to Person" while a transfer is pending.

### Athletes page integration

**File:** `src/routes/compete/organizer/$competitionId/athletes.tsx`

Add to the existing dropdown menu (after "Transfer Division", before "Remove Registration"):

```tsx
{pendingTransfer ? (
  <DropdownMenuItem
    className="text-destructive focus:text-destructive"
    onClick={() => handleCancelTransfer(pendingTransfer.id)}
  >
    <X className="h-4 w-4 mr-2" />
    Cancel Transfer
  </DropdownMenuItem>
) : (
  <DropdownMenuItem
    onClick={() => setTransferRegistrationTarget({
      id: row.registrationId,
      athleteName,
      divisionId: row.division?.id ?? null,
      divisionLabel: row.division?.label ?? null,
      commercePurchaseId: row.commercePurchaseId ?? null,
    })}
    disabled={!row.commercePurchaseId}
  >
    <UserPlus className="h-4 w-4 mr-2" />
    Transfer to Person
  </DropdownMenuItem>
)}
```

## Step 4b: UI — Target User: Accept Transfer Page

**Route:** `src/routes/transfer/$transferId.tsx`

```
┌─────────────────────────────────────────┐
│  Registration Transfer                  │
│                                         │
│  [Organizer Name] has transferred a     │
│  registration to you:                   │
│                                         │
│  Competition: Summer Throwdown 2026     │
│  Division: Team RX (3-person)           │
│  Team: Send It Squad                    │
│  From: John Doe (john@example.com)      │
│                                         │
│  Your teammates:                        │
│  • Jane Smith (confirmed)              │
│  • mike@example.com (pending invite)   │
│                                         │
│  ── Registration Questions ──────────  │
│  T-Shirt Size: [Select ▾]              │
│  Dietary Restrictions: [__________]    │
│                                         │
│  ── Waiver ──────────────────────────  │
│  ☐ I agree to the Competition Waiver   │
│    (link to full waiver text)           │
│                                         │
│  By accepting, you'll become the team   │
│  captain for this registration.         │
│                                         │
│           [Accept Transfer]             │
│                                         │
│  Expires: March 4, 2026                 │
└─────────────────────────────────────────┘
```

The accept page always shows:
- Transfer details (competition, division, source athlete)
- For team registrations: team name, confirmed teammates, pending invitations
- **Registration questions** — same form as during normal registration (reuse existing components)
- **Waiver(s)** — must sign before accepting
- Accept button (disabled until all required questions answered + all waivers signed)

The `acceptPurchaseTransferFn` input includes the answers and waiver signatures so they're saved atomically with the transfer.

**States:**
- Not logged in → "Sign in or create an account to accept this transfer" + auth buttons. After auth, redirect back here.
- Logged in → show transfer details + "Accept Transfer" button. Works regardless of which email the user signed up with (the link itself is the authorization).
- Already completed → "This transfer has already been accepted"
- Expired → "This transfer has expired. Contact the organizer to resend."
- Cancelled → "This transfer was cancelled by the organizer"

## Step 4c: Transfer Email

**Template content:**

> Subject: Registration transfer for [Competition Name]
>
> [Organizer] has transferred a registration to you for **[Competition Name]** in the **[Division]** division.
>
> [Accept Transfer →]  (link to `/transfer/$transferId`)
>
> This transfer expires on [expiry date].

Use existing email infrastructure (or add a new template to the transactional email system).

---

## Step 5: Data needed from loader

The athletes page loader already returns registrations with `commercePurchaseId`. Verify the `commercePurchaseId` is included in the loader data passed to the table rows. If not, add it to the query.

---

## Implementation Order

| # | Task | Files | Depends On |
|---|------|-------|------------|
| 1 | Add `createPurchaseTransferId` to common.ts | `schemas/common.ts` | — |
| 2 | Add `purchase_transfers` table + relations to commerce.ts | `schemas/commerce.ts` | 1 |
| 3 | Export new table from schema.ts | `db/schema.ts` | 2 |
| 4 | `pnpm db:push` to apply schema | — | 3 |
| 5 | Write `initiatePurchaseTransferFn` | `server-fns/purchase-transfer-fns.ts` | 3 |
| 6 | Write `cancelPurchaseTransferFn` | `server-fns/purchase-transfer-fns.ts` | 3 |
| 7 | Write `handleCompetitionRegistrationTransfer()` | `server/commerce/transfer-handlers.ts` | 3 |
| 8 | Write `acceptPurchaseTransferFn` + `getPendingTransferFn` | `server-fns/purchase-transfer-fns.ts` | 7 |
| 9 | Create transfer email template | (email infra) | 5 |
| 10 | Create `TransferRegistrationDialog` (organizer initiate) | `routes/.../transfer-registration-dialog.tsx` | 5 |
| 11 | Wire dialog + pending badge into athletes page | `routes/.../athletes.tsx` | 6, 10 |
| 12 | Load pending transfers in athletes page loader | `routes/.../athletes.tsx` | 3 |
| 13 | Create `/transfer/$transferId` accept page | `routes/transfer/$transferId.tsx` | 8 |
| 14 | Test: initiate transfer, verify email sent, pending badge shows | — | 11, 12 |
| 15 | Test: accept transfer as new user (create account → accept) | — | 13 |
| 16 | Test: accept transfer as existing user (different email) | — | 13 |
| 17 | Test: cancel transfer, verify athlete stays | — | 11 |
| 18 | Test: expired transfer | — | 13 |
| 19 | Test: team registration transfer | — | 15 |

---

## What's NOT in v1

- **Self-service transfers** (athlete-initiated from their own dashboard)
- **Stripe customer/charge re-association** (purchase stays linked to original Stripe payment — organizer just needs the spot transferred)
- **Undo / reverse transfer** (can be done manually via another transfer back)
- **Transfer for free registrations** (no purchase to transfer — use remove + re-register)
- **Resend transfer email** (organizer can cancel + re-initiate if needed)

## Resolved Decisions

1. **Waiver signatures** — The accept transfer page shows the competition's waiver(s). New athlete must sign before accepting. Old athlete's signatures are untouched (tracked by userId).
2. **Registration answers** — The accept transfer page shows the competition's registration questions. New athlete fills them out as part of accepting. Old athlete's answers are deleted during transfer execution.

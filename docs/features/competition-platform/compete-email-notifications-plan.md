# WODsmith Compete Email Notifications Plan

## Overview

Add email notifications to the Compete product so users receive confirmation and updates when taking actions. Uses **Resend** as the email provider with **React Email** templates.

### Scope
- Compete flows only (registration, team invites, payments)
- Table-stakes notifications for expected product behavior
- Deferred: Daily organizer digest (requires cron infrastructure)

---

## Current State

### What Exists
- `src/utils/email.tsx` - Multi-provider email utility (Resend + Brevo)
- 3 React Email templates: `verify-email.tsx`, `reset-password.tsx`, `team-invite.tsx`
- Dev server: `pnpm email:dev` on port 3001
- Domain verified: `mail.wodsmith.com` in Resend

### What's Missing
- Competition-specific email templates
- Notification module for Compete flows
- PostHog logging for email events
- Local testing capability

---

## Phase 0: Infrastructure Updates

### 0.1 Update Environment Configuration

**File:** `apps/wodsmith/wrangler.jsonc`

Update email configuration:
```jsonc
"vars": {
  "EMAIL_FROM": "team@wodsmith.com",
  "EMAIL_FROM_NAME": "WODsmith",
  "EMAIL_REPLY_TO": "support@wodsmith.com",
  // ... other vars
}
```

**File:** `apps/wodsmith/.env.example`

Add documentation for email env vars:
```bash
# Email Configuration (Resend)
# Get your API key from https://resend.com/api-keys
RESEND_API_KEY=re_xxxxxxxxxxxx

# Email sender configuration (set in wrangler.jsonc for production)
EMAIL_FROM=team@wodsmith.com
EMAIL_FROM_NAME=WODsmith
EMAIL_REPLY_TO=support@wodsmith.com

# Set to "true" to send real emails in development (requires RESEND_API_KEY)
EMAIL_TEST_MODE=false
```

### 0.2 Simplify Email Utility

**File:** `apps/wodsmith/src/utils/email.tsx`

Simplify to Resend-only and add:
1. Generic `sendEmail` helper
2. PostHog logging for all email events
3. Local test mode support

```typescript
import "server-only"
import { render } from "@react-email/render"
import { logInfo, logError } from "@/lib/logging/posthog-otel-logger"
import isProd from "./is-prod"

interface SendEmailOptions {
  to: string | string[]
  subject: string
  template: React.ReactElement
  tags?: { name: string; value: string }[]
  replyTo?: string
}

const isTestMode = process.env.EMAIL_TEST_MODE === "true"
const shouldSendEmail = isProd || isTestMode

export async function sendEmail({
  to,
  subject,
  template,
  tags = [],
  replyTo,
}: SendEmailOptions): Promise<void> {
  const recipients = Array.isArray(to) ? to : [to]
  const emailType = tags.find(t => t.name === "type")?.value ?? "unknown"

  if (!shouldSendEmail) {
    console.warn(`\n[Email Preview] To: ${recipients.join(", ")}\nSubject: ${subject}\nType: ${emailType}\n`)
    logInfo({
      message: "[Email] Skipped (dev mode)",
      attributes: { to: recipients.join(","), subject, emailType },
    })
    return
  }

  if (!process.env.RESEND_API_KEY) {
    logError({
      message: "[Email] RESEND_API_KEY not configured",
      attributes: { to: recipients.join(","), subject, emailType },
    })
    return
  }

  try {
    const html = await render(template)
    
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
        to: recipients,
        subject,
        html,
        reply_to: replyTo ?? process.env.EMAIL_REPLY_TO,
        tags,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Resend API error: ${JSON.stringify(error)}`)
    }

    const result = await response.json()

    logInfo({
      message: "[Email] Sent successfully",
      attributes: {
        to: recipients.join(","),
        subject,
        emailType,
        resendId: result.id,
      },
    })
  } catch (err) {
    logError({
      message: "[Email] Failed to send",
      error: err,
      attributes: {
        to: recipients.join(","),
        subject,
        emailType,
      },
    })
    // Don't re-throw - email failures shouldn't break primary actions
  }
}
```

Keep existing `sendPasswordResetEmail`, `sendVerificationEmail`, `sendTeamInvitationEmail` functions but refactor them to use `sendEmail` internally.

---

## Phase 1: Email Templates

Create competition-specific React Email templates in `apps/wodsmith/src/react-email/compete/`:

### 1.1 Registration Confirmation Email

**File:** `apps/wodsmith/src/react-email/compete/registration-confirmation.tsx`

**Triggered by:** 
- Free registration: `registerForCompetition()` in `src/server/competitions.ts`
- Paid registration: `handleCheckoutCompleted()` in `src/app/api/webhooks/stripe/route.ts`

**Content:**
- Competition name
- Division registered for
- Team name (if team division)
- Registration date
- Event date (if set)
- CTA: "View Registration" → `/compete/{slug}/my-registration`
- For teams: note about pending teammate invitations

**Props:**
```typescript
interface RegistrationConfirmationProps {
  athleteName: string
  competitionName: string
  competitionSlug: string
  competitionDate?: string      // formatted date string
  divisionName: string
  teamName?: string             // for team divisions
  pendingTeammateCount?: number // how many invites pending
  isPaid: boolean
  amountPaidFormatted?: string  // e.g., "$50.00"
}
```

**Tag:** `compete-registration-confirmed`

---

### 1.2 Competition Team Invite Email

**File:** `apps/wodsmith/src/react-email/compete/team-invite.tsx`

**Triggered by:** `inviteUserToTeamInternal()` in `src/server/team-members.ts` when `competitionContext` is provided

**Content:**
- Who invited them (captain name)
- Competition name + date
- Division + team name
- Roster status (e.g., "2 of 3 teammates confirmed")
- CTA: "Join Team" → accept invite URL
- Registration deadline (if approaching)
- Note: account creation flow if new user

**Props:**
```typescript
interface CompetitionTeamInviteProps {
  recipientEmail: string
  captainName: string
  teamName: string
  competitionName: string
  competitionSlug: string
  competitionDate?: string
  divisionName: string
  currentRosterSize: number
  maxRosterSize: number
  inviteLink: string
  registrationDeadline?: string
}
```

**Tag:** `compete-team-invite`

---

### 1.3 Payment Expired Email

**File:** `apps/wodsmith/src/react-email/compete/payment-expired.tsx`

**Triggered by:** `handleCheckoutExpired()` in `src/app/api/webhooks/stripe/route.ts`

**Content:**
- Competition name
- What happened: "Your payment session expired"
- CTA: "Complete Registration" → `/compete/{slug}/register`
- Registration deadline warning if applicable

**Props:**
```typescript
interface PaymentExpiredProps {
  athleteName: string
  competitionName: string
  competitionSlug: string
  divisionName: string
  registrationDeadline?: string
}
```

**Tag:** `compete-payment-expired`

---

### 1.4 Teammate Joined Email (to Captain)

**File:** `apps/wodsmith/src/react-email/compete/teammate-joined.tsx`

**Triggered by:** `acceptTeamInvitation()` in `src/server/team-members.ts` when accepting a competition team invite

**Content:**
- Who joined (teammate name)
- Team roster status ("3 of 3 confirmed - your team is complete!")
- CTA: "View Team" → team management page

**Props:**
```typescript
interface TeammateJoinedProps {
  captainName: string
  newTeammateName: string
  teamName: string
  competitionName: string
  competitionSlug: string
  currentRosterSize: number
  maxRosterSize: number
  isTeamComplete: boolean
}
```

**Tag:** `compete-teammate-joined`

---

## Phase 2: Notification Module

### 2.1 Create Notification Service

**File:** `apps/wodsmith/src/server/notifications/compete.ts`

```typescript
import "server-only"
import { eq } from "drizzle-orm"
import { getDb } from "@/db"
import { 
  userTable, 
  competitionsTable, 
  competitionRegistrationsTable,
  competitionTeamsTable,
  scalingLevelsTable,
} from "@/db/schema"
import { sendEmail } from "@/utils/email"
import { RegistrationConfirmationEmail } from "@/react-email/compete/registration-confirmation"
import { CompetitionTeamInviteEmail } from "@/react-email/compete/team-invite"
import { PaymentExpiredEmail } from "@/react-email/compete/payment-expired"
import { TeammateJoinedEmail } from "@/react-email/compete/teammate-joined"
import { formatDate } from "@/utils/date"

/**
 * Send registration confirmation email
 * Called after both free and paid registration completes
 */
export async function notifyRegistrationConfirmed(params: {
  userId: string
  registrationId: string
  competitionId: string
  isPaid: boolean
  amountPaidCents?: number
}): Promise<void> {
  const db = getDb()
  
  // Fetch user, competition, registration, division data
  // Build template props
  // Call sendEmail with RegistrationConfirmationEmail
}

/**
 * Send competition team invite email
 * Called when captain invites teammate during registration
 */
export async function notifyCompetitionTeamInvite(params: {
  recipientEmail: string
  inviteToken: string
  competitionTeamId: string
  competitionId: string
  invitedByUserId: string
}): Promise<void> {
  // Fetch competition, team, captain, division data
  // Build invite link
  // Call sendEmail with CompetitionTeamInviteEmail
}

/**
 * Send payment expired notification
 * Called when Stripe checkout session expires
 */
export async function notifyPaymentExpired(params: {
  userId: string
  competitionId: string
  divisionId: string
}): Promise<void> {
  // Fetch user, competition, division data
  // Call sendEmail with PaymentExpiredEmail
}

/**
 * Notify captain when teammate accepts invite
 * Called after successful team invite acceptance
 */
export async function notifyTeammateJoined(params: {
  captainUserId: string
  newTeammateUserId: string
  competitionTeamId: string
  competitionId: string
}): Promise<void> {
  // Fetch captain, new teammate, team, competition data
  // Calculate roster status
  // Call sendEmail with TeammateJoinedEmail
}
```

### 2.2 Index Export

**File:** `apps/wodsmith/src/server/notifications/index.ts`

```typescript
export {
  notifyRegistrationConfirmed,
  notifyCompetitionTeamInvite,
  notifyPaymentExpired,
  notifyTeammateJoined,
} from "./compete"
```

---

## Phase 3: Integration Points

### 3.1 Registration Confirmation

**Free Registration Path:**
- **File:** `apps/wodsmith/src/server/competitions.ts`
- **Function:** `registerForCompetition()`
- **Location:** After successful registration creation (~line 1200)
- **Code:**
```typescript
import { notifyRegistrationConfirmed } from "@/server/notifications"

// After registration is created successfully:
await notifyRegistrationConfirmed({
  userId,
  registrationId: result.registrationId,
  competitionId,
  isPaid: false,
})
```

**Paid Registration Path:**
- **File:** `apps/wodsmith/src/app/api/webhooks/stripe/route.ts`
- **Function:** `handleCheckoutCompleted()`
- **Location:** Replace TODO comment at line 245
- **Code:**
```typescript
import { notifyRegistrationConfirmed } from "@/server/notifications"

// After registration is created and payment recorded:
await notifyRegistrationConfirmed({
  userId,
  registrationId: result.registrationId,
  competitionId,
  isPaid: true,
  amountPaidCents: session.amount_total ?? undefined,
})
```

---

### 3.2 Competition Team Invite

**File:** `apps/wodsmith/src/server/team-members.ts`
**Function:** `inviteUserToTeamInternal()`
**Location:** When `competitionContext` is provided (~line 515, replace console.log)

```typescript
import { notifyCompetitionTeamInvite } from "@/server/notifications"

// When creating invitation for competition teammate:
if (competitionContext) {
  await notifyCompetitionTeamInvite({
    recipientEmail: email,
    inviteToken: invitation.token,
    competitionTeamId: competitionContext.competitionTeamId,
    competitionId: competitionContext.competitionId,
    invitedByUserId: session.userId,
  })
} else {
  // Use existing sendTeamInvitationEmail for non-competition invites
  await sendTeamInvitationEmail({ ... })
}
```

---

### 3.3 Payment Expired

**File:** `apps/wodsmith/src/app/api/webhooks/stripe/route.ts`
**Function:** `handleCheckoutExpired()`
**Location:** After marking purchase as cancelled (~line 286)

```typescript
import { notifyPaymentExpired } from "@/server/notifications"

// After cancelling purchase:
const userId = session.metadata?.userId
const competitionId = session.metadata?.competitionId
const divisionId = session.metadata?.divisionId

if (userId && competitionId && divisionId) {
  await notifyPaymentExpired({
    userId,
    competitionId,
    divisionId,
  })
}
```

---

### 3.4 Teammate Joined

**File:** `apps/wodsmith/src/server/team-members.ts`
**Function:** `acceptTeamInvitation()` 
**Location:** After successfully adding member to competition team

```typescript
import { notifyTeammateJoined } from "@/server/notifications"

// After adding to competition team:
if (competitionTeamId && captainUserId) {
  await notifyTeammateJoined({
    captainUserId,
    newTeammateUserId: userId,
    competitionTeamId,
    competitionId,
  })
}
```

---

## Phase 4: Documentation

### 4.1 Resend Setup Guide

**File:** `docs/guides/resend-email-setup.md`

```markdown
# Resend Email Setup Guide

## Overview
WODsmith uses [Resend](https://resend.com) for transactional emails.

## Setup Steps

### 1. Create Resend Account
1. Sign up at https://resend.com/signup
2. Verify your account email

### 2. Add Domain
1. Go to https://resend.com/domains
2. Click "Add Domain"
3. Enter subdomain: `mail.wodsmith.com`
4. Resend will provide DNS records to add

### 3. Configure DNS Records
Add these records to your DNS provider (Cloudflare):

| Type | Name | Value |
|------|------|-------|
| TXT | mail | v=spf1 include:... |
| TXT | resend._domainkey.mail | p=... |
| MX | send.mail | feedback-smtp.resend.com |

### 4. Verify Domain
1. Click "Verify DNS Records" in Resend dashboard
2. Wait for verification (usually < 5 minutes)

### 5. Create API Key
1. Go to https://resend.com/api-keys
2. Click "Create API Key"
3. Name: `wodsmith-production`
4. Permission: "Sending access"
5. Domain: `mail.wodsmith.com`

### 6. Add to Cloudflare Secrets
```bash
wrangler secret put RESEND_API_KEY
# Paste your API key when prompted
```

## Local Development

### Console Logging (Default)
By default, emails are logged to console in development:
```
[Email Preview] To: user@example.com
Subject: Registration Confirmed
Type: compete-registration-confirmed
```

### Send Real Emails Locally
To test actual email delivery:
1. Add to `.dev.vars`:
   ```
   EMAIL_TEST_MODE=true
   RESEND_API_KEY=re_your_api_key
   ```
2. Restart dev server
3. Emails will be sent via Resend

## Monitoring
All email events are logged to PostHog:
- `[Email] Sent successfully` - with resendId for tracking
- `[Email] Failed to send` - with error details
- `[Email] Skipped (dev mode)` - when in development

## Templates
Email templates are in `src/react-email/`:
- Run `pnpm email:dev` to preview templates at http://localhost:3001
- Templates use React Email components
```

---

## Implementation Checklist

- [x] **Phase 0.1** - Update `wrangler.jsonc` email vars — `a90f7cf` `thewodapp-zqa`
- [x] **Phase 0.1** - Update `.env.example` with email documentation — `a90f7cf` `thewodapp-acz`
- [x] **Phase 0.2** - Refactor `email.tsx` (Resend-only, add `sendEmail`, PostHog logging, test mode) — `a90f7cf` `thewodapp-t5o`
- [x] **Phase 1.1** - Create `registration-confirmation.tsx` template — `3b2c5e4` `thewodapp-cqo`
- [x] **Phase 2.1** - Create `notifications/compete.ts` with `notifyRegistrationConfirmed` — `3b2c5e4` `thewodapp-d9v`
- [x] **Phase 3.1** - Integrate in `competitions.ts` (free path) — `3b2c5e4` `thewodapp-0gm`
- [x] **Phase 3.1** - Integrate in `stripe/route.ts` (paid path) — `3b2c5e4` `thewodapp-f6e`
- [x] **Phase 1.2** - Create `compete/team-invite.tsx` template — `3b2c5e4` `thewodapp-3vw`
- [x] **Phase 2.1** - Add `notifyCompetitionTeamInvite` to notifications module — `3b2c5e4` `thewodapp-rvh`
- [x] **Phase 3.2** - Integrate in `team-members.ts` — `3b2c5e4` `thewodapp-vuh`
- [x] **Phase 1.3** - Create `payment-expired.tsx` template — `3b2c5e4` `thewodapp-geu`
- [x] **Phase 2.1** - Add `notifyPaymentExpired` to notifications module — `3b2c5e4` `thewodapp-sjv`
- [x] **Phase 3.3** - Integrate in `stripe/route.ts` checkout expired handler — `3b2c5e4` `thewodapp-b0k`
- [x] **Phase 1.4** - Create `teammate-joined.tsx` template — `3b2c5e4` `thewodapp-dho`
- [x] **Phase 2.1** - Add `notifyTeammateJoined` to notifications module — `3b2c5e4` `thewodapp-qoo`
- [x] **Phase 3.4** - Integrate in `team-members.ts` accept flow — `3b2c5e4` `thewodapp-dpm`
- [x] **Phase 4.1** - Create `resend-email-setup.md` guide — `3b2c5e4` `thewodapp-mc8`

---

## File Summary

| Action | Path |
|--------|------|
| Modify | `apps/wodsmith/wrangler.jsonc` |
| Modify | `apps/wodsmith/.env.example` |
| Modify | `apps/wodsmith/src/utils/email.tsx` |
| Create | `apps/wodsmith/src/react-email/compete/registration-confirmation.tsx` |
| Create | `apps/wodsmith/src/react-email/compete/team-invite.tsx` |
| Create | `apps/wodsmith/src/react-email/compete/payment-expired.tsx` |
| Create | `apps/wodsmith/src/react-email/compete/teammate-joined.tsx` |
| Create | `apps/wodsmith/src/server/notifications/compete.ts` |
| Create | `apps/wodsmith/src/server/notifications/index.ts` |
| Modify | `apps/wodsmith/src/server/competitions.ts` |
| Modify | `apps/wodsmith/src/server/team-members.ts` |
| Modify | `apps/wodsmith/src/app/api/webhooks/stripe/route.ts` |
| Create | `docs/guides/resend-email-setup.md` |

---

## Email Type Tags Reference

| Email | PostHog Tag |
|-------|-------------|
| Registration confirmation | `compete-registration-confirmed` |
| Competition team invite | `compete-team-invite` |
| Payment expired | `compete-payment-expired` |
| Teammate joined | `compete-teammate-joined` |

---

## Future Considerations (Deferred)

### Daily Organizer Digest
Requires Cloudflare Cron Triggers setup:
- Query registrations from last 24h
- Group by competition
- Send digest to team admins
- Would add `triggers` to `wrangler.jsonc`

### Schedule/Heat Assignment Notifications
When athlete is assigned to a heat:
- Notify with time, lane, heat number
- Consider batch/debounce for bulk assignments

### Score Adjustment Notifications
When validated score changes placement:
- Notify affected athletes
- Include old vs new placement

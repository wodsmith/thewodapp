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

## Email Templates

### Preview Templates
```bash
pnpm email:dev
```
Open http://localhost:3001 to preview templates.

### Template Locations
- Auth emails: `src/react-email/`
- Compete emails: `src/react-email/compete/`

### Available Compete Templates
| Template | File | Tag |
|----------|------|-----|
| Registration Confirmation | `compete/registration-confirmation.tsx` | `compete-registration-confirmed` |
| Team Invite | `compete/team-invite.tsx` | `compete-team-invite` |
| Payment Expired | `compete/payment-expired.tsx` | `compete-payment-expired` |
| Teammate Joined | `compete/teammate-joined.tsx` | `compete-teammate-joined` |

## Monitoring

All email events are logged to PostHog:
- `[Email] Sent successfully` - with resendId for tracking
- `[Email] Failed to send` - with error details
- `[Email] Skipped (dev mode)` - when in development

## Architecture

### Email Utility
The core email utility is in `src/utils/email.tsx`:
- `sendEmail()` - Generic email sender with PostHog logging
- Supports dev mode (console logging) and test mode (real emails)
- Never throws - email failures don't break primary actions

### Notification Service
Competition notifications are in `src/server/notifications/`:
- `notifyRegistrationConfirmed()` - After registration completes
- `notifyCompetitionTeamInvite()` - When captain invites teammate
- `notifyPaymentExpired()` - When Stripe checkout expires
- `notifyTeammateJoined()` - When teammate accepts invite

### Integration Points
- Free registration: `src/server/competitions.ts` → `registerForCompetition()`
- Paid registration: `src/app/api/webhooks/stripe/route.ts` → `handleCheckoutCompleted()`
- Payment expired: `src/app/api/webhooks/stripe/route.ts` → `handleCheckoutExpired()`
- Team invites: `src/server/team-members.ts` → `inviteUserToTeamInternal()`
- Teammate joined: `src/server/team-members.ts` → `acceptTeamInvitation()`

## Configuration

### Environment Variables (wrangler.jsonc)
```jsonc
"vars": {
  "EMAIL_FROM": "team@wodsmith.com",
  "EMAIL_FROM_NAME": "WODsmith",
  "EMAIL_REPLY_TO": "support@wodsmith.com"
}
```

### Secrets (Cloudflare)
- `RESEND_API_KEY` - Resend API key

### Development (.dev.vars)
- `EMAIL_TEST_MODE=true` - Send real emails in development
- `RESEND_API_KEY` - Required if EMAIL_TEST_MODE=true

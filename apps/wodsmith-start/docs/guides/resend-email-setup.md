# Email Setup Guide (Resend)

WODsmith uses [Resend](https://resend.com) for transactional emails. This guide covers production setup and troubleshooting.

## Production Setup Checklist

### 1. Resend Account & API Key

- [ ] Create account at [resend.com](https://resend.com)
- [ ] Get API key from [API Keys page](https://resend.com/api-keys)
- [ ] Add `RESEND_API_KEY` to GitHub repository secrets
  - Go to: Repository Settings → Secrets and variables → Actions → New repository secret
  - Name: `RESEND_API_KEY`
  - Value: Your Resend API key (starts with `re_`)

### 2. Domain Verification (Required for Production)

Resend requires domain verification to send from custom addresses like `team@mail.wodsmith.com`.

**In Resend Dashboard:**

1. Go to [Domains](https://resend.com/domains) → Add Domain
2. Add `mail.wodsmith.com` (subdomain recommended for email deliverability)
3. Get the DNS records Resend provides

**In Cloudflare DNS (or your DNS provider):**

Add these records for `mail.wodsmith.com`:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| MX | mail | `feedback-smtp.us-east-1.amazonses.com` | Auto |
| TXT | mail | `v=spf1 include:amazonses.com ~all` | Auto |
| TXT | resend._domainkey.mail | `[DKIM key from Resend]` | Auto |
| TXT | mail | `[Verification TXT from Resend]` | Auto |

**Verify in Resend:**
- Wait for DNS propagation (up to 48 hours, usually minutes)
- Click "Verify" in Resend dashboard
- Status should show "Verified" ✓

### 3. Alchemy Deployment Configuration

Ensure `alchemy.run.ts` has these bindings:

```typescript
bindings: {
  // ... other bindings ...

  // Critical: NODE_ENV must be "production" for emails to send!
  NODE_ENV: stage === "prod" || stage === "demo" ? "production" : "development",

  // Email configuration
  EMAIL_FROM: "team@mail.wodsmith.com",
  EMAIL_FROM_NAME: "WODsmith",
  EMAIL_REPLY_TO: "support@mail.wodsmith.com",

  // Resend API key (as secret)
  RESEND_API_KEY: alchemy.secret(process.env.RESEND_API_KEY!),

  // Site URL for email links
  SITE_URL: process.env.APP_URL || "https://wodsmith.com",
}
```

### 4. GitHub Actions Secrets

Required secrets for email functionality:

| Secret Name | Description | Required |
|-------------|-------------|----------|
| `RESEND_API_KEY` | Resend API key | Yes |

### 5. Verify Deployment

After deploying, check:

1. **Cloudflare Dashboard** → Workers → wodsmith-app-prod → Settings → Variables
   - Verify `NODE_ENV` = "production"
   - Verify `RESEND_API_KEY` is set (encrypted)
   - Verify `EMAIL_FROM` = "team@mail.wodsmith.com"

2. **Test email flow:**
   - Sign up with a new email
   - Trigger "Forgot Password" flow
   - Check Resend dashboard for delivery logs

---

## How Email Sending Works

### Decision Flow

```
sendEmail() called
    ↓
shouldSendEmail()?
    ↓
isProduction() OR isEmailTestMode()
    ↓
NODE_ENV === "production" OR EMAIL_TEST_MODE === "true"
    ↓
If true → Send via Resend API
If false → Log to console only (dev mode)
```

### Key Files

| File | Purpose |
|------|---------|
| `src/utils/email.tsx` | Core `sendEmail()` function and templates |
| `src/lib/env.ts` | Environment accessors (`isProduction()`, etc.) |
| `alchemy.run.ts` | Deployment bindings configuration |
| `src/react-email/*.tsx` | Email templates (React Email) |

### Email Types Supported

| Email | Tag | Trigger |
|-------|-----|---------|
| Verification | `email-verification` | Sign up |
| Password Reset | `password-reset` | Forgot password |
| Team Invitation | `team-invitation` | Invite team member |
| Competition Team Invite | `competition-team-invitation` | Captain invites teammate |
| Registration Confirmed | `compete-registration-confirmed` | Payment complete |
| Teammate Joined | `compete-teammate-joined` | Teammate accepts invite |
| Payment Expired | `compete-payment-expired` | Stripe checkout expires |
| Organizer Approved | `organizer-approval` | Admin approves request |
| Organizer Rejected | `organizer-rejection` | Admin rejects request |

---

## Local Development

### Default Behavior

In development, emails are **logged to console** but not sent:

```
[Email Preview] To: user@example.com
Subject: Verify your email for wodsmith.com
Type: email-verification

[Email] Skipped (dev mode) { recipientCount: 1, subject: '...', emailType: '...' }
```

### Send Real Emails in Dev

To test real email delivery locally:

1. Add to `.dev.vars`:
   ```
   EMAIL_TEST_MODE=true
   RESEND_API_KEY=re_your_key_here
   ```

2. Run `pnpm alchemy:dev` to deploy local dev environment with secrets

3. Start dev server: `pnpm dev`

### Preview Templates

```bash
cd apps/wodsmith-start
pnpm email:dev
```

Opens React Email preview at http://localhost:3001

---

## Troubleshooting

### Emails Not Sending in Production

**Check 1: NODE_ENV binding**
```bash
# In Cloudflare dashboard, verify NODE_ENV = "production"
# Or check alchemy.run.ts has NODE_ENV in bindings
```

**Check 2: RESEND_API_KEY secret**
```bash
# Verify in GitHub: Settings → Secrets → RESEND_API_KEY exists
# Verify in alchemy.run.ts: RESEND_API_KEY is in bindings
```

**Check 3: Domain verification**
- Go to Resend dashboard → Domains
- Ensure `mail.wodsmith.com` shows "Verified"

**Check 4: Logs**
- Check Cloudflare Worker logs for `[Email]` entries
- Successful sends log: `[Email] Sent successfully { resendId: '...' }`
- Failures log: `[Email] Failed to send { error: ... }`

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "RESEND_API_KEY not configured" | Missing secret | Add to alchemy.run.ts bindings |
| "Resend API error: 403" | Domain not verified | Complete DNS verification |
| "Resend API error: 401" | Invalid API key | Regenerate key in Resend dashboard |
| Emails logged but not sent | NODE_ENV not "production" | Add NODE_ENV binding |

### Monitoring

- **Resend Dashboard**: View all sent emails, delivery status, opens/clicks
- **Cloudflare Logs**: Search for `[Email]` to see send attempts
- **PostHog**: Email events are logged for analytics

---

## Security Notes

- API keys are stored as Alchemy secrets (encrypted at rest)
- Email addresses are masked in logs (`jo***@example.com`)
- Email failures are non-blocking (don't break primary actions)
- Tokens (password reset, verification) expire and are single-use

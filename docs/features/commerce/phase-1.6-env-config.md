## 1.6 Environment Configuration

---

### Implementation Summary (2025-01-29)

**Status**: ✅ COMPLETED

**Files Modified**:
- `.env.example` - Added STRIPE_WEBHOOK_SECRET and NEXT_PUBLIC_APP_URL
- `wrangler.jsonc` - Added NEXT_PUBLIC_APP_URL for production

**Environment Variables Added**:
- `STRIPE_WEBHOOK_SECRET` - For webhook signature verification
- `NEXT_PUBLIC_APP_URL` - For Stripe Checkout redirect URLs

**Decisions Made**:
1. STRIPE_WEBHOOK_SECRET goes in .env (secret, not in wrangler.jsonc vars)
2. NEXT_PUBLIC_APP_URL added to both .env.example and wrangler.jsonc

**Questions Exposed**:
- Secrets (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET) should be set via Cloudflare dashboard or `wrangler secret put`

---

**`.env` additions**:
```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxx  # Get from Stripe Dashboard
```

**`wrangler.jsonc` additions**:
```jsonc
{
  "vars": {
    // ... existing vars
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": "pk_test_xxxxx"
  },
  "secret": {
    // ... existing secrets
    "STRIPE_SECRET_KEY": "sk_test_xxxxx",
    "STRIPE_WEBHOOK_SECRET": "whsec_xxxxx"
  }
}
```

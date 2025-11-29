## 1.6 Environment Configuration

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

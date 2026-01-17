# Stripe Connect & Webhooks Local Setup Guide

This guide walks you through setting up Stripe Connect and webhooks for local development in wodsmith-start.

## Prerequisites

- [Stripe CLI](https://stripe.com/docs/stripe-cli) installed
- A Stripe account with access to the Dashboard
- Node.js and pnpm installed

## 1. Install Stripe CLI

### macOS (Homebrew)

```bash
brew install stripe/stripe-cli/stripe
```

### Other platforms

See [Stripe CLI installation docs](https://stripe.com/docs/stripe-cli#install).

## 2. Authenticate Stripe CLI

```bash
stripe login
```

This opens a browser window to authenticate. Follow the prompts to connect your Stripe account.

## 3. Get Your Stripe API Keys

1. Go to [Stripe Dashboard > Developers > API Keys](https://dashboard.stripe.com/test/apikeys)
2. Copy your **Test mode** keys:
   - **Publishable key** (starts with `pk_test_`)
   - **Secret key** (starts with `sk_test_`)

## 4. Set Up Stripe Connect (for Competition Payments)

Stripe Connect allows competition organizers to receive payments directly. You need to configure OAuth for the Standard account flow.

### Get Your Connect Client ID

1. Go to [Stripe Dashboard > Settings > Connect > Settings](https://dashboard.stripe.com/test/settings/connect)
2. Scroll to **Integration** section
3. Copy your **Test mode client ID** (starts with `ca_`)

### Configure OAuth Redirect URI

1. In the same Connect settings page, scroll to **Redirects**
2. Add your local development redirect URI:
   ```
   http://localhost:3000/api/stripe/connect/callback
   ```

## 5. Configure Environment Variables

Create or update your `.dev.vars` file in `apps/wodsmith-start/`:

```bash
# Copy the example file if you haven't already
cp .dev.vars.example .dev.vars
```

Add/update these values:

```bash
# Stripe API Keys (Test Mode)
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here

# Stripe Connect OAuth (for organizer payouts)
STRIPE_CLIENT_ID=ca_your_client_id_here

# Webhook secret - you'll get this from the Stripe CLI in the next step
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# App URL for OAuth redirects
APP_URL=http://localhost:3000
VITE_APP_URL=http://localhost:3000
```

## 6. Start Webhook Forwarding

The Stripe CLI forwards webhook events from Stripe to your local server.

### Start the listener

In a **separate terminal**, run:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

You'll see output like:

```
> Ready! Your webhook signing secret is whsec_abc123def456... (^C to quit)
```

**Copy the `whsec_...` value** and set it as `STRIPE_WEBHOOK_SECRET` in your `.dev.vars`:

```bash
# In apps/wodsmith-start/.dev.vars
STRIPE_WEBHOOK_SECRET=whsec_abc123def456...
```

**Important:** This secret changes each time you run `stripe listen`. You'll need to update `.dev.vars` and restart your dev server if you restart the CLI.

### Keep this terminal running

The webhook listener must stay running while you're developing. It will show all incoming webhook events.

## 7. Start the Development Server

In another terminal:

```bash
cd apps/wodsmith-start
pnpm dev
```

Your app should now be running at `http://localhost:3000`.

## 8. Test the Integration

### Test Webhooks

Trigger a test event to verify webhooks are working:

```bash
stripe trigger checkout.session.completed
```

You should see:

1. The event in your Stripe CLI terminal
2. Log output in your dev server terminal

### Test Stripe Connect

1. Navigate to a competition organizer settings page
2. Click to connect a Stripe account
3. You'll be redirected to Stripe's OAuth flow
4. Complete the test account connection
5. You should be redirected back to your app with `?stripe_connected=true`

## Webhook Events Handled

The webhook handler at `/api/webhooks/stripe` processes these events:

| Event                              | Description                                  |
| ---------------------------------- | -------------------------------------------- |
| `checkout.session.completed`       | Payment successful - creates registration    |
| `checkout.session.expired`         | Payment abandoned - marks purchase cancelled |
| `account.updated`                  | Connect account status changed               |
| `account.application.authorized`   | OAuth connection confirmed                   |
| `account.application.deauthorized` | Account disconnected                         |

## Troubleshooting

### "Missing STRIPE_SECRET_KEY environment variable"

Make sure your `.dev.vars` file exists and contains `STRIPE_SECRET_KEY`.

### "Invalid signature" on webhooks

1. Ensure `STRIPE_WEBHOOK_SECRET` in `.dev.vars` matches the secret from `stripe listen`
2. Restart your dev server after updating `.dev.vars`
3. Make sure the webhook listener is running

### OAuth redirect fails

1. Verify `APP_URL=http://localhost:3000` in `.dev.vars`
2. Check that `http://localhost:3000/api/stripe/connect/callback` is in your Stripe Connect redirect URIs
3. Ensure `STRIPE_CLIENT_ID` is set correctly

### "CSRF token mismatch" on OAuth callback

This happens if:

- The OAuth flow took too long (>10 minutes)
- Cookies aren't being set properly
- You're using a different browser/incognito window

Try starting the OAuth flow again from the beginning.

### Webhook events not showing up

1. Check the Stripe CLI terminal for errors
2. Verify the forward URL matches your dev server port
3. Check your dev server logs for incoming requests

## Testing with Stripe Test Cards

Use these test card numbers for payments:

| Card Number           | Description                       |
| --------------------- | --------------------------------- |
| `4242 4242 4242 4242` | Successful payment                |
| `4000 0000 0000 3220` | 3D Secure authentication required |
| `4000 0000 0000 9995` | Payment declined                  |

Use any future expiration date and any 3-digit CVC.

## Connect Test Accounts

When testing Stripe Connect OAuth:

- Use the "Skip this form" option in test mode to quickly create test connected accounts
- Test accounts have limited functionality but work for development

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Browser       │────▶│  localhost:3000  │────▶│  Stripe API     │
│                 │     │  (TanStack Start)│     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                 ▲
                                 │ Webhooks
                                 │
                        ┌────────┴────────┐
                        │   Stripe CLI    │
                        │ (stripe listen) │
                        └─────────────────┘
```

## File Reference

| File                                        | Purpose                      |
| ------------------------------------------- | ---------------------------- |
| `src/lib/stripe.ts`                         | Stripe client initialization |
| `src/routes/api/webhooks/stripe.ts`         | Webhook handler              |
| `src/routes/api/stripe/connect/callback.ts` | OAuth callback handler       |
| `src/server-fns/stripe-connect-fns.ts`      | Connect server functions     |
| `.dev.vars`                                 | Local environment variables  |

## Quick Start Checklist

- [ ] Install Stripe CLI (`brew install stripe/stripe-cli/stripe`)
- [ ] Run `stripe login` and authenticate
- [ ] Copy API keys from Stripe Dashboard
- [ ] Copy Connect Client ID from Stripe Dashboard
- [ ] Add redirect URI to Stripe Connect settings
- [ ] Create `.dev.vars` with all required variables
- [ ] Run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
- [ ] Copy webhook secret to `.dev.vars`
- [ ] Run `pnpm dev`
- [ ] Test with `stripe trigger checkout.session.completed`

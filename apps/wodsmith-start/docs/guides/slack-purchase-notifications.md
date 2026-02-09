# Slack Purchase Notifications Setup

This guide explains how to set up Slack notifications for purchases on WODsmith. When enabled, you'll receive real-time notifications in your Slack channel whenever someone makes a purchase.

## Overview

The Slack notification system supports different types of purchases:

| Purchase Type | Description |
| --------------- | ------------- |
| `COMPETITION_REGISTRATION` | Competition registration payments |
| `ADDON` | Add-on purchases |
| `CREDITS` | Credit purchases |
| `SUBSCRIPTION` | Subscription payments |

## Setup Steps

### 1. Create a Slack App with Incoming Webhooks

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click **Create New App** → **From scratch**
3. Name your app (e.g., "WODsmith Notifications") and select your workspace
4. In the left sidebar, click **Incoming Webhooks**
5. Toggle **Activate Incoming Webhooks** to On
6. Click **Add New Webhook to Workspace**
7. Select the channel you want notifications sent to (e.g., `#ding-ding`)
8. Click **Allow**
9. Copy the **Webhook URL** (it will start with `https://hooks.slack.com/services/`)

### 2. Configure Environment Variables

Add the following environment variables to your `.dev.vars` file (for local development) or your production environment:

```bash
# Required: The Slack webhook URL for your notification channel
SLACK_WEBHOOK_URL=<your-slack-webhook-url>

# Required: Enable/disable notifications (set to "true" to enable)
SLACK_PURCHASE_NOTIFICATIONS_ENABLED=true

# Optional: Comma-separated list of purchase types to notify on
# If not set, all purchase types will trigger notifications
# Valid types: COMPETITION_REGISTRATION, ADDON, CREDITS, SUBSCRIPTION
SLACK_PURCHASE_NOTIFICATION_TYPES=COMPETITION_REGISTRATION,ADDON
```

### 3. Deploy Configuration

For local development:
```bash
# After updating .dev.vars, redeploy with Alchemy
pnpm alchemy:dev
```

For production:
Add the environment variables to your Cloudflare Worker secrets via the dashboard or wrangler CLI:
```bash
wrangler secret put SLACK_WEBHOOK_URL
wrangler secret put SLACK_PURCHASE_NOTIFICATIONS_ENABLED
wrangler secret put SLACK_PURCHASE_NOTIFICATION_TYPES
```

Or add them to your `alchemy.run.ts` deployment configuration.

## Notification Format

Notifications appear in Slack with the following format:

```text
:trophy: New Competition Registration: $75.00

Customer:          Amount:
John Smith         $75.00
john@example.com

Competition:       Division:
Summer Throwdown   Individual RX

Purchase ID: `pur_abc123xyz`
```

Each purchase type has its own emoji:
- :trophy: Competition Registration
- :package: Add-on
- :coin: Credits
- :star: Subscription

## Configuration Options

### Enable/Disable Notifications

Set `SLACK_PURCHASE_NOTIFICATIONS_ENABLED` to `true` or `false`:

```bash
# Enable notifications
SLACK_PURCHASE_NOTIFICATIONS_ENABLED=true

# Disable notifications
SLACK_PURCHASE_NOTIFICATIONS_ENABLED=false
```

### Filter by Purchase Type

Use `SLACK_PURCHASE_NOTIFICATION_TYPES` to receive notifications only for specific purchase types:

```bash
# Only competition registrations
SLACK_PURCHASE_NOTIFICATION_TYPES=COMPETITION_REGISTRATION

# Competition registrations and add-ons
SLACK_PURCHASE_NOTIFICATION_TYPES=COMPETITION_REGISTRATION,ADDON

# All types (default if not set)
# SLACK_PURCHASE_NOTIFICATION_TYPES=COMPETITION_REGISTRATION,ADDON,CREDITS,SUBSCRIPTION
```

## Troubleshooting

### Notifications not appearing

1. **Check if enabled**: Verify `SLACK_PURCHASE_NOTIFICATIONS_ENABLED=true` is set
2. **Check webhook URL**: Ensure `SLACK_WEBHOOK_URL` is correctly set and the webhook is active
3. **Check purchase type**: If using `SLACK_PURCHASE_NOTIFICATION_TYPES`, ensure your purchase type is included
4. **Check logs**: Look for `[Slack]` log entries in your application logs

### Testing the Integration

To test the Slack integration:

1. Make a test purchase in your development environment
2. Check your Slack channel for the notification
3. Review application logs for any error messages

### Common Issues

| Issue | Solution |
| ------- | ---------- |
| "No webhook URL configured" | Set `SLACK_WEBHOOK_URL` environment variable |
| "Purchase notifications disabled" | Set `SLACK_PURCHASE_NOTIFICATIONS_ENABLED=true` |
| "Purchase type not enabled" | Add the purchase type to `SLACK_PURCHASE_NOTIFICATION_TYPES` |
| HTTP errors from Slack | Verify webhook URL is valid and app is still installed |

## Security Considerations

- **Keep your webhook URL secret**: Treat the Slack webhook URL like a password. Anyone with the URL can post to your channel.
- **Use environment variables**: Never commit webhook URLs to source control.
- **Rotate webhooks periodically**: If you suspect the URL has been exposed, regenerate it in Slack and update your configuration.

## Extending the Integration

### Adding New Purchase Types

To add notifications for a new purchase type:

1. Add the type to `SLACK_PURCHASE_TYPES` in `src/lib/slack.ts`
2. Create a convenience function (optional) following the pattern of existing functions
3. Call `sendPurchaseNotification()` from the relevant handler

### Customizing Notification Content

The notification format is defined in `buildPurchaseMessage()` in `src/lib/slack.ts`. You can modify:

- Message blocks structure
- Fields displayed
- Emojis per purchase type
- Additional metadata

## Files Reference

| File | Purpose |
| ------ | --------- |
| `src/lib/slack.ts` | Slack notification utility functions |
| `src/lib/env.ts` | Environment variable accessors |
| `src/routes/api/webhooks/stripe.ts` | Stripe webhook handler (sends notifications) |
| `.dev.vars.example` | Example environment configuration |

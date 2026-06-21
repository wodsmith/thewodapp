# Crew Paid Launch Ops Runbook

This runbook keeps the first paid Crew launches operator-led while preserving the event-level billing model.

## Launch Posture

- Default sales path: manual paid grant or manually reconciled Stripe Payment Link sale.
- Self-serve Checkout path: disabled unless `CREW_STRIPE_CHECKOUT_ENABLED` is explicitly enabled.
- Billing scope: Crew paid state belongs to the selected event's `crew_event_settings` row and append-only `crew_billing_events` audit rows.
- Team subscription scope: do not set, clear, or reinterpret `teams.currentPlanId` for a one-event Crew purchase.
- Private data scope: founder pricing, invoices, internal notes, raw Stripe references, and reconciliation metadata stay server-only or local-operator-only.

## Preflight Checklist

- Confirm the organizer team and Crew event are the intended production records.
- Confirm the desired Crew catalog plan is event-level: `crew_starter`, `crew_basic`, `crew_pro`, `crew_concierge`, or `crew_founding_2026`.
- Confirm the sale path is manual, Payment Link reconciliation, founder/private grant, comp, refund, or Checkout.
- Confirm no route or script in the planned operation updates team subscription billing.
- Confirm the operator can read back event billing status on the private Crew billing page.
- Confirm `CREW_STRIPE_CHECKOUT_ENABLED` is unset or false unless the explicit Checkout launch decision has been made.

## Manual Paid And Founder Grants

Use the private operator action for paid launch grants that do not depend on Stripe automation.

1. Select the Crew event and organizing team from server-side event context.
2. Record the Crew plan, amount, currency, actor label, and public note.
3. Put invoice IDs, founder approvals, private prices, and internal reconciliation notes in private metadata only.
4. Verify the resulting audit event is appended before the event settings patch is applied.
5. Verify the event settings patch contains Crew billing fields only and does not include `currentPlanId`.

Founder grants should use `crew_founding_2026`. Concierge sales should use `crew_concierge`. Neither should be exposed as public Checkout choices.

## Payment Link Reconciliation

Payment Links are a manual fallback, not a live Stripe API dependency.

1. Store only organizer-safe Payment Link URLs in event settings.
2. Reconcile from operator-provided event ID, organizing team ID, Crew plan, amount, and currency.
3. Use Stripe Payment Link or Payment Intent references when available.
4. If Stripe metadata is missing, reconcile with the stable manual idempotency key for the event, team, plan, amount, and currency.
5. Verify duplicate reconciliation attempts skip by idempotency key and do not patch billing state again.

## Refund And Credit Policy

Refunds record the refunded amount and move the Crew event to a refunded fulfillment state. They do not delete prior audit history.

Full-platform upgrade credit is single-use per Crew event. Set it once, apply it once, and keep the credit reason in private metadata when it references founder, invoice, or concierge terms.

After a refund or credit operation:

- Verify the private billing page shows refund or credit labels.
- Verify Crew access gates reflect the terminal state.
- Verify no team subscription plan was changed as a side effect.

## Checkout Flag Readiness

Before enabling `CREW_STRIPE_CHECKOUT_ENABLED`:

- Confirm the billing page still hides Checkout when the flag is false.
- Confirm Checkout plan choices are public paid plans only.
- Confirm Checkout metadata excludes founder/private pricing, invoices, and audit notes.
- Confirm webhook completion requires matching pending event billing state, Checkout Session ID, plan, amount, currency, and idempotency metadata.
- Confirm non-Crew registration Checkout Sessions still route through the existing athlete registration workflow.

## No-Live-Stripe Validation

Use focused helper tests before any production operation:

```bash
pnpm --filter crew test -- src/lib/crew/billing-state.test.ts src/lib/crew/billing-page.test.ts src/lib/crew/payment-link-sales.test.ts src/lib/crew/checkout-sessions.test.ts src/lib/crew/checkout-webhooks.test.ts
pnpm --filter crew type-check
pnpm --filter crew lint
pnpm dlx lat.md locate 'crew#Paid Launch Ops Hardening'
git diff --check
```

Only run live Stripe checks after the Checkout flag decision is made and the target environment is explicitly approved.

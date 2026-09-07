# Billing Invoices

Billing groups a user's purchases by checkout session while preserving recorded monetary values and showing the state of every grouped purchase.

## Group Identity and Ordering

Only a shared Stripe Checkout Session creates an invoice group. Purchases without a session remain separate even if they share a payment intent.

[[apps/wodsmith-start/src/utils/invoice-groups.ts#groupByInvoice]] sorts purchases newest-first with an ID tie-breaker before grouping. Group IDs distinguish session keys from purchase IDs. This makes row order, representative links, and item order independent of database input order without mutating the input.

## Status Policy

An invoice retains a status only when all purchases agree. Any combination of different statuses is explicitly “Mixed status,” with constituent states visible.

[[apps/wodsmith-start/src/utils/invoice-groups.ts#getInvoiceStatus]] applies this policy in both the list grouping and [[apps/wodsmith-start/src/server/commerce/purchases.ts#getInvoiceDetails]]. The list summarizes counts by state; the detail page and PDF expose per-item statuses for mixed groups. Homogeneous completed groups display Paid. Refunded and unknown states are preserved rather than coerced to paid or failed.

## Monetary and Provider Boundaries

Invoice totals remain the sum of recorded gross purchase cents. Status aggregation never subtracts or estimates refunds, fees, or discounts.

The current purchase model and invoice formatting use USD cents; they do not store per-purchase currency or refunded amounts. Failed purchase state alone does not prove a refund amount. Supporting net-refund accounting or multiple currencies requires separate authoritative data, not inference in a presentation helper.

Checkout-session and payment-intent references retain their existing meanings; these locally generated invoice IDs are purchase IDs, not Stripe invoice IDs. Coupon lookup, once-per-transaction discount handling, payment-method lookup, and provider receipt URLs remain unchanged.

## Ownership and Verification

Invoice detail loads the requested purchase and any checkout siblings with the authenticated user ID. Status grouping does not broaden the read boundary.

[[billing-group-tests#Billing Group Tests]] covers status permutations, stable grouping, monetary preservation, provider behavior, owner-scoped queries, and list/detail/PDF visibility.

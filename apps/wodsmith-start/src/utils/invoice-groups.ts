/** A homogeneous invoice keeps its state; different states must remain visible. */
export function getInvoiceStatus(
  purchases: ReadonlyArray<{ status: string }>,
): string {
  const statuses = new Set(purchases.map((purchase) => purchase.status))
  if (statuses.size === 0) return "UNKNOWN"
  if (statuses.size > 1) return "MIXED"
  return purchases[0].status
}

export function getInvoiceStatusLabel(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "Paid"
    case "PENDING":
      return "Pending"
    case "FAILED":
      return "Failed"
    case "CANCELLED":
      return "Cancelled"
    case "REFUNDED":
      return "Refunded"
    case "PARTIALLY_REFUNDED":
      return "Partially refunded"
    case "MIXED":
      return "Mixed status"
    default:
      return status
  }
}

type InvoicePurchase = {
  id: string
  status: string
  totalCents: number
  stripeCheckoutSessionId: string | null
  createdAt: Date
}

/** Group only shared checkout sessions; missing sessions remain separate purchases. */
export function groupByInvoice<T extends InvoicePurchase>(
  purchases: readonly T[],
) {
  const groups = new Map<string, T[]>()
  // Newest first, with a deterministic ID tie-breaker for stable links and groups.
  const sorted = [...purchases].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
      a.id.localeCompare(b.id),
  )
  for (const purchase of sorted) {
    const key = purchase.stripeCheckoutSessionId
      ? `checkout:${purchase.stripeCheckoutSessionId}`
      : `purchase:${purchase.id}`
    const group = groups.get(key)
    if (group) group.push(purchase)
    else groups.set(key, [purchase])
  }
  return [...groups.entries()].map(([id, items]) => ({
    id,
    primary: items[0],
    purchases: items,
    // These are recorded gross amounts, never inferred settled or net-refund amounts.
    totalCents: items.reduce((sum, purchase) => sum + purchase.totalCents, 0),
    status: getInvoiceStatus(items),
    statusSummary: [...new Set(items.map((purchase) => purchase.status))]
      .sort()
      .map(
        (status) =>
          `${items.filter((purchase) => purchase.status === status).length} ${getInvoiceStatusLabel(status)}`,
      )
      .join(" · "),
  }))
}

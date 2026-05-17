"use client"

import { RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface RefundStatusBadgeProps {
  refundedCents: number
  totalCents: number
  className?: string
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * Badge surfacing the refund state of a registration row.
 *
 * - No refund recorded → renders nothing (caller doesn't have to gate)
 * - Full refund (refundedCents >= totalCents) → solid red "Refunded"
 * - Partial refund → orange "Partially refunded ($X.XX)" so organizers see
 *   the refunded amount without drilling into the purchase
 */
export function RefundStatusBadge({
  refundedCents,
  totalCents,
  className,
}: RefundStatusBadgeProps) {
  if (refundedCents <= 0) return null

  const isFull = refundedCents >= totalCents

  if (isFull) {
    return (
      <Badge variant="destructive" className={`text-xs ${className ?? ""}`}>
        <RotateCcw className="h-3 w-3 mr-1" />
        Refunded
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className={`text-xs bg-orange-50 text-orange-700 border-orange-300 ${className ?? ""}`}
    >
      <RotateCcw className="h-3 w-3 mr-1" />
      Partially refunded ({formatCents(refundedCents)})
    </Badge>
  )
}

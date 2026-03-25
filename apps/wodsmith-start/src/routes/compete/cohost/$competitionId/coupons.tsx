/**
 * Cohost Competition Coupons Route
 *
 * Allows cohosts to create and manage discount coupons for their competition.
 * Gated by coupons permission.
 * Uses cohost coupon server fns for auth.
 */

import { createFileRoute, getRouteApi, redirect } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Ban, Copy, Plus, Tag } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getAppUrlFn } from "@/lib/env"
import {
  cohostListCouponsFn,
  cohostCreateCouponFn,
  cohostDeactivateCouponFn,
} from "@/server-fns/cohost/cohost-coupon-fns"

const parentRoute = getRouteApi("/compete/cohost/$competitionId")

export const Route = createFileRoute(
  "/compete/cohost/$competitionId/coupons",
)({
  component: CouponsPage,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition, permissions } = parentMatch.loaderData!

    // Permission gate: coupons
    if (!permissions?.coupons) {
      throw redirect({
        to: "/compete/cohost/$competitionId",
        params: { competitionId: params.competitionId },
      })
    }

    const competitionTeamId = competition.competitionTeamId!

    const [appUrl, coupons] = await Promise.all([
      getAppUrlFn(),
      cohostListCouponsFn({
        data: {
          competitionId: competition.id,
          competitionTeamId,
        },
      }),
    ])

    return { competition, coupons, appUrl, competitionTeamId }
  },
})

type Coupon = Awaited<ReturnType<typeof cohostListCouponsFn>>[number]

function getCouponStatus(
  coupon: Coupon,
): "active" | "expired" | "maxed" | "inactive" {
  if (!coupon.isActive) return "inactive"
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date())
    return "expired"
  if (
    coupon.maxRedemptions !== null &&
    coupon.maxRedemptions !== undefined &&
    coupon.currentRedemptions >= coupon.maxRedemptions
  )
    return "maxed"
  return "active"
}

function StatusBadge({
  status,
}: {
  status: ReturnType<typeof getCouponStatus>
}) {
  if (status === "active")
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        Active
      </Badge>
    )
  if (status === "expired")
    return (
      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
        Expired
      </Badge>
    )
  if (status === "maxed")
    return (
      <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
        Maxed
      </Badge>
    )
  return <Badge variant="secondary">Inactive</Badge>
}

function CouponsPage() {
  const { competition, coupons: initialCoupons, appUrl, competitionTeamId } =
    Route.useLoaderData()

  const competitionId = competition.id
  const slug = competition.slug

  const [coupons, setCoupons] = useState<Coupon[]>(initialCoupons)
  const [isCreating, setIsCreating] = useState(false)
  const [amountDollars, setAmountDollars] = useState("")
  const [codeOverride, setCodeOverride] = useState("")
  const [maxRedemptions, setMaxRedemptions] = useState("")
  const [expiresAt, setExpiresAt] = useState("")

  const createCoupon = useServerFn(cohostCreateCouponFn)
  const deactivate = useServerFn(cohostDeactivateCouponFn)

  useEffect(() => {
    setCoupons(initialCoupons)
  }, [initialCoupons])

  async function refreshCoupons() {
    const updated = await cohostListCouponsFn({
      data: { competitionId, competitionTeamId },
    })
    setCoupons(updated)
  }

  async function handleCreate() {
    const amountCents = Math.round(parseFloat(amountDollars) * 100)
    if (isNaN(amountCents) || amountCents <= 0) {
      toast.error("Enter a valid amount")
      return
    }

    setIsCreating(true)
    try {
      await createCoupon({
        data: {
          competitionId,
          competitionTeamId,
          amountOffCents: amountCents,
          code: codeOverride.trim() || undefined,
          maxRedemptions: maxRedemptions
            ? parseInt(maxRedemptions, 10)
            : undefined,
          expiresAt: expiresAt
            ? new Date(`${expiresAt}T23:59:59`).toISOString()
            : undefined,
        },
      })
      toast.success("Coupon created")
      setAmountDollars("")
      setCodeOverride("")
      setMaxRedemptions("")
      setExpiresAt("")
      await refreshCoupons()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create coupon",
      )
    } finally {
      setIsCreating(false)
    }
  }

  async function handleDeactivate(couponId: string) {
    try {
      await deactivate({ data: { couponId, competitionTeamId } })
      toast.success("Coupon deactivated")
      await refreshCoupons()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to deactivate coupon",
      )
    }
  }

  function handleCopyLink(code: string) {
    const url = `${appUrl}/compete/${slug}?coupon=${encodeURIComponent(code)}`
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Coupon link copied to clipboard")
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Coupons</h2>
        <p className="text-sm text-muted-foreground">
          Create and manage discount coupons for {competition.name}
        </p>
      </div>

      {/* Create Coupon Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" />
            Create Coupon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="amount">Amount Off ($)</Label>
              <Input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="10.00"
                value={amountDollars}
                onChange={(e) => setAmountDollars(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="code">
                Code <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="code"
                placeholder="Auto-generated"
                value={codeOverride}
                onChange={(e) => setCodeOverride(e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="maxRedemptions">
                Max Uses{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="maxRedemptions"
                type="number"
                min="1"
                step="1"
                placeholder="Unlimited"
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="expiresAt">
                Expires{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="expiresAt"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
          <Button
            className="mt-4"
            onClick={handleCreate}
            disabled={isCreating || !amountDollars}
          >
            <Plus className="mr-2 h-4 w-4" />
            {isCreating ? "Creating..." : "Create Coupon"}
          </Button>
        </CardContent>
      </Card>

      {/* Coupons Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="h-4 w-4" />
            Coupons ({coupons.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {coupons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Tag className="mb-2 h-8 w-8 opacity-40" />
              <p className="text-sm">No coupons yet</p>
              <p className="text-xs">Create a coupon above to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Amount Off</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((coupon) => {
                    const status = getCouponStatus(coupon)
                    return (
                      <TableRow key={coupon.id}>
                        <TableCell className="font-mono font-medium">
                          {coupon.code}
                        </TableCell>
                        <TableCell>
                          ${(coupon.amountOffCents / 100).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {coupon.currentRedemptions}/
                          {coupon.maxRedemptions ?? "\u221E"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={status} />
                        </TableCell>
                        <TableCell>
                          {coupon.expiresAt
                            ? new Date(coupon.expiresAt).toLocaleDateString()
                            : "Never"}
                        </TableCell>
                        <TableCell>
                          {new Date(coupon.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopyLink(coupon.code)}
                            >
                              <Copy className="mr-1 h-3 w-3" />
                              Copy Link
                            </Button>
                            {status === "active" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeactivate(coupon.id)}
                              >
                                <Ban className="mr-1 h-3 w-3" />
                                Deactivate
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

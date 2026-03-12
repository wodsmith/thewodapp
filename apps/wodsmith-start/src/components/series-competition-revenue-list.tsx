"use client"

import { DollarSign, Download, TrendingUp, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { SeriesRevenueStats } from "@/server-fns/commerce-fns"

interface SeriesRevenueSummaryProps {
  stats: SeriesRevenueStats
  onExportCsv: () => void
  isExporting?: boolean
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })
}

export function SeriesRevenueSummary({
  stats,
  onExportCsv,
  isExporting = false,
}: SeriesRevenueSummaryProps) {
  if (stats.totalPurchaseCount === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gross Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCents(stats.totalGrossCents)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total collected from athletes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCents(stats.totalOrganizerNetCents)}
            </div>
            <p className="text-xs text-muted-foreground">After all fees</p>
          </CardContent>
        </Card>

        <Card className="col-span-2 sm:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Paid Registrations
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPurchaseCount}</div>
            <p className="text-xs text-muted-foreground">Across all events</p>
          </CardContent>
        </Card>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onExportCsv}
        disabled={isExporting}
        className="self-start"
      >
        <Download className="h-4 w-4" />
        {isExporting ? "Exporting..." : "Export CSV"}
      </Button>
    </div>
  )
}

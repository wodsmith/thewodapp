import { createFileRoute, Link } from "@tanstack/react-router"
import { ChevronRight, FileText, Receipt } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { getAthleteInvoicesDataFn } from "@/server-fns/athlete-profile-fns"
import { getInvoiceStatusLabel, groupByInvoice } from "@/utils/invoice-groups"

export const Route = createFileRoute("/_protected/settings/billing/")({
  component: SettingsBillingPage,
  loader: async () => {
    return await getAthleteInvoicesDataFn()
  },
})

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100)
}

function formatDate(date: Date | null): string {
  if (!date) return "-"
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date))
}

function getStatusBadge(status: string) {
  switch (status) {
    case "COMPLETED":
      return <Badge variant="default">Paid</Badge>
    case "PENDING":
      return <Badge variant="secondary">Pending</Badge>
    case "FAILED":
      return <Badge variant="destructive">Failed</Badge>
    case "CANCELLED":
      return <Badge variant="outline">Cancelled</Badge>
    default:
      return <Badge variant="outline">{getInvoiceStatusLabel(status)}</Badge>
  }
}

function SettingsBillingPage() {
  const { purchases } = Route.useLoaderData()
  const invoices = groupByInvoice(purchases)

  return (
    <div className="space-y-6 pb-12">
      {/* Page header */}
      <div>
        <div className="text-xs font-bold tracking-[0.18em] uppercase text-primary mb-1.5">
          Billing
        </div>
        <h1 className="text-3xl font-mono font-bold tracking-tight">
          Billing &amp; invoices
        </h1>
        <p className="text-muted-foreground mt-1.5 max-w-2xl">
          Receipts for every comp registration & gym subscription.
        </p>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">No invoices yet</p>
            <p className="text-muted-foreground text-sm">
              When you register for competitions, your invoices will appear
              here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map(
            ({ id, primary: purchase, totalCents, status, statusSummary }) => (
              <Link
                key={id}
                to="/settings/billing/$purchaseId"
                params={{ purchaseId: purchase.id }}
              >
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Receipt className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {purchase.competition?.name ?? purchase.product.name}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {formatDate(
                            purchase.completedAt ?? purchase.createdAt,
                          )}
                          {purchase.competition?.organizingTeam && (
                            <span>
                              {" "}
                              &middot;{" "}
                              {purchase.competition.organizingTeam.name}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        {getStatusBadge(status)}
                        {status === "MIXED" && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {statusSummary}
                          </p>
                        )}
                      </div>
                      <span className="font-medium">
                        {formatCurrency(totalCents)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ),
          )}
        </div>
      )}
    </div>
  )
}

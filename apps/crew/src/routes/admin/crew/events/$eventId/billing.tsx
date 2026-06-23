// @lat: [[crew#Crew Admin Shell]]
// @lat: [[crew#Billing Page And Upgrade CTA]]
import { createFileRoute } from "@tanstack/react-router"
import { CreditCard, ExternalLink } from "lucide-react"
import type { ReactNode } from "react"
import type { CrewBillingActionViewModel } from "@/lib/crew/billing-page"
import {
  type CrewAdminBillingData,
  getCrewAdminBillingFn,
} from "@/server-fns/crew-admin-event-fns"

export const Route = createFileRoute("/admin/crew/events/$eventId/billing")({
  loader: async ({ params }) =>
    await getCrewAdminBillingFn({ data: { eventId: params.eventId } }),
  component: CrewAdminBillingPage,
})

function CrewAdminBillingPage() {
  const { event, billing, auditEvents, viewModel } =
    Route.useLoaderData() as CrewAdminBillingData

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <BillingMetric label="Plan" value={viewModel.plan.label} />
        <BillingMetric
          label="Billing status"
          value={viewModel.billing.stateLabel}
        />
        <BillingMetric label="Source" value={viewModel.billing.sourceLabel} />
        <BillingMetric
          label="Upgrade credit"
          value={viewModel.billing.upgradeCreditLabel}
        />
      </div>

      <section className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="rounded-md border bg-card p-5 shadow-sm">
          <h3 className="text-xl font-semibold">Event billing</h3>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <BillingFact label="Event" value={event.name} />
            <BillingFact label="Event ID" value={event.id} mono />
            <BillingFact
              label="Event access"
              value={
                viewModel.plan.hasCrewEventAccess ? "Active" : "Not active yet"
              }
            />
            <BillingFact
              label="Fulfillment"
              value={viewModel.billing.fulfillmentLabel}
            />
            <BillingFact label="Amount" value={viewModel.billing.amountLabel} />
            <BillingFact
              label="Refund state"
              value={viewModel.billing.refundedLabel}
            />
            <BillingFact
              label="Payment Link ID"
              value={billing.stripe.paymentLinkId ?? "Not recorded"}
              mono
            />
            <BillingFact
              label="Checkout Session ID"
              value={billing.stripe.checkoutSessionId ?? "Not recorded"}
              mono
            />
            <BillingFact
              label="Payment Intent ID"
              value={billing.stripe.paymentIntentId ?? "Not recorded"}
              mono
            />
            <BillingFact
              label="Organizer team"
              value={event.organizingTeamId}
              mono
            />
          </dl>
        </div>

        <aside className="rounded-md border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">
            Operator actions
          </h3>
          <div className="mt-4 flex flex-col gap-2">
            <BillingAction action={viewModel.paymentLink} />
            <BillingAction action={viewModel.checkout} />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Mutating admin billing actions remain in the existing billing
            service layer; this PR exposes the guarded admin read surface.
          </p>
        </aside>
      </section>

      <section className="rounded-md border bg-card p-5 shadow-sm">
        <h3 className="text-xl font-semibold">Billing audit</h3>
        {auditEvents.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No billing audit events recorded yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Created</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">State</th>
                  <th className="py-2 pr-4 font-medium">Plan</th>
                  <th className="py-2 pr-4 font-medium">Actor</th>
                </tr>
              </thead>
              <tbody>
                {auditEvents.map((event) => (
                  <tr key={event.id} className="border-b last:border-b-0">
                    <td className="py-3 pr-4 text-muted-foreground">
                      {String(event.createdAt)}
                    </td>
                    <td className="py-3 pr-4 font-medium">{event.eventType}</td>
                    <td className="py-3 pr-4">{event.billingState}</td>
                    <td className="py-3 pr-4">
                      {event.planId ?? "Not recorded"}
                    </td>
                    <td className="py-3 pr-4">
                      {event.actorLabel ?? "System"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}

function BillingMetric({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-md border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-lg font-semibold">{value}</p>
    </section>
  )
}

function BillingFact({
  label,
  value,
  mono = false,
}: {
  label: string
  value: ReactNode
  mono?: boolean
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={`break-words font-medium ${mono ? "break-all font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
  )
}

function BillingAction({ action }: { action: CrewBillingActionViewModel }) {
  if (action.status === "hidden") {
    return null
  }

  if (action.status === "available" && action.href) {
    return (
      <a
        href={action.href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        title={action.helperText}
      >
        <CreditCard className="size-4" aria-hidden="true" />
        {action.label}
        <ExternalLink className="size-4" aria-hidden="true" />
      </a>
    )
  }

  return (
    <button
      type="button"
      disabled
      className="inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground"
      title={action.helperText}
    >
      <CreditCard className="size-4" aria-hidden="true" />
      {action.label}
    </button>
  )
}

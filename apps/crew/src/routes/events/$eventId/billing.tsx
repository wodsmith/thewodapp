// @lat: [[crew#Billing Page And Upgrade CTA]]
import { createFileRoute } from "@tanstack/react-router"
import {
  CreditCard,
  ExternalLink,
  LockKeyhole,
  WalletCards,
} from "lucide-react"
import type { ReactNode } from "react"
import type { CrewBillingActionViewModel } from "@/lib/crew/billing-page"
import { getCrewBillingOrganizerPageFn } from "@/server-fns/crew-billing-fns"

export const Route = createFileRoute("/events/$eventId/billing")({
  loader: async ({ params }) =>
    await getCrewBillingOrganizerPageFn({
      data: { eventId: params.eventId },
    }),
  component: EventBillingPage,
})

function EventBillingPage() {
  const { event, viewModel } = Route.useLoaderData()

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

      {viewModel.upgradeCta.visible ? (
        <section className="rounded-md border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <WalletCards className="size-4" aria-hidden="true" />
                Crew upgrade
              </div>
              <h2 className="text-xl font-semibold">
                {viewModel.upgradeCta.title}
              </h2>
              <p className="max-w-3xl text-sm text-muted-foreground">
                {viewModel.upgradeCta.description}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto">
              <BillingAction action={viewModel.paymentLink} />
              <BillingAction action={viewModel.checkout} />
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="rounded-md border bg-card p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Event billing</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <BillingFact label="Event" value={event.name} />
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
              label="Access reason"
              value={viewModel.plan.accessReason}
            />
          </dl>
        </div>

        <aside className="rounded-md border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <LockKeyhole className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">
              Private page
            </h2>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Billing reads are scoped to the event organizer team. Stripe
            references, invoices, audit rows, and internal notes stay off this
            page.
          </p>
        </aside>
      </section>
    </section>
  )
}

function BillingMetric({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-md border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </section>
  )
}

function BillingFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{value}</dd>
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

// @lat: [[crew#Billing Page And Upgrade CTA]]
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  createCrewCheckoutSessionFn,
  getCrewBillingOrganizerPageFn,
} from "@/server-fns/crew-billing-fns"

export const Route = createFileRoute("/events/$eventId/billing")({
  validateSearch: (search: Record<string, unknown>) => ({
    crew_checkout:
      search.crew_checkout === "success" || search.crew_checkout === "canceled"
        ? search.crew_checkout
        : undefined,
  }),
  loader: ({ params }) =>
    getCrewBillingOrganizerPageFn({ data: { eventId: params.eventId } }),
  component: CrewPurchasePage,
})

function CrewPurchasePage() {
  const { event, viewModel, offer, canPurchase } = Route.useLoaderData()
  const { crew_checkout } = Route.useSearch()
  const router = useRouter()
  const checkout = useServerFn(createCrewCheckoutSessionFn)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = viewModel.plan.hasCrewEventAccess
  const awaitingPayment = crew_checkout === "success" && !active

  useEffect(() => {
    if (active || crew_checkout !== "success") return
    let attempts = 0
    const timer = window.setInterval(() => {
      void router.invalidate()
      if (++attempts >= 10) window.clearInterval(timer)
    }, 3000)
    return () => window.clearInterval(timer)
  }, [active, crew_checkout, router])

  async function purchase() {
    setBusy(true)
    setError(null)
    try {
      const { checkoutUrl } = await checkout({
        data: { eventId: event.id, planId: "crew_basic" },
      })
      window.location.assign(checkoutUrl)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Checkout could not start. Please try again.",
      )
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">
          {active ? "Your event access is active" : "Purchase event access"}
        </h2>
        <p className="mt-2 text-muted-foreground">
          Create your draft schedule for free. Purchase once to export and print
          the schedule for {event.name}.
        </p>
      </div>
      <div className="rounded-md border bg-card p-6 space-y-4">
        <h3 className="text-xl font-semibold">Crew Event</h3>
        {offer && !active ? (
          <p className="text-3xl font-semibold">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: offer.currency,
            }).format(offer.price / 100)}{" "}
            <span className="text-base font-normal text-muted-foreground">
              one time, per event
            </span>
          </p>
        ) : null}
        <p>
          Volunteer imports, role-based shifts, judge assignments, and printable
          schedule exports. Keep using your existing registration platform.
        </p>
        {active ? (
          <Link
            to="/events/$eventId/exports"
            params={{ eventId: event.id }}
            search={{ tab: "schedule" }}
            className="inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground"
          >
            Export schedule
          </Link>
        ) : canPurchase && !awaitingPayment ? (
          <Button
            onClick={() => void purchase()}
            disabled={busy || viewModel.checkout.status !== "available"}
          >
            {busy ? "Opening secure checkout…" : viewModel.checkout.label}
          </Button>
        ) : null}
        {!active && !canPurchase ? (
          <p className="text-sm text-muted-foreground">
            Ask the event owner or a team member with billing access to purchase
            event access. You can keep editing the schedule in the meantime.
          </p>
        ) : !active && viewModel.checkout.status !== "available" ? (
          <p className="text-sm text-muted-foreground">
            Checkout is currently unavailable.{" "}
            <a className="underline" href="mailto:support@wodsmith.com">
              Contact support
            </a>{" "}
            for event access.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      {awaitingPayment ? (
        <div aria-live="polite" className="rounded-md border p-4 space-y-2">
          <p>
            We are waiting for payment confirmation. Your access will update
            here when Stripe confirms payment.
          </p>
          <Button variant="outline" onClick={() => void router.invalidate()}>
            Refresh payment status
          </Button>
        </div>
      ) : null}
      {crew_checkout === "canceled" && !active ? (
        <p aria-live="polite">
          Checkout was canceled. Your schedule is saved, and you can resume
          checkout whenever you are ready.
        </p>
      ) : null}
      <Link
        to="/events/$eventId/shifts"
        params={{ eventId: event.id }}
        className="inline-block text-sm underline underline-offset-4"
      >
        Continue editing your schedule
      </Link>
    </section>
  )
}

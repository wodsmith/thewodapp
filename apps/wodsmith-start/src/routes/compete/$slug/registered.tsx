import {
  createFileRoute,
  getRouteApi,
  Link,
  redirect,
  useRouter,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { z } from "zod"
import { CompetitionRegisteredBanner } from "@/components/competition-registered-banner"
import { CompetitionShareCard } from "@/components/competition-share-card"
import { CompetitionTabs } from "@/components/competition-tabs"
import { RegistrationFulfillmentCard } from "@/components/registration/registration-fulfillment-card"
import { Button } from "@/components/ui/button"
import {
  checkCheckoutCompletionFn,
  getUserCompetitionRegistrationsFn,
} from "@/server-fns/competition-detail-fns"
import { getUserAffiliateNameFn } from "@/server-fns/registration-fns"
import { getMyCompetitionFulfillmentFn } from "@/server-fns/registration-fulfillment-fns"

const parentRoute = getRouteApi("/compete/$slug")

export const Route = createFileRoute("/compete/$slug/registered")({
  component: RegisteredPage,
  validateSearch: z.object({
    session_id: z.string().optional(),
    registration_id: z.string().optional(),
  }),
  loaderDeps: ({ search }) => ({ session_id: search.session_id }),
  loader: async ({ params, context, deps, parentMatchPromise }) => {
    const { slug } = params
    const { session_id } = deps
    const session = context?.session ?? null

    if (!session) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: `/compete/${slug}` },
      })
    }

    const parentMatch = await parentMatchPromise
    const competition = parentMatch.loaderData?.competition
    const divisions = parentMatch.loaderData?.divisions ?? []
    if (!competition) {
      throw redirect({ to: "/" })
    }

    const [{ registrations }, affiliateResult, fulfillment] = await Promise.all(
      [
        getUserCompetitionRegistrationsFn({
          data: {
            competitionId: competition.id,
            userId: session.userId,
          },
        }),
        getUserAffiliateNameFn({
          data: { userId: session.userId },
        }),
        getMyCompetitionFulfillmentFn({
          data: { competitionId: competition.id },
        }),
      ],
    )

    // Only redirect if no session_id — if we came from Stripe checkout,
    // registrations may still be processing
    if (registrations.length === 0 && !session_id) {
      throw redirect({
        to: "/compete/$slug",
        params: { slug },
      })
    }

    const athleteName = `${session.user.firstName} ${session.user.lastName}`
    const affiliateName = affiliateResult.affiliateName ?? "Independent"

    const items = registrations.map((reg) => {
      const div = reg.divisionId
        ? divisions.find((d) => d.id === reg.divisionId)
        : null
      return {
        registrationId: reg.id,
        divisionLabel: div?.label ?? null,
        teamName: reg.teamName,
      }
    })

    return {
      athleteName,
      affiliateName,
      items,
      fulfillment,
      sessionId: session_id ?? null,
    }
  },
})

function RegisteredPage() {
  const { competition } = parentRoute.useLoaderData()
  const {
    athleteName,
    affiliateName,
    items: allItems,
    fulfillment,
    sessionId,
  } = Route.useLoaderData()
  const { slug } = Route.useParams()
  const router = useRouter()
  const checkCompletion = useServerFn(checkCheckoutCompletionFn)
  const [checkout, setCheckout] = useState<{
    sessionId: string | null
    status: "pending" | "confirmed" | "failed" | "timeout"
    registrationIds: string[]
  }>({
    sessionId,
    status: sessionId ? "pending" : "confirmed",
    registrationIds: [],
  })
  const checkoutStatus = !sessionId
    ? "confirmed"
    : checkout.sessionId === sessionId
      ? checkout.status
      : "pending"
  const items = sessionId
    ? allItems.filter((item) =>
        checkout.registrationIds.includes(item.registrationId),
      )
    : allItems
  const [purchaseStatus, setPurchaseStatus] = useState<{
    total: number
    pending: number
  }>({ total: 0, pending: 0 })

  // Poll until all purchases for this checkout session are settled
  useEffect(() => {
    if (checkoutStatus !== "pending" || !sessionId) return

    let cancelled = false
    const MAX_POLL_ATTEMPTS = 60 // ~60 seconds

    const poll = async () => {
      let attempts = 0
      while (!cancelled && attempts < MAX_POLL_ATTEMPTS) {
        attempts++
        try {
          const result = await checkCompletion({
            data: { sessionId, competitionId: competition.id },
          })
          if (!cancelled) {
            setPurchaseStatus({
              total: result.total,
              pending: result.pending,
            })
          }
          if (result.ready || result.status === "failed") {
            if (!cancelled) {
              setCheckout({
                sessionId,
                status: result.ready ? "confirmed" : "failed",
                registrationIds: result.registrationIds,
              })
              await router.invalidate()
            }
            return
          }
        } catch {
          // ignore transient errors, keep polling
        }
        await new Promise((r) => setTimeout(r, 1000))
      }
      // Exhausting retries is not evidence that registration succeeded.
      if (!cancelled) {
        setCheckout({ sessionId, status: "timeout", registrationIds: [] })
      }
    }

    poll()
    return () => {
      cancelled = true
    }
  }, [checkoutStatus, sessionId, checkCompletion, router, competition.id])

  const profileImage =
    competition.profileImageUrl ?? competition.organizingTeam?.avatarUrl

  if (
    checkoutStatus === "failed" ||
    checkoutStatus === "timeout" ||
    (checkoutStatus === "confirmed" && items.length === 0)
  ) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-12 text-center">
        <h1 className="text-2xl font-semibold">
          {checkoutStatus === "failed"
            ? "Your checkout could not be completed"
            : "Registration not confirmed yet"}
        </h1>
        <p className="text-muted-foreground">
          {checkoutStatus === "failed"
            ? "One or more items were unsuccessful. Review your registrations and contact the organizer if you need help with a charge or refund."
            : "We have not confirmed this registration. Check again before starting another checkout. If you were charged, contact the organizer for help."}
        </p>
        <Button
          onClick={() => {
            setCheckout({
              sessionId,
              status: sessionId ? "pending" : "confirmed",
              registrationIds: [],
            })
            void router.invalidate()
          }}
        >
          Check again
        </Button>
        <Button variant="outline" asChild>
          <Link to="/compete/$slug" params={{ slug }}>
            Back to Competition
          </Link>
        </Button>
      </div>
    )
  }

  if (checkoutStatus === "pending") {
    const { total, pending } = purchaseStatus
    return (
      <div className="space-y-4">
        <div className="sticky top-4 z-10">
          <CompetitionTabs
            slug={competition.slug}
            competitionType={competition.competitionType}
          />
        </div>
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground text-sm">
            {total > 0
              ? `Verifying ${pending} of ${total} division ${total === 1 ? "purchase" : "purchases"}...`
              : "Confirming your registration..."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Sticky Tabs */}
      <div className="sticky top-4 z-10">
        <CompetitionTabs
          slug={competition.slug}
          competitionType={competition.competitionType}
        />
      </div>

      {/* Mobile: share card */}
      <div className="flex flex-col items-center gap-6 md:hidden">
        <CompetitionShareCard
          competitionName={competition.name}
          athleteName={athleteName}
          affiliateName={affiliateName}
          competitionLogoUrl={profileImage ?? undefined}
          items={items}
        />
        {items.map((item) => (
          <Button
            key={item.registrationId}
            variant="ghost"
            size="sm"
            asChild
            className="text-slate-400"
          >
            <Link
              to="/compete/$slug/teams/$registrationId"
              params={{ slug, registrationId: item.registrationId }}
            >
              View {item.divisionLabel ?? "Registration"}
            </Link>
          </Button>
        ))}
      </div>

      {/* Desktop: banner */}
      <div className="hidden flex-col items-center gap-6 md:flex">
        <CompetitionRegisteredBanner
          competitionName={competition.name}
          athleteName={athleteName}
          affiliateName={affiliateName}
          competitionLogoUrl={profileImage ?? undefined}
          items={items}
        />
        {items.map((item) => (
          <Button
            key={item.registrationId}
            variant="ghost"
            size="sm"
            asChild
            className="text-slate-400"
          >
            <Link
              to="/compete/$slug/teams/$registrationId"
              params={{ slug, registrationId: item.registrationId }}
            >
              View {item.divisionLabel ?? "Registration"}
            </Link>
          </Button>
        ))}
      </div>

      {fulfillment.purchases.length > 0 || fulfillment.downloads.length > 0 ? (
        <div className="mx-auto w-full max-w-3xl">
          <RegistrationFulfillmentCard {...fulfillment} />
        </div>
      ) : null}
    </div>
  )
}

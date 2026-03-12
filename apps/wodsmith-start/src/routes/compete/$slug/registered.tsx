import { useEffect, useState } from "react"
import {
  createFileRoute,
  getRouteApi,
  Link,
  redirect,
  useRouter,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Loader2 } from "lucide-react"
import { z } from "zod"
import { CompetitionRegisteredBanner } from "@/components/competition-registered-banner"
import { CompetitionShareCard } from "@/components/competition-share-card"
import { CompetitionTabs } from "@/components/competition-tabs"
import { Button } from "@/components/ui/button"
import {
  checkCheckoutCompletionFn,
  getUserCompetitionRegistrationsFn,
} from "@/server-fns/competition-detail-fns"
import { getUserAffiliateNameFn } from "@/server-fns/registration-fns"

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
      throw redirect({ to: "/compete" })
    }

    const [{ registrations }, affiliateResult] = await Promise.all([
      getUserCompetitionRegistrationsFn({
        data: {
          competitionId: competition.id,
          userId: session.userId,
        },
      }),
      getUserAffiliateNameFn({
        data: { userId: session.userId },
      }),
    ])

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

    return { athleteName, affiliateName, items, sessionId: session_id ?? null }
  },
})

function RegisteredPage() {
  const { competition } = parentRoute.useLoaderData()
  const { athleteName, affiliateName, items, sessionId } = Route.useLoaderData()
  const { slug } = Route.useParams()
  const router = useRouter()
  const checkCompletion = useServerFn(checkCheckoutCompletionFn)
  const [checkoutSettled, setCheckoutSettled] = useState(!sessionId)
  const [purchaseStatus, setPurchaseStatus] = useState<{
    total: number
    pending: number
  }>({ total: 0, pending: 0 })

  // Poll until all purchases for this checkout session are settled
  useEffect(() => {
    if (checkoutSettled || !sessionId) return

    let cancelled = false
    const MAX_POLL_ATTEMPTS = 60 // ~60 seconds

    const poll = async () => {
      let attempts = 0
      while (!cancelled && attempts < MAX_POLL_ATTEMPTS) {
        attempts++
        try {
          const result = await checkCompletion({
            data: { sessionId },
          })
          if (!cancelled) {
            setPurchaseStatus({
              total: result.total,
              pending: result.pending,
            })
          }
          if (result.ready) {
            if (!cancelled) {
              setCheckoutSettled(true)
              router.invalidate()
            }
            return
          }
        } catch {
          // ignore transient errors, keep polling
        }
        await new Promise((r) => setTimeout(r, 1000))
      }
      // Timed out - settle anyway so user isn't stuck
      if (!cancelled) {
        setCheckoutSettled(true)
        router.invalidate()
      }
    }

    poll()
    return () => {
      cancelled = true
    }
  }, [checkoutSettled, sessionId, checkCompletion, router])

  const profileImage =
    competition.profileImageUrl ?? competition.organizingTeam?.avatarUrl

  if (!checkoutSettled) {
    const { total, pending } = purchaseStatus
    return (
      <div className="space-y-4">
        <div className="sticky top-4 z-10">
          <CompetitionTabs slug={competition.slug} />
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
        <CompetitionTabs slug={competition.slug} />
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
    </div>
  )
}

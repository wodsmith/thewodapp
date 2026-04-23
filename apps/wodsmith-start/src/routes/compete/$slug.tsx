import {
  createFileRoute,
  notFound,
  Outlet,
  useNavigate,
} from "@tanstack/react-router"
import { useEffect } from "react"
import { z } from "zod"
import { CompetitionHero } from "@/components/competition-hero"
import { CouponBanner } from "@/components/coupon-banner"
import { JsonLd } from "@/components/json-ld"
import { getAppUrlFn } from "@/lib/env"
import { getCouponByCodeFn } from "@/server-fns/coupon-fns"
import { toast } from "sonner"
import { clearCouponSession, setCouponSession } from "@/utils/coupon-cookie"
import { trackEvent } from "@/lib/posthog"
import { getUserCompetitionRegistrationsFn } from "@/server-fns/competition-detail-fns"
import { getPublicCompetitionDivisionsFn } from "@/server-fns/competition-divisions-fns"
import { getCompetitionBySlugFn } from "@/server-fns/competition-fns"
import { getCompetitionSponsorsFn } from "@/server-fns/sponsor-fns"
import { hasJudgesScheduleFn } from "@/server-fns/judge-scheduling-fns"
import { getTeamContactEmailFn } from "@/server-fns/team-fns"
import {
  DEFAULT_TIMEZONE,
  hasDateStartedInTimezone,
  isDeadlinePassedInTimezone,
} from "@/utils/timezone-utils"

export const Route = createFileRoute("/compete/$slug")({
  component: CompetitionDetailLayout,
  staleTime: 10_000, // Cache for 10 seconds (SWR behavior)
  validateSearch: z.object({
    coupon: z.string().optional(),
  }).parse,
  loader: async ({ params, context }) => {
    const { slug } = params

    // Fetch competition by slug first (required to get competition.id)
    const { competition } = await getCompetitionBySlugFn({ data: { slug } })

    if (!competition) {
      throw notFound()
    }

    const session = context.session ?? null

    // Compute registration status inline (no DB query needed)
    const timezone = competition.timezone || DEFAULT_TIMEZONE
    const regOpensAt = competition.registrationOpensAt
    const regClosesAt = competition.registrationClosesAt
    const hasOpened = hasDateStartedInTimezone(regOpensAt, timezone)
    const hasClosed = isDeadlinePassedInTimezone(regClosesAt, timezone)
    const registrationStatus = {
      registrationOpen: !!(
        regOpensAt &&
        regClosesAt &&
        hasOpened &&
        !hasClosed
      ),
      registrationClosed: hasClosed,
      registrationNotYetOpen: !!(regOpensAt && !hasOpened),
    }

    // Compute canManage from session (no DB query needed)
    const canManage = session
      ? session.user?.role === "admin" ||
        !!session.teams?.find(
          (t) =>
            t.id === competition.organizingTeamId &&
            (t.role.id === "admin" || t.role.id === "owner"),
        )
      : false

    // Compute isCohost from session (no DB query needed)
    const isCohost =
      session && competition.competitionTeamId
        ? !!session.teams?.some(
            (t) =>
              t.id === competition.competitionTeamId &&
              t.role.id === "cohost",
          )
        : false

    // Compute isVolunteer from session (no DB query needed)
    const isVolunteer =
      session && competition.competitionTeamId
        ? !!session.teams?.some(
            (t) =>
              t.id === competition.competitionTeamId &&
              t.role.id === "volunteer",
          )
        : false

    // Parallel fetch remaining data from DB
    const [
      divisionsResult,
      sponsorsResult,
      organizerContactEmail,
      userRegsResult,
      judgesScheduleResult,
    ] = await Promise.all([
      getPublicCompetitionDivisionsFn({
        data: { competitionId: competition.id },
      }),
      getCompetitionSponsorsFn({
        data: { competitionId: competition.id },
      }),
      getTeamContactEmailFn({
        data: { teamId: competition.organizingTeamId },
      }),
      session
        ? getUserCompetitionRegistrationsFn({
            data: {
              competitionId: competition.id,
              userId: session.userId,
            },
          })
        : Promise.resolve({ registrations: [] }),
      hasJudgesScheduleFn({
        data: { competitionId: competition.id },
      }),
    ])

    const divisions = divisionsResult.divisions
    const competitionCapacity = divisionsResult.competitionCapacity ?? null
    const sponsors = sponsorsResult
    const userRegistrations = userRegsResult.registrations

    // Backward compatibility: first registration
    const userRegistration = userRegistrations[0] ?? null

    // Calculate userDivision from divisions data (for first registration)
    const userDivision = userRegistration?.divisionId
      ? divisions.find((d) => d.id === userRegistration.divisionId)
      : null

    // Calculate all user divisions for multi-registration display
    const userDivisions = userRegistrations.map((reg) => ({
      registration: reg,
      division: divisions.find((d) => d.id === reg.divisionId) ?? null,
    }))

    const appUrl = await getAppUrlFn()
    const ogBaseUrl = appUrl.includes("localhost")
      ? "http://localhost:8787"
      : "https://og.wodsmith.com"

    return {
      appUrl,
      ogBaseUrl,
      competition,
      userRegistration,
      userRegistrations,
      canManage,
      isCohost,
      isVolunteer,
      registrationStatus,
      session,
      divisions,
      competitionCapacity,
      sponsors,
      userDivision,
      userDivisions,
      maxSpots: undefined as number | undefined,
      organizerContactEmail,
      hasJudgesSchedule: judgesScheduleResult.hasSchedule,
    }
  },
  head: ({ loaderData }) => {
    const competition = loaderData?.competition

    if (!competition) {
      return { meta: [{ title: "Competition Not Found" }] }
    }

    const appUrl = loaderData?.appUrl || "https://wodsmith.com"
    const ogImageUrl = `${loaderData?.ogBaseUrl || "https://og.wodsmith.com"}/competition/${competition.slug}`
    const pageUrl = `${appUrl}/compete/${competition.slug}`
    const description =
      competition.description?.slice(0, 160) ||
      `Join ${competition.name} - a fitness competition on WODsmith`

    return {
      meta: [
        { title: `${competition.name} | WODsmith` },
        { name: "description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: pageUrl },
        { property: "og:title", content: competition.name },
        { property: "og:description", content: description },
        { property: "og:image", content: ogImageUrl },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:site_name", content: "WODsmith" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: competition.name },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: ogImageUrl },
      ],
      links: [{ rel: "canonical", href: pageUrl }],
    }
  },
})

function CompetitionDetailLayout() {
  const loaderData = Route.useLoaderData()
  const {
    competition,
    canManage,
    isCohost,
    isVolunteer,
    registrationStatus,
    hasJudgesSchedule,
  } = loaderData
  const { coupon: couponCode } = Route.useSearch()
  const navigate = useNavigate()

  const hasBanner = !!competition.bannerImageUrl
  const profileImage =
    competition.profileImageUrl ?? competition.organizingTeam?.avatarUrl

  // Track competition view
  useEffect(() => {
    trackEvent("competition_viewed", {
      competition_id: competition.id,
      competition_slug: competition.slug,
      competition_name: competition.name,
    })
  }, [competition.id, competition.slug, competition.name])

  // Handle coupon link param: validate, store in session, strip from URL
  useEffect(() => {
    if (!couponCode) return
    getCouponByCodeFn({ data: { code: couponCode } }).then((result) => {
      if (!result) {
        toast.error("This coupon code does not exist.")
        clearCouponSession()
      } else if (result.invalid) {
        toast.error(result.reason)
        clearCouponSession()
      } else if (result.coupon && result.competition) {
        setCouponSession({
          code: result.coupon.code,
          competitionSlug: result.competition.slug,
          amountOffCents: result.coupon.amountOffCents,
          competitionName: result.competition.name,
        })
      }
      navigate({
        to: "/compete/$slug",
        params: { slug: competition.slug },
        search: {},
        replace: true,
      })
    })
  }, [couponCode, competition.slug, navigate])

  const appUrl = loaderData.appUrl || "https://wodsmith.com"

  const sportsEventSchema = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: competition.name,
    description: competition.description || undefined,
    startDate: competition.startDate,
    endDate: competition.endDate,
    url: `${appUrl}/compete/${competition.slug}`,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    organizer: {
      "@type": "Organization",
      name: competition.organizingTeam?.name || "WODsmith",
      url: appUrl,
    },
    ...(competition.defaultRegistrationFeeCents != null && {
      offers: {
        "@type": "Offer",
        price: (competition.defaultRegistrationFeeCents / 100).toFixed(2),
        priceCurrency: "USD",
        url: `${appUrl}/compete/${competition.slug}`,
        availability: registrationStatus.registrationOpen
          ? "https://schema.org/InStock"
          : registrationStatus.registrationClosed
            ? "https://schema.org/SoldOut"
            : "https://schema.org/PreOrder",
      },
    }),
  }

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Competitions",
        item: `${appUrl}/compete`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: competition.name,
        item: `${appUrl}/compete/${competition.slug}`,
      },
    ],
  }

  return (
    <div className="relative min-h-screen bg-background print:min-h-0 print:bg-white">
      <JsonLd data={sportsEventSchema} />
      <JsonLd data={breadcrumbSchema} />
      {/* Full-bleed banner - absolutely positioned to extend behind the glass card */}
      {hasBanner && (
        <div className="absolute left-1/2 top-0 h-[16rem] w-screen -translate-x-1/2 md:h-[20rem] lg:h-[22rem] print:hidden">
          {/* Profile image on mobile for better portrait fit */}
          {profileImage && (
            <img
              src={profileImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover md:hidden"
            />
          )}
          {/* Banner image on desktop (or all screens if no profile image) */}
          <img
            src={competition.bannerImageUrl!}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover ${profileImage ? "hidden md:block" : ""}`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/60 to-slate-900/40" />
        </div>
      )}

      {/* Hero Section - hidden on print */}
      <div className="relative print:hidden">
        <CompetitionHero
          competition={competition}
          canManage={canManage}
          isCohost={isCohost}
          isVolunteer={isVolunteer}
          hasJudgesSchedule={hasJudgesSchedule}
        />
      </div>

      {/* Content Area */}
      <div className="relative container mx-auto px-0 pb-4 print:p-0 print:max-w-none">
        <Outlet />
      </div>

      <CouponBanner />
    </div>
  )
}

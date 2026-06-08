"use client"

import { createFileRoute, Link } from "@tanstack/react-router"
import {
  ArrowRight,
  Calendar,
  Check,
  ExternalLink,
  Facebook,
  Instagram,
  Mail,
  MapPin,
  Pencil,
  Trophy,
  Twitter,
  Users,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { safeHttpUrl } from "@/lib/safe-url"
import { calculateProfileCompletion } from "@/lib/settings/profile-completion"
import { getAthleteProfileDataFn } from "@/server-fns/athlete-profile-fns"
import { isSameUTCDay } from "@/utils/date-utils"

type AthleteProfileData = {
  preferredUnits?: "imperial" | "metric"
  heightCm?: number
  weightKg?: number
  conditioning?: {
    fran?: { time?: string; date?: string }
    grace?: { time?: string; date?: string }
    helen?: { time?: string; date?: string }
    diane?: { time?: string; date?: string }
    murph?: { time?: string; date?: string }
    maxCindyRounds?: { rounds?: string; date?: string }
    row2k?: { time?: string; date?: string }
    run1Mile?: { time?: string; date?: string }
    run5k?: { time?: string; date?: string }
    row500m?: { time?: string; date?: string }
    maxPullups?: { reps?: string; date?: string }
  }
  strength?: {
    backSquat?: { weight?: number; unit?: "kg" | "lbs"; date?: string }
    deadlift?: { weight?: number; unit?: "kg" | "lbs"; date?: string }
    benchPress?: { weight?: number; unit?: "kg" | "lbs"; date?: string }
    press?: { weight?: number; unit?: "kg" | "lbs"; date?: string }
    snatch?: { weight?: number; unit?: "kg" | "lbs"; date?: string }
    cleanAndJerk?: { weight?: number; unit?: "kg" | "lbs"; date?: string }
  }
  social?: {
    facebook?: string
    instagram?: string
    twitter?: string
    tiktok?: string
  }
}

type Sponsor = {
  id: string
  name: string
  logoUrl: string | null
  website: string | null
}

function parseAthleteProfile(json: string | null): AthleteProfileData | null {
  if (!json) return null
  try {
    return JSON.parse(json) as AthleteProfileData
  } catch {
    return null
  }
}

function calcAge(dob: Date | number | string | null): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getUTCFullYear() - d.getUTCFullYear()
  const m = now.getUTCMonth() - d.getUTCMonth()
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1
  return age
}

function formatHeight(
  heightCm: number | undefined,
  units: "imperial" | "metric",
): string {
  if (!heightCm) return "Not set"
  if (units === "metric") return `${heightCm} cm`
  const totalInches = Math.round(heightCm / 2.54)
  const feet = Math.floor(totalInches / 12)
  const inches = totalInches % 12
  return `${feet}'${inches}"`
}

function formatWeight(
  weightKg: number | undefined,
  units: "imperial" | "metric",
): string {
  if (!weightKg) return "Not set"
  if (units === "metric") return `${weightKg} kg`
  return `${Math.round(weightKg * 2.205)} lbs`
}

function formatLiftWeight(
  weight: number,
  unit: "kg" | "lbs",
  preferredUnits: "imperial" | "metric",
): string {
  if (preferredUnits === "metric") {
    if (unit === "lbs") return `${Math.round(weight / 2.205)} kg`
    return `${weight} kg`
  }
  if (unit === "kg") return `${Math.round(weight * 2.205)} lbs`
  return `${weight} lbs`
}

function formatDate(date: Date | number | string | null): string {
  if (!date) return "TBA"
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return "Invalid Date"
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export const Route = createFileRoute("/_protected/settings/overview/")({
  component: SettingsOverviewPage,
  loader: async () => await getAthleteProfileDataFn(),
})

function SettingsOverviewPage() {
  const { user, sponsors, competitionHistory } = Route.useLoaderData()

  const athleteProfile = parseAthleteProfile(user.athleteProfile)
  const dob = user.dateOfBirth ? new Date(user.dateOfBirth) : null
  const age = calcAge(dob)
  const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim()
  const initials =
    `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() ||
    "?"
  const preferredUnits = athleteProfile?.preferredUnits || "imperial"
  const genderLabel = user.gender
    ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1)
    : null

  const completion = calculateProfileCompletion({
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    avatar: user.avatar ?? null,
    gender: user.gender ?? null,
    dateOfBirth: dob,
    heightCm: athleteProfile?.heightCm ?? null,
    weightKg: athleteProfile?.weightKg ?? null,
  })

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="space-y-1.5">
        <div className="text-xs font-bold tracking-[0.18em] uppercase text-primary">
          Overview
        </div>
        <h1 className="text-3xl font-mono font-bold tracking-tight">
          Hey, {user.firstName || "there"}.
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          One place to manage everything WODsmith knows about you — from how
          your name shows on the leaderboard to which competitions invoice you.
        </p>
      </div>

      {/* Identity strip */}
      <Card className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
          <div className="absolute -top-16 -left-16 h-64 w-64 rounded-full bg-primary/25 blur-3xl" />
          <div className="absolute -bottom-20 right-0 h-56 w-56 rounded-full bg-amber-500/20 blur-3xl" />
        </div>

        <CardContent className="relative px-6 py-6 flex flex-wrap items-center gap-5">
          <div className="rounded-full bg-background p-1 border shadow-sm">
            <Avatar className="h-[88px] w-[88px]">
              <AvatarImage src={user.avatar ?? undefined} alt={fullName} />
              <AvatarFallback className="text-xl font-mono font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-primary mb-1">
              Athlete
            </div>
            <h2 className="font-mono font-bold text-2xl tracking-tight">
              {fullName || "Unnamed athlete"}
            </h2>
            {user.affiliateName && (
              <p className="text-muted-foreground text-sm mt-0.5">
                {user.affiliateName}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground">
              {(age !== null || genderLabel) && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {age !== null ? `${age} y/o` : null}
                  {age !== null && genderLabel ? " · " : ""}
                  {genderLabel}
                </span>
              )}
              {user.email && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  {user.email}
                </span>
              )}
            </div>
          </div>
          <Button asChild>
            <Link to="/settings/athlete">
              <Pencil className="h-4 w-4 mr-2" />
              Edit athlete
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Profile completion */}
      {completion.percent < 100 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-xs font-bold tracking-[0.18em] uppercase text-primary mb-1">
                  Get registration ready
                </div>
                <h3 className="font-mono font-bold text-xl">
                  Profile completion
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Finish these so organizers can register you without
                  back-and-forth.
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono font-bold text-3xl tabular-nums text-primary leading-none">
                  {completion.percent}
                  <span className="text-xl text-muted-foreground">%</span>
                </div>
                <div className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground mt-1">
                  {completion.completed}/{completion.total} done
                </div>
              </div>
            </div>

            <div className="h-2 bg-secondary rounded-full overflow-hidden mb-5">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${completion.percent}%` }}
              />
            </div>

            <ul className="grid sm:grid-cols-2 gap-2">
              {completion.items.map((item) => (
                <li key={item.id}>
                  <Link
                    to={item.target}
                    className={[
                      "w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border text-sm transition-colors text-left",
                      item.done
                        ? "border-emerald-500/30 bg-emerald-500/5 text-foreground/80"
                        : "border-border hover:border-primary/40 hover:bg-secondary/60",
                    ].join(" ")}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className={[
                          "h-5 w-5 rounded-full border flex items-center justify-center shrink-0",
                          item.done
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-border bg-background",
                        ].join(" ")}
                      >
                        {item.done && <Check className="h-3 w-3" />}
                      </span>
                      <span
                        className={
                          item.done
                            ? "line-through text-muted-foreground"
                            : "font-medium"
                        }
                      >
                        {item.label}
                      </span>
                    </span>
                    {!item.done && (
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-muted-foreground text-sm font-medium">Age</p>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {age !== null ? `${age} y.o.` : "Not set"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-muted-foreground text-sm font-medium">
                Height
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {formatHeight(athleteProfile?.heightCm, preferredUnits)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-muted-foreground text-sm font-medium">
                Weight
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {formatWeight(athleteProfile?.weightKg, preferredUnits)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <CompetitiveHistory registrations={competitionHistory} />

      <Separator />

      <BenchmarkStats
        athleteProfile={athleteProfile}
        preferredUnits={preferredUnits}
      />

      <Separator />

      <SponsorsSocial athleteProfile={athleteProfile} sponsors={sponsors} />
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CompetitiveHistory({ registrations }: { registrations: any[] }) {
  if (registrations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Competitive History</CardTitle>
          <CardDescription>
            Your competition participation history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground flex flex-col items-center justify-center py-12 text-center">
            <Trophy className="mb-4 h-12 w-12 opacity-20" />
            <p className="text-lg font-medium">No competitions yet</p>
            <p className="mt-1 text-sm">
              Register for a competition to start building your competitive
              history
            </p>
            <Button asChild className="mt-4">
              {/* @lat: [[architecture#Route Groups#compete]] */}
              <Link to="/">Browse Competitions</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Competitive History</CardTitle>
        <CardDescription>
          {registrations.length}{" "}
          {registrations.length === 1 ? "competition" : "competitions"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {registrations.map((registration) => {
            if (!registration.competition) return null
            const isTeamRegistration =
              (registration.division?.teamSize ?? 1) > 1

            return (
              <div
                key={registration.id}
                className="border-b last:border-b-0 pb-4 last:pb-0"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold">
                      <Link
                        to="/compete/$slug"
                        params={{ slug: registration.competition.slug }}
                        className="hover:underline"
                      >
                        {registration.competition.name}
                      </Link>
                    </h3>
                    {isTeamRegistration &&
                      (registration.teamName ||
                        registration.athleteTeam?.name) && (
                        <p className="text-sm text-muted-foreground mt-1">
                          <Users className="inline h-3 w-3 mr-1" />
                          {registration.teamName ||
                            registration.athleteTeam?.name}
                        </p>
                      )}
                    <div className="mt-2 flex flex-wrap gap-3 text-sm">
                      <div className="text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {isSameUTCDay(
                            registration.competition.startDate,
                            registration.competition.endDate,
                          )
                            ? formatDate(registration.competition.startDate)
                            : `${formatDate(registration.competition.startDate)} - ${formatDate(registration.competition.endDate)}`}
                        </span>
                      </div>
                      {registration.division && (
                        <Badge variant="outline">
                          {registration.division.label}
                        </Badge>
                      )}
                      {registration.competition.organizingTeam && (
                        <div className="text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span>
                            {registration.competition.organizingTeam.name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link
                        to="/compete/$slug"
                        params={{ slug: registration.competition.slug }}
                      >
                        View Event
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function BenchmarkStats({
  athleteProfile,
  preferredUnits,
}: {
  athleteProfile: AthleteProfileData | null
  preferredUnits: "imperial" | "metric"
}) {
  const conditioning = athleteProfile?.conditioning
  const strength = athleteProfile?.strength

  const formatConditioningValue = (
    value:
      | { time?: string; reps?: string; rounds?: string; date?: string }
      | undefined,
  ): React.ReactNode => {
    if (!value || (!value.time && !value.reps && !value.rounds)) {
      return <span className="text-muted-foreground">Not recorded</span>
    }
    const displayValue = value.time || value.reps || value.rounds || "N/A"
    return (
      <div>
        <span className="font-semibold tabular-nums">{displayValue}</span>
        {value.date && (
          <span className="text-muted-foreground ml-2 text-sm">
            {new Date(value.date).toLocaleDateString()}
          </span>
        )}
      </div>
    )
  }

  const formatStrengthValue = (
    lift: { weight?: number; unit?: "kg" | "lbs"; date?: string } | undefined,
  ): React.ReactNode => {
    if (!lift || !lift.weight) {
      return <span className="text-muted-foreground">Not recorded</span>
    }
    const unit = lift.unit || "lbs"
    return (
      <div>
        <span className="font-semibold tabular-nums">
          {formatLiftWeight(lift.weight, unit, preferredUnits)}
        </span>
        {lift.date && (
          <span className="text-muted-foreground ml-2 text-sm">
            {new Date(lift.date).toLocaleDateString()}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notable Metcons</CardTitle>
          <CardDescription>
            Personal bests for benchmark workouts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Fran</p>
              {formatConditioningValue(conditioning?.fran)}
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Grace</p>
              {formatConditioningValue(conditioning?.grace)}
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Helen</p>
              {formatConditioningValue(conditioning?.helen)}
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Diane</p>
              {formatConditioningValue(conditioning?.diane)}
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Murph</p>
              {formatConditioningValue(conditioning?.murph)}
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Cindy</p>
              {formatConditioningValue(conditioning?.maxCindyRounds)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conditioning Metcons</CardTitle>
          <CardDescription>
            Personal bests for other conditioning workouts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">2K Row</p>
              {formatConditioningValue(conditioning?.row2k)}
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">1 Mile Run</p>
              {formatConditioningValue(conditioning?.run1Mile)}
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">5K Run</p>
              {formatConditioningValue(conditioning?.run5k)}
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">500m Row</p>
              {formatConditioningValue(conditioning?.row500m)}
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Max Pull-ups</p>
              {formatConditioningValue(conditioning?.maxPullups)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Strength Lifts</CardTitle>
          <CardDescription>One-rep max personal records</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Back Squat</p>
              {formatStrengthValue(strength?.backSquat)}
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Deadlift</p>
              {formatStrengthValue(strength?.deadlift)}
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Bench Press</p>
              {formatStrengthValue(strength?.benchPress)}
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Press</p>
              {formatStrengthValue(strength?.press)}
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Snatch</p>
              {formatStrengthValue(strength?.snatch)}
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Clean &amp; Jerk</p>
              {formatStrengthValue(strength?.cleanAndJerk)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SponsorsSocial({
  athleteProfile,
  sponsors,
}: {
  athleteProfile: AthleteProfileData | null
  sponsors: Sponsor[]
}) {
  const social = athleteProfile?.social
  const safeSocial = {
    instagram: safeHttpUrl(social?.instagram),
    facebook: safeHttpUrl(social?.facebook),
    twitter: safeHttpUrl(social?.twitter),
    tiktok: safeHttpUrl(social?.tiktok),
  }
  const hasSocialLinks =
    safeSocial.instagram ||
    safeSocial.facebook ||
    safeSocial.twitter ||
    safeSocial.tiktok
  const hasSponsors = sponsors && sponsors.length > 0

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Social Networks</CardTitle>
          <CardDescription>Connect on social media</CardDescription>
        </CardHeader>
        <CardContent>
          {hasSocialLinks ? (
            <div className="flex flex-wrap gap-3">
              {safeSocial.instagram && (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={safeSocial.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Instagram className="mr-2 h-4 w-4" />
                    Instagram
                  </a>
                </Button>
              )}
              {safeSocial.facebook && (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={safeSocial.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Facebook className="mr-2 h-4 w-4" />
                    Facebook
                  </a>
                </Button>
              )}
              {safeSocial.twitter && (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={safeSocial.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Twitter className="mr-2 h-4 w-4" />
                    Twitter
                  </a>
                </Button>
              )}
              {safeSocial.tiktok && (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={safeSocial.tiktok}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    TikTok
                  </a>
                </Button>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No social networks added yet
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle>Sponsors</CardTitle>
            <CardDescription>Supporting brands and partners</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/settings/sponsors">
              <Pencil className="mr-2 h-4 w-4" />
              Manage
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {hasSponsors ? (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {sponsors.map((sponsor) => {
                const safeLogo = safeHttpUrl(sponsor.logoUrl)
                const safeWebsite = safeHttpUrl(sponsor.website)
                return (
                  <div
                    key={sponsor.id}
                    className="border-muted flex flex-col items-center gap-2 rounded-lg border p-4 text-center"
                  >
                    {safeLogo ? (
                      <img
                        src={safeLogo}
                        alt={sponsor.name}
                        className="h-16 w-auto object-contain"
                      />
                    ) : (
                      <div className="flex h-16 items-center">
                        <p className="font-semibold">{sponsor.name}</p>
                      </div>
                    )}
                    {safeWebsite && (
                      <Button
                        asChild
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                      >
                        <a
                          href={safeWebsite}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs"
                        >
                          Visit Website
                        </a>
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No sponsors added yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

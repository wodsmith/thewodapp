"use client"

import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowRight, Calendar, Check, Mail, Pencil } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { calculateProfileCompletion } from "@/lib/settings/profile-completion"
import { getAthleteEditDataFn } from "@/server-fns/athlete-profile-fns"
import { getUserProfileFn } from "@/server-fns/profile-fns"

type AthleteJsonShape = {
  heightCm?: number
  weightKg?: number
}

function parseAthleteProfile(json: string | null): AthleteJsonShape | null {
  if (!json) return null
  try {
    return JSON.parse(json) as AthleteJsonShape
  } catch {
    return null
  }
}

function calcAge(dob: Date | null): number | null {
  if (!dob) return null
  const now = new Date()
  let age = now.getUTCFullYear() - dob.getUTCFullYear()
  const m = now.getUTCMonth() - dob.getUTCMonth()
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1
  return age
}

export const Route = createFileRoute("/_protected/settings/overview/")({
  component: SettingsOverviewPage,
  loader: async () => {
    const [profileResult, athleteResult] = await Promise.all([
      getUserProfileFn(),
      getAthleteEditDataFn(),
    ])
    return { profile: profileResult.data, athlete: athleteResult.user }
  },
})

function SettingsOverviewPage() {
  const { profile, athlete } = Route.useLoaderData()
  const json = parseAthleteProfile(athlete.athleteProfile)

  const dob = athlete.dateOfBirth ? new Date(athlete.dateOfBirth) : null

  const completion = calculateProfileCompletion({
    firstName: profile?.firstName ?? null,
    lastName: profile?.lastName ?? null,
    avatar: profile?.avatar ?? null,
    gender: athlete.gender ?? null,
    dateOfBirth: dob,
    heightCm: json?.heightCm ?? null,
    weightKg: json?.weightKg ?? null,
  })

  const fullName = [profile?.firstName, profile?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim()
  const initials =
    `${profile?.firstName?.[0] ?? ""}${profile?.lastName?.[0] ?? ""}`.toUpperCase() ||
    "?"
  const age = calcAge(dob)
  const genderLabel = athlete.gender
    ? athlete.gender.charAt(0).toUpperCase() + athlete.gender.slice(1)
    : null

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="space-y-1.5">
        <div className="text-xs font-bold tracking-[0.18em] uppercase text-primary">
          Overview
        </div>
        <h1 className="text-3xl font-mono font-bold tracking-tight">
          Hey, {profile?.firstName || "there"}.
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
              <AvatarImage src={profile?.avatar ?? undefined} alt={fullName} />
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
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground">
              {(age || genderLabel) && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {age ? `${age} y/o` : null}
                  {age && genderLabel ? " · " : ""}
                  {genderLabel}
                </span>
              )}
              {profile?.email && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  {profile.email}
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
    </div>
  )
}

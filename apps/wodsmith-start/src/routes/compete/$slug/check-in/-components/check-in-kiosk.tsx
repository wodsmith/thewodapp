import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSignature,
  Loader2,
  Search,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type { Waiver } from "@/db/schemas/waivers"
import {
  type CheckInRegistration,
  type CheckInTeammate,
  checkInRegistrationFn,
  searchCompetitionRegistrationsFn,
} from "@/server-fns/check-in-fns"
import { CheckInWaiverDialog } from "./check-in-waiver-dialog"

interface CheckInKioskProps {
  competitionId: string
  waivers: Waiver[]
}

interface AthleteRowData {
  athlete: CheckInTeammate
  registration: CheckInRegistration
  isSolo: boolean
  signedRequired: number
  totalRequired: number
  allRequiredSigned: boolean
}

export function CheckInKiosk({ competitionId, waivers }: CheckInKioskProps) {
  const search = useServerFn(searchCompetitionRegistrationsFn)
  const checkIn = useServerFn(checkInRegistrationFn)
  const router = useRouter()

  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [registrations, setRegistrations] = useState<CheckInRegistration[]>([])
  const [pendingCheckInId, setPendingCheckInId] = useState<string | null>(null)
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null)
  const [waiverModal, setWaiverModal] = useState<{
    waiver: Waiver
    athlete: CheckInTeammate
    registrationId: string
  } | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => clearTimeout(t)
  }, [query])

  const fetchRegistrations = useMemo(
    () => async (q: string) => {
      setIsLoading(true)
      try {
        const result = await search({
          data: { competitionId, query: q || undefined },
        })
        setRegistrations(result.registrations)
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load registrations",
        )
      } finally {
        setIsLoading(false)
      }
    },
    [competitionId, search],
  )

  // Always fetch the unfiltered list for stats; refetch with query when searching.
  useEffect(() => {
    void fetchRegistrations(debouncedQuery)
  }, [debouncedQuery, fetchRegistrations])

  const requiredWaivers = useMemo(
    () => waivers.filter((w) => w.required),
    [waivers],
  )

  // Stats are computed off the current result set. When a query is present,
  // these reflect the filtered slice — that's intentional, the volunteer is
  // looking at "X / Y of these matches are checked in."
  const stats = useMemo(() => {
    let checkedIn = 0
    let waiversMissing = 0
    for (const r of registrations) {
      if (r.checkedInAt) checkedIn += 1
      const totalRequired = r.members.length * requiredWaivers.length
      let signed = 0
      for (const m of r.members) {
        for (const w of requiredWaivers) {
          if (m.signedWaivers[w.id]) signed += 1
        }
      }
      if (totalRequired > 0 && signed < totalRequired) waiversMissing += 1
    }
    const total = registrations.length
    return {
      total,
      checkedIn,
      pending: total - checkedIn,
      waiversMissing,
      percent: total === 0 ? 0 : Math.round((checkedIn / total) * 100),
    }
  }, [registrations, requiredWaivers])

  // Flatten registrations into per-athlete rows when searching.
  const athleteRows = useMemo<AthleteRowData[]>(() => {
    const rows: AthleteRowData[] = []
    for (const reg of registrations) {
      const isSolo = reg.members.length <= 1 && !reg.teamName
      for (const athlete of reg.members) {
        const signedRequired = requiredWaivers.filter(
          (w) => !!athlete.signedWaivers[w.id],
        ).length
        rows.push({
          athlete,
          registration: reg,
          isSolo,
          signedRequired,
          totalRequired: requiredWaivers.length,
          allRequiredSigned: signedRequired >= requiredWaivers.length,
        })
      }
    }
    // Sort: not-checked-in first, then athletes missing waivers, then alpha.
    rows.sort((a, b) => {
      const aChecked = !!a.registration.checkedInAt
      const bChecked = !!b.registration.checkedInAt
      if (aChecked !== bChecked) return aChecked ? 1 : -1
      if (a.allRequiredSigned !== b.allRequiredSigned) {
        return a.allRequiredSigned ? 1 : -1
      }
      return athleteName(a.athlete).localeCompare(athleteName(b.athlete))
    })
    return rows
  }, [registrations, requiredWaivers])

  const handleToggleCheckIn = async (
    registration: CheckInRegistration,
    checkedIn: boolean,
  ) => {
    setPendingCheckInId(registration.id)
    try {
      const result = await checkIn({
        data: {
          competitionId,
          registrationId: registration.id,
          checkedIn,
        },
      })
      setRegistrations((prev) =>
        prev.map((r) =>
          r.id === registration.id
            ? {
                ...r,
                checkedInAt: result.checkedInAt,
                checkedInBy: result.checkedInBy,
              }
            : r,
        ),
      )
      toast.success(
        checkedIn
          ? `Checked in ${registrationLabel(registration)}`
          : `Reverted check-in for ${registrationLabel(registration)}`,
      )
      router.invalidate()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update check-in",
      )
    } finally {
      setPendingCheckInId(null)
    }
  }

  const handleWaiverSigned = (
    athleteUserId: string,
    waiverId: string,
    signedAt: string,
  ) => {
    if (!waiverModal) return
    setRegistrations((prev) =>
      prev.map((r) =>
        r.id === waiverModal.registrationId
          ? {
              ...r,
              members: r.members.map((m) =>
                m.userId === athleteUserId
                  ? {
                      ...m,
                      signedWaivers: {
                        ...m.signedWaivers,
                        [waiverId]: signedAt,
                      },
                    }
                  : m,
              ),
            }
          : r,
      ),
    )
    setWaiverModal(null)
  }

  const showResults = !!debouncedQuery
  const hasRequiredWaivers = requiredWaivers.length > 0

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <CheckInScoreboard
        checkedIn={stats.checkedIn}
        total={stats.total}
        percent={stats.percent}
        waiversMissing={stats.waiversMissing}
        hasRequiredWaivers={hasRequiredWaivers}
        showingFiltered={showResults}
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search athlete name, email, or team…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-14 pl-12 text-base"
          autoFocus
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent"
            aria-label="Clear search"
          >
            <XCircle className="h-5 w-5" />
          </button>
        )}
      </div>

      <div>
        {!showResults ? (
          <EmptyPrompt
            totalRegistrations={stats.total}
            pending={stats.pending}
            waiversMissing={stats.waiversMissing}
            hasRequiredWaivers={hasRequiredWaivers}
          />
        ) : isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : athleteRows.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No athletes matching{" "}
              <span className="font-medium text-foreground">
                "{debouncedQuery}"
              </span>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {athleteRows.length}{" "}
              {athleteRows.length === 1 ? "athlete" : "athletes"} found
            </p>
            {athleteRows.map((row) => (
              <AthleteRow
                key={`${row.registration.id}:${row.athlete.userId}`}
                row={row}
                allWaivers={waivers}
                isExpanded={expandedTeamId === row.registration.id}
                onToggleExpand={() =>
                  setExpandedTeamId((cur) =>
                    cur === row.registration.id ? null : row.registration.id,
                  )
                }
                isCheckingIn={pendingCheckInId === row.registration.id}
                onToggleCheckIn={(checkedIn) =>
                  handleToggleCheckIn(row.registration, checkedIn)
                }
                onSignWaiver={(athlete, waiver) =>
                  setWaiverModal({
                    athlete,
                    waiver,
                    registrationId: row.registration.id,
                  })
                }
              />
            ))}
          </div>
        )}
      </div>

      {waiverModal && (
        <CheckInWaiverDialog
          open={!!waiverModal}
          onOpenChange={(open) => !open && setWaiverModal(null)}
          competitionId={competitionId}
          registrationId={waiverModal.registrationId}
          athlete={waiverModal.athlete}
          waiver={waiverModal.waiver}
          onSigned={(signedAt) =>
            handleWaiverSigned(
              waiverModal.athlete.userId,
              waiverModal.waiver.id,
              signedAt,
            )
          }
        />
      )}
    </div>
  )
}

interface ScoreboardProps {
  checkedIn: number
  total: number
  percent: number
  waiversMissing: number
  hasRequiredWaivers: boolean
  showingFiltered: boolean
}

function CheckInScoreboard({
  checkedIn,
  total,
  percent,
  waiversMissing,
  hasRequiredWaivers,
  showingFiltered,
}: ScoreboardProps) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-4 px-5 pt-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {showingFiltered ? "Matching · Checked In" : "Checked In"}
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-4xl font-bold tabular-nums leading-none tracking-tight">
              {checkedIn}
            </span>
            <span className="font-mono text-2xl font-medium tabular-nums leading-none text-muted-foreground">
              / {total}
            </span>
            <span className="font-mono text-sm font-semibold tabular-nums text-muted-foreground">
              ({percent}%)
            </span>
          </div>
        </div>
        {hasRequiredWaivers && (
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Waivers
            </p>
            {waiversMissing === 0 ? (
              <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="h-4 w-4" />
                All teams good
              </p>
            ) : (
              <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                {waiversMissing} {waiversMissing === 1 ? "team" : "teams"}{" "}
                missing
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden bg-muted">
        <div
          className="h-full bg-emerald-500 transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

function EmptyPrompt({
  totalRegistrations,
  pending,
  waiversMissing,
  hasRequiredWaivers,
}: {
  totalRegistrations: number
  pending: number
  waiversMissing: number
  hasRequiredWaivers: boolean
}) {
  if (totalRegistrations === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <Users className="h-10 w-10 opacity-40" />
          <p className="text-sm">No registrations for this competition yet</p>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
        <Search className="h-10 w-10 text-muted-foreground/50" />
        <p className="font-medium text-foreground">
          Search for an athlete to check them in
        </p>
        <p className="text-sm text-muted-foreground">
          Type a first name, last name, email, or team name above
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-xs tabular-nums text-muted-foreground">
          <span>{pending} pending</span>
          {hasRequiredWaivers && (
            <>
              <span aria-hidden="true">·</span>
              <span>{waiversMissing} teams need waivers</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface AthleteRowProps {
  row: AthleteRowData
  allWaivers: Waiver[]
  isExpanded: boolean
  onToggleExpand: () => void
  isCheckingIn: boolean
  onToggleCheckIn: (checkedIn: boolean) => void
  onSignWaiver: (athlete: CheckInTeammate, waiver: Waiver) => void
}

function AthleteRow({
  row,
  allWaivers,
  isExpanded,
  onToggleExpand,
  isCheckingIn,
  onToggleCheckIn,
  onSignWaiver,
}: AthleteRowProps) {
  const { athlete, registration, isSolo, allRequiredSigned } = row
  const isCheckedIn = !!registration.checkedInAt
  const requiredWaivers = allWaivers.filter((w) => w.required)
  const optionalWaivers = allWaivers.filter((w) => !w.required)
  const orderedWaivers = [...requiredWaivers, ...optionalWaivers]
  const teammates = registration.members.filter(
    (m) => m.userId !== athlete.userId,
  )
  const accent = isCheckedIn
    ? "bg-emerald-500"
    : !allRequiredSigned
      ? "bg-amber-500"
      : "bg-muted-foreground/20"

  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-card transition-colors ${
        isCheckedIn ? "border-emerald-200 dark:border-emerald-900/40" : ""
      }`}
    >
      <div
        className={`absolute inset-y-0 left-0 w-1 ${accent}`}
        aria-hidden="true"
      />

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 pl-5 sm:flex-nowrap">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar className="h-12 w-12 shrink-0">
            {athlete.avatar && (
              <AvatarImage src={athlete.avatar} alt={athleteName(athlete)} />
            )}
            <AvatarFallback className="text-sm">
              {athleteInitials(athlete)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-base font-semibold">
                {athleteName(athlete)}
              </p>
              {athlete.isCaptain && !isSolo && (
                <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Captain
                </span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              {!isSolo && registration.teamName && (
                <span className="truncate font-medium text-foreground/70">
                  {registration.teamName}
                </span>
              )}
              {registration.divisionLabel && (
                <>
                  {!isSolo && registration.teamName && (
                    <span aria-hidden="true">·</span>
                  )}
                  <span className="truncate">{registration.divisionLabel}</span>
                </>
              )}
              {athlete.email && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{athlete.email}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isCheckedIn ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Checked in
            </span>
          ) : (
            <Button
              size="lg"
              disabled={isCheckingIn}
              onClick={() => onToggleCheckIn(true)}
              className="min-w-[150px]"
            >
              {isCheckingIn ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-5 w-5" />
              )}
              {isSolo ? "Check in" : "Check in team"}
            </Button>
          )}
        </div>
      </div>

      {/* Waiver status strip — visible whether expanded or not */}
      {orderedWaivers.length > 0 && (
        <div className="border-t bg-muted/20 px-4 py-3 pl-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Waivers · {athleteName(athlete).split(" ")[0] || "this athlete"}
            </span>
            {requiredWaivers.length > 0 && (
              <WaiverChip
                signed={row.signedRequired}
                required={row.totalRequired}
              />
            )}
          </div>
          <div className="space-y-1">
            {orderedWaivers.map((waiver) => {
              const signedAt = athlete.signedWaivers[waiver.id]
              return (
                <div
                  key={waiver.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {signedAt ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <FileSignature className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {waiver.title}
                        {waiver.required && (
                          <span className="ml-1 text-destructive">*</span>
                        )}
                      </p>
                      {signedAt && (
                        <p className="text-xs text-muted-foreground">
                          Signed {new Date(signedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  {signedAt ? (
                    <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Signed
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => onSignWaiver(athlete, waiver)}
                    >
                      Sign on iPad
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Team context — only for team registrations */}
      {teammates.length > 0 && (
        <div className="border-t pl-5">
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-xs text-muted-foreground hover:bg-accent/40"
          >
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground/70">
                {teammates.length}{" "}
                {teammates.length === 1 ? "teammate" : "teammates"}
              </span>
              <span className="truncate">
                · {teammates.map((m) => firstName(m)).join(", ")}
              </span>
            </span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0" />
            )}
          </button>

          {isExpanded && (
            <div className="space-y-1 px-4 pb-3">
              {teammates.map((mate) => {
                const mateSigned = requiredWaivers.filter(
                  (w) => !!mate.signedWaivers[w.id],
                ).length
                return (
                  <div
                    key={mate.userId}
                    className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar className="h-7 w-7 shrink-0">
                        {mate.avatar && (
                          <AvatarImage
                            src={mate.avatar}
                            alt={athleteName(mate)}
                          />
                        )}
                        <AvatarFallback className="text-[10px]">
                          {athleteInitials(mate)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate font-medium">
                        {athleteName(mate)}
                      </span>
                    </div>
                    {requiredWaivers.length > 0 && (
                      <WaiverChip
                        signed={mateSigned}
                        required={requiredWaivers.length}
                        compact
                      />
                    )}
                  </div>
                )
              })}
              {registration.pendingTeammates.length > 0 && (
                <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                  <span className="font-medium">Pending invites:</span>{" "}
                  {registration.pendingTeammates
                    .map(
                      (p) =>
                        [p.firstName, p.lastName].filter(Boolean).join(" ") ||
                        p.email,
                    )
                    .join(", ")}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Undo check-in only — small affordance below */}
      {isCheckedIn && (
        <div className="flex items-center justify-between border-t bg-emerald-50/40 px-4 py-2 pl-5 text-xs text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400">
          <span>
            Checked in {new Date(registration.checkedInAt!).toLocaleString()}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={isCheckingIn}
            onClick={() => onToggleCheckIn(false)}
            className="h-7 text-xs"
          >
            {isCheckingIn ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <XCircle className="mr-1 h-3 w-3" />
            )}
            Undo
          </Button>
        </div>
      )}
    </div>
  )
}

function WaiverChip({
  signed,
  required,
  compact = false,
}: {
  signed: number
  required: number
  compact?: boolean
}) {
  const complete = signed >= required
  const tone = complete
    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
    : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border-amber-300 dark:border-amber-900/50"
  const Icon = complete ? ShieldCheck : AlertTriangle
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${tone}`}
    >
      <Icon className="h-3 w-3" />
      <span className="font-mono tabular-nums">
        {signed}/{required}
      </span>
      {!compact && <span>signed</span>}
    </span>
  )
}

function athleteName(m: CheckInTeammate): string {
  const full = `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim()
  return full || m.email || "Unnamed athlete"
}

function firstName(m: CheckInTeammate): string {
  return m.firstName?.trim() || m.email || "?"
}

function athleteInitials(m: CheckInTeammate): string {
  const initials = (m.firstName?.[0] ?? "") + (m.lastName?.[0] ?? "")
  return initials || m.email?.[0]?.toUpperCase() || "?"
}

function registrationLabel(r: CheckInRegistration): string {
  if (r.teamName) return r.teamName
  const first = r.members[0]
  if (!first) return "Unnamed registration"
  return athleteName(first)
}

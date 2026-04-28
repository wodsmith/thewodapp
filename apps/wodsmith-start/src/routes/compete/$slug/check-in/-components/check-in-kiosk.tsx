import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { CheckCircle2, Loader2, Search, XCircle } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type { Waiver } from "@/db/schemas/waivers"
import {
  checkInRegistrationFn,
  searchCompetitionRegistrationsFn,
  type CheckInRegistration,
  type CheckInTeammate,
} from "@/server-fns/check-in-fns"
import { CheckInWaiverDialog } from "./check-in-waiver-dialog"

interface CheckInKioskProps {
  competitionId: string
  waivers: Waiver[]
}

export function CheckInKiosk({ competitionId, waivers }: CheckInKioskProps) {
  const search = useServerFn(searchCompetitionRegistrationsFn)
  const checkIn = useServerFn(checkInRegistrationFn)
  const router = useRouter()

  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [registrations, setRegistrations] = useState<CheckInRegistration[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingCheckInId, setPendingCheckInId] = useState<string | null>(null)
  const [waiverModal, setWaiverModal] = useState<{
    waiver: Waiver
    athlete: CheckInTeammate
    registrationId: string
  } | null>(null)

  // Debounce the query so we don't fire a request on every keystroke.
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

  useEffect(() => {
    void fetchRegistrations(debouncedQuery)
  }, [debouncedQuery, fetchRegistrations])

  const selected = registrations.find((r) => r.id === selectedId) ?? null
  const requiredWaivers = waivers.filter((w) => w.required)

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

  const handleWaiverSigned = (athleteUserId: string, waiverId: string, signedAt: string) => {
    setRegistrations((prev) =>
      prev.map((r) =>
        r.id === waiverModal?.registrationId
          ? {
              ...r,
              members: r.members.map((m) =>
                m.userId === athleteUserId
                  ? {
                      ...m,
                      signedWaivers: { ...m.signedWaivers, [waiverId]: signedAt },
                    }
                  : m,
              ),
            }
          : r,
      ),
    )
    setWaiverModal(null)
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_1fr]">
      {/* Left: search + result list */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search team, name, or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 pl-10 text-base"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          {isLoading ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : registrations.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                {debouncedQuery
                  ? `No registrations matching "${debouncedQuery}"`
                  : "No registrations yet"}
              </CardContent>
            </Card>
          ) : (
            registrations.map((reg) => {
              const isSelected = reg.id === selectedId
              const allRequiredSigned = reg.members.every((m) =>
                requiredWaivers.every((w) => !!m.signedWaivers[w.id]),
              )
              return (
                <button
                  key={reg.id}
                  type="button"
                  onClick={() => setSelectedId(reg.id)}
                  className={`w-full rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent ${
                    isSelected ? "border-primary ring-2 ring-primary/40" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {registrationLabel(reg)}
                      </p>
                      {reg.divisionLabel && (
                        <p className="text-xs text-muted-foreground">
                          {reg.divisionLabel}
                        </p>
                      )}
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {reg.members
                          .map(
                            (m) =>
                              `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim() ||
                              m.email ||
                              "Unnamed athlete",
                          )
                          .join(", ")}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {reg.checkedInAt ? (
                        <Badge className="bg-green-600 hover:bg-green-600">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Checked In
                        </Badge>
                      ) : (
                        <Badge variant="outline">Not checked in</Badge>
                      )}
                      {!allRequiredSigned && requiredWaivers.length > 0 && (
                        <Badge variant="destructive" className="text-[10px]">
                          Waivers missing
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Right: detail panel */}
      <div>
        {selected ? (
          <RegistrationDetail
            registration={selected}
            waivers={waivers}
            isCheckingIn={pendingCheckInId === selected.id}
            onToggleCheckIn={(checkedIn) =>
              handleToggleCheckIn(selected, checkedIn)
            }
            onSignWaiver={(athlete, waiver) =>
              setWaiverModal({
                athlete,
                waiver,
                registrationId: selected.id,
              })
            }
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Select a team to view check-in details
            </CardContent>
          </Card>
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

interface RegistrationDetailProps {
  registration: CheckInRegistration
  waivers: Waiver[]
  isCheckingIn: boolean
  onToggleCheckIn: (checkedIn: boolean) => void
  onSignWaiver: (athlete: CheckInTeammate, waiver: Waiver) => void
}

function RegistrationDetail({
  registration,
  waivers,
  isCheckingIn,
  onToggleCheckIn,
  onSignWaiver,
}: RegistrationDetailProps) {
  const isCheckedIn = !!registration.checkedInAt
  const requiredWaivers = waivers.filter((w) => w.required)
  const optionalWaivers = waivers.filter((w) => !w.required)

  return (
    <Card>
      <CardContent className="space-y-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">
              {registrationLabel(registration)}
            </h2>
            {registration.divisionLabel && (
              <p className="text-muted-foreground">
                {registration.divisionLabel}
              </p>
            )}
          </div>
          <Button
            size="lg"
            disabled={isCheckingIn}
            variant={isCheckedIn ? "outline" : "default"}
            onClick={() => onToggleCheckIn(!isCheckedIn)}
            className="min-w-[160px]"
          >
            {isCheckingIn ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : isCheckedIn ? (
              <XCircle className="mr-2 h-5 w-5" />
            ) : (
              <CheckCircle2 className="mr-2 h-5 w-5" />
            )}
            {isCheckedIn ? "Undo check-in" : "Check in team"}
          </Button>
        </div>

        {isCheckedIn && registration.checkedInAt && (
          <p className="text-sm text-green-700 dark:text-green-400">
            Checked in {new Date(registration.checkedInAt).toLocaleString()}
          </p>
        )}

        <div className="space-y-3">
          <h3 className="font-semibold">Athletes & Waivers</h3>
          {registration.members.map((member) => {
            const allSignedRequired = requiredWaivers.every(
              (w) => !!member.signedWaivers[w.id],
            )
            return (
              <div
                key={member.userId}
                className="rounded-lg border p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      {member.avatar && (
                        <AvatarImage
                          src={member.avatar}
                          alt={
                            `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim() ||
                            member.email ||
                            ""
                          }
                        />
                      )}
                      <AvatarFallback>
                        {(member.firstName?.[0] ?? "") +
                          (member.lastName?.[0] ?? "") ||
                          member.email?.[0]?.toUpperCase() ||
                          "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {`${member.firstName ?? ""} ${member.lastName ?? ""}`.trim() ||
                          member.email ||
                          "Unnamed athlete"}
                        {member.isCaptain && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (Captain)
                          </span>
                        )}
                      </p>
                      {member.email && (
                        <p className="text-xs text-muted-foreground">
                          {member.email}
                        </p>
                      )}
                    </div>
                  </div>
                  {requiredWaivers.length > 0 ? (
                    allSignedRequired ? (
                      <Badge className="bg-green-600 hover:bg-green-600">
                        All waivers signed
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Waivers missing</Badge>
                    )
                  ) : null}
                </div>

                {waivers.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {[...requiredWaivers, ...optionalWaivers].map((waiver) => {
                      const signedAt = member.signedWaivers[waiver.id]
                      return (
                        <div
                          key={waiver.id}
                          className="flex items-center justify-between gap-2 rounded border bg-muted/30 px-3 py-2 text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {waiver.title}
                              {waiver.required && (
                                <span className="ml-1 text-destructive">*</span>
                              )}
                            </p>
                            {signedAt && (
                              <p className="text-xs text-muted-foreground">
                                Signed{" "}
                                {new Date(signedAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                          {signedAt ? (
                            <Badge variant="outline" className="shrink-0">
                              <CheckCircle2 className="mr-1 h-3 w-3 text-green-600" />
                              Signed
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => onSignWaiver(member, waiver)}
                            >
                              Sign on iPad
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {registration.pendingTeammates.length > 0 && (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <p className="font-medium">Pending teammates (not yet accepted):</p>
              <ul className="mt-1 list-disc pl-5">
                {registration.pendingTeammates.map((p) => (
                  <li key={p.email}>
                    {[p.firstName, p.lastName].filter(Boolean).join(" ") ||
                      p.email}
                    {" — "}
                    {p.email}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function registrationLabel(r: CheckInRegistration): string {
  if (r.teamName) return r.teamName
  const first = r.members[0]
  if (!first) return "Unnamed registration"
  const name = `${first.firstName ?? ""} ${first.lastName ?? ""}`.trim()
  return name || first.email || "Unnamed registration"
}

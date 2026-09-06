import { ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type {
  OwnTrainingResult,
  TrainingContext,
  TrainingTeam,
  TrainingWeek,
} from "@/lib/training/types"
import {
  getTrainingHistoryFn,
  getTrainingWeekFn,
} from "@/server-fns/training-fns"
import {
  getPersonalTrainingDayFn,
  getPersonalTrainingHistoryFn,
  saveTrainingPreferenceFn,
} from "@/server-fns/training-personal-fns"
import { AthletePersonalSession } from "./athlete-personal-session"
import { AthleteTeamResults } from "./athlete-team-results"
import { EarlierTrainingHistory } from "./earlier-training-history"

type TrainingView = "training" | "team" | "progress"

function gymToday(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function offsetDate(date: string, amount: number) {
  const next = new Date(`${date}T12:00:00Z`)
  next.setUTCDate(next.getUTCDate() + amount)
  return next.toISOString().slice(0, 10)
}

function weekStart(date: string) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
  return offsetDate(date, -(weekday === 0 ? 6 : weekday - 1))
}

function dateLabel(
  date: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
  },
) {
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`))
}

export function AthleteTraining({
  context,
  initialView = "training",
  initialTeamId,
  initialDate,
  initialTrackId,
  libraryWorkoutIds,
  libraryWorkoutId,
  onLibraryWorkoutHandled,
}: {
  context: TrainingContext
  initialView?: TrainingView
  initialTeamId?: string
  initialDate?: string
  initialTrackId?: string
  libraryWorkoutIds?: string[]
  libraryWorkoutId?: string
  onLibraryWorkoutHandled?: () => void
}) {
  const [pendingLibraryWorkoutIds, setPendingLibraryWorkoutIds] =
    useState(libraryWorkoutIds)
  useEffect(() => {
    setPendingLibraryWorkoutIds(libraryWorkoutIds)
  }, [libraryWorkoutIds])
  const [pendingLibraryWorkoutId, setPendingLibraryWorkoutId] =
    useState(libraryWorkoutId)
  useEffect(() => {
    setPendingLibraryWorkoutId(libraryWorkoutId)
  }, [libraryWorkoutId])
  const [selectedTeamId, setSelectedTeamId] = useState(
    initialTeamId ?? context.activeTeamId ?? context.teams[0]?.id ?? "",
  )
  const team =
    context.teams.find((item) => item.id === selectedTeamId) ?? context.teams[0]

  if (!team) {
    return (
      <main className="training-shell mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-semibold">Find your training group.</h1>
        <p className="mt-3 max-w-prose text-muted-foreground">
          Join a gym or coaching group to follow its training sessions.
        </p>
        <a
          href="/settings/teams"
          className="mt-6 inline-flex min-h-11 items-center font-medium underline underline-offset-4"
        >
          View your teams
        </a>
      </main>
    )
  }

  return (
    <AthleteTrainingGym
      key={team.id}
      team={team}
      context={context}
      initialView={initialView}
      initialDate={initialDate}
      initialTrackId={
        selectedTeamId ===
        (initialTeamId ?? context.activeTeamId ?? context.teams[0]?.id)
          ? initialTrackId
          : undefined
      }
      libraryWorkoutIds={pendingLibraryWorkoutIds}
      libraryWorkoutId={pendingLibraryWorkoutId}
      onLibraryWorkoutHandled={() => {
        setPendingLibraryWorkoutId(undefined)
        setPendingLibraryWorkoutIds(undefined)
        if (onLibraryWorkoutHandled) onLibraryWorkoutHandled()
        else {
          const url = new URL(window.location.href)
          url.searchParams.delete("workoutId")
          url.searchParams.delete("workoutIds")
          window.history.replaceState(window.history.state, "", url)
        }
      }}
      onTeamChange={setSelectedTeamId}
    />
  )
}

function AthleteTrainingGym({
  team,
  context,
  initialView,
  onTeamChange,
  initialDate,
  initialTrackId,
  libraryWorkoutIds,
  libraryWorkoutId,
  onLibraryWorkoutHandled,
}: {
  team: TrainingTeam
  context: TrainingContext
  initialView: TrainingView
  initialDate?: string
  initialTrackId?: string
  libraryWorkoutIds?: string[]
  libraryWorkoutId?: string
  onLibraryWorkoutHandled: () => void
  onTeamChange: (id: string) => void
}) {
  const [trackId, setTrackId] = useState(
    initialTrackId ?? team.tracks[0]?.id ?? "",
  )
  const [selectedDate, setSelectedDate] = useState(
    () => initialDate ?? gymToday(team.timezone),
  )
  const [view, setView] = useState<TrainingView>(
    team.isPersonal && initialView === "team" ? "training" : initialView,
  )
  const [interactionBusy, setInteractionBusy] = useState(false)
  const [reload, setReload] = useState(0)
  const [week, setWeek] = useState<{ key: string; data: TrainingWeek } | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState("")
  const startDate = weekStart(selectedDate)
  const requestKey = `${team.id}:${trackId}:${startDate}`
  const activeTrack = team.tracks.find((track) => track.id === trackId)
  const data = week?.key === requestKey ? week.data : null
  const session = data?.sessions.find(
    (item) => item.trainingDate === selectedDate,
  )
  const content = session?.published
  const today = gymToday(team.timezone)
  const [defaultTrackId, setDefaultTrackId] = useState<string | null>(null)
  const [preferenceReady, setPreferenceReady] = useState(false)
  const [preferenceSaving, setPreferenceSaving] = useState(false)
  const [preferenceError, setPreferenceError] = useState("")

  useEffect(() => {
    let cancelled = false
    getPersonalTrainingDayFn({
      data: {
        teamId: team.id,
        trainingDate: initialDate ?? gymToday(team.timezone),
        trackId: team.tracks.some((track) => track.id === initialTrackId)
          ? initialTrackId
          : undefined,
      },
    })
      .then((day) => {
        if (!cancelled) {
          if (
            initialTrackId &&
            !team.tracks.some((track) => track.id === initialTrackId)
          )
            setPreferenceError(
              "The linked track is unavailable in this training context. Showing an available track.",
            )
          if (day.defaultUnavailable)
            setPreferenceError(
              "Your saved default is unavailable. Showing an available track without changing your preference.",
            )
          setDefaultTrackId(day.defaultTrackId)
          setTrackId(day.selectedTrackId ?? team.tracks[0]?.id ?? "")
          setPreferenceReady(true)
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setPreferenceError(
            cause instanceof Error
              ? cause.message
              : "Could not load your default track. Refresh to try again.",
          )
          setPreferenceReady(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [team.id, team.timezone, team.tracks, initialDate, initialTrackId])

  useEffect(() => {
    setView(
      team.isPersonal && initialView === "team" ? "training" : initialView,
    )
  }, [initialView, team.isPersonal])

  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry counter intentionally refetches the same request.
  useEffect(() => {
    let cancelled = false
    setError(null)
    setNotice("")
    if (!preferenceReady) return
    if (!trackId) {
      setLoading(false)
      return
    }
    setLoading(true)
    getTrainingWeekFn({
      data: { teamId: team.id, trackId, startDate, mode: "athlete" },
    })
      .then((result) => {
        if (!cancelled) setWeek({ key: requestKey, data: result })
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load your training. Try again.",
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [team.id, trackId, startDate, requestKey, reload, preferenceReady])

  function chooseTrack(id: string) {
    setTrackId(id)
  }

  async function makeDefaultTrack() {
    setPreferenceSaving(true)
    setPreferenceError("")
    try {
      await saveTrainingPreferenceFn({
        data: { teamId: team.id, defaultTrackId: trackId },
      })
      setDefaultTrackId(trackId)
    } catch (cause) {
      setPreferenceError(
        cause instanceof Error
          ? cause.message
          : "Could not save your default track. Try again.",
      )
    } finally {
      setPreferenceSaving(false)
    }
  }

  function saved(result: OwnTrainingResult) {
    setWeek((current) => {
      if (!current || current.key !== requestKey) return current
      return {
        ...current,
        data: {
          ...current.data,
          myResults: [
            ...current.data.myResults.filter((item) => item.id !== result.id),
            result,
          ],
          teamResults: [
            ...current.data.teamResults.filter((item) => item.id !== result.id),
            ...(result.audience === "gym" ? [result] : []),
          ],
        },
      }
    })
    setNotice(
      `Saved ${result.block.title} to ${dateLabel(result.trainingDate)}.`,
    )
  }

  function cheered(id: string, hasCheered: boolean) {
    setWeek((current) =>
      current
        ? {
            ...current,
            data: {
              ...current.data,
              teamResults: current.data.teamResults.map((result) =>
                result.id === id
                  ? {
                      ...result,
                      hasCheered,
                      cheerCount: Math.max(
                        0,
                        result.cheerCount + (hasCheered ? 1 : -1),
                      ),
                    }
                  : result,
              ),
            },
          }
        : current,
    )
  }

  return (
    <main className="training-shell mx-auto w-full max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
      <header className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="break-words text-3xl font-semibold sm:text-4xl">
              {team.name}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {team.isPersonal ? "Personal training" : "Your training group"} ·{" "}
              {team.timezone.replaceAll("_", " ")}
            </p>
          </div>
          {team.canProgram && !team.isPersonal ? (
            <a
              href={`/training/programming?teamId=${encodeURIComponent(team.id)}`}
              className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
            >
              Coach tools
            </a>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {context.teams.length > 1 ? (
            <div className="space-y-2">
              <Label htmlFor="training-gym">Training for</Label>
              <select
                id="training-gym"
                className="min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3"
                disabled={interactionBusy}
                value={team.id}
                onChange={(event) => onTeamChange(event.target.value)}
              >
                {context.teams.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {team.tracks.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="training-track">Training track</Label>
              <select
                id="training-track"
                className="min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3"
                value={trackId}
                disabled={!preferenceReady || interactionBusy}
                onChange={(event) => chooseTrack(event.target.value)}
              >
                {team.tracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.name}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap items-center gap-x-3 text-sm">
                {trackId === defaultTrackId ? (
                  <span className="text-muted-foreground">Default track</span>
                ) : (
                  <Button
                    variant="ghost"
                    className="min-h-11 px-0"
                    disabled={preferenceSaving || !preferenceReady}
                    onClick={makeDefaultTrack}
                  >
                    {preferenceSaving ? "Saving…" : "Make default track"}
                  </Button>
                )}
                {defaultTrackId && trackId !== defaultTrackId ? (
                  <Button
                    variant="ghost"
                    className="min-h-11"
                    onClick={() => chooseTrack(defaultTrackId)}
                  >
                    Back to default
                  </Button>
                ) : null}
              </div>
              {preferenceError ? (
                <p role="alert" className="text-sm text-destructive">
                  {preferenceError}
                </p>
              ) : null}
              {activeTrack?.description ? (
                <p className="text-sm text-muted-foreground">
                  {activeTrack.description}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <nav
          aria-label="Athlete navigation"
          className="flex gap-1 border-b border-border"
        >
          {(["training", "team", "progress"] as const)
            .filter((item) => !team.isPersonal || item !== "team")
            .map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={view === item}
                disabled={interactionBusy}
                onClick={() => setView(item)}
                className={`min-h-12 flex-1 border-b-2 px-2 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:flex-none sm:px-6 ${view === item ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {item === "training"
                  ? "My session"
                  : item === "team"
                    ? "Team"
                    : "My progress"}
              </button>
            ))}
        </nav>
      </header>
      {!activeTrack && preferenceReady && (
        <p className="py-6">
          Choose a track to follow.{" "}
          <a
            href="/programming"
            className="inline-flex min-h-11 items-center underline"
          >
            Browse tracks
          </a>
        </p>
      )}
      {view === "progress" ? (
        <AthleteHistory
          key={`${team.id}:${trackId}:${reload}`}
          teamId={team.id}
          trackId={trackId}
          userId={context.userId}
        />
      ) : (
        <>
          <section aria-label="Training calendar" className="space-y-4 py-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  variant="ghost"
                  className="min-h-11 min-w-11"
                  size="icon"
                  disabled={interactionBusy}
                  aria-label="Previous week"
                  onClick={() => setSelectedDate(offsetDate(selectedDate, -7))}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <span className="text-sm font-medium">
                  {dateLabel(startDate, { month: "short", day: "numeric" })} –{" "}
                  {dateLabel(offsetDate(startDate, 6), {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <Button
                  variant="ghost"
                  className="min-h-11 min-w-11"
                  size="icon"
                  disabled={interactionBusy}
                  aria-label="Next week"
                  onClick={() => setSelectedDate(offsetDate(selectedDate, 7))}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              <div className="flex w-full min-w-0 gap-2 sm:w-auto">
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={interactionBusy}
                  onClick={() => setSelectedDate(today)}
                >
                  Today
                </Button>
                <Input
                  disabled={interactionBusy}
                  type="date"
                  aria-label="Choose training date"
                  className="min-h-11 min-w-0 flex-1 sm:w-40"
                  value={selectedDate}
                  onChange={(event) => {
                    if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value))
                      setSelectedDate(event.target.value)
                  }}
                />
              </div>
            </div>
            <fieldset className="grid min-w-0 grid-cols-7 gap-1">
              <legend className="sr-only">Days of the week</legend>
              {Array.from({ length: 7 }, (_, index) => {
                const day = offsetDate(startDate, index)
                const daySession = data?.sessions.find(
                  (item) => item.trainingDate === day,
                )
                const provider = data?.providerDays?.find(
                  (item) => item.date === day,
                )
                const rest =
                  daySession?.published?.isRestDay ?? provider?.kind === "rest"
                return (
                  <button
                    disabled={interactionBusy}
                    key={day}
                    type="button"
                    aria-label={`${dateLabel(day)}${day === today ? ", today" : ""}${rest ? ", rest day" : daySession?.published || provider ? ", programming published" : ", no programming published"}`}
                    aria-pressed={day === selectedDate}
                    onClick={() => setSelectedDate(day)}
                    className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-md border py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${day === selectedDate ? "border-primary bg-primary/10 font-semibold" : "border-transparent hover:bg-muted"}`}
                  >
                    <span className="text-[11px] sm:text-xs">
                      {dateLabel(day, { weekday: "short" })}
                    </span>
                    <span className="tabular-nums">
                      {Number(day.slice(-2))}
                    </span>
                    <span className="text-[10px] sm:text-xs">
                      {rest
                        ? "Rest"
                        : daySession?.published || provider
                          ? "Workout"
                          : "—"}
                    </span>
                  </button>
                )
              })}
            </fieldset>
          </section>
          <output className="sr-only">{notice}</output>
          {loading || (trackId && !data && !error) ? (
            <output className="block border-t border-border py-12 text-muted-foreground">
              Loading your training…
            </output>
          ) : error ? (
            <div role="alert" className="space-y-4 border-t border-border py-8">
              <p>{error}</p>
              <Button
                variant="outline"
                onClick={() => setReload((value) => value + 1)}
              >
                Try again
              </Button>
            </div>
          ) : view === "training" ? (
            <AthletePersonalSession
              key={`${team.id}:${selectedDate}`}
              team={team}
              trackId={trackId}
              date={selectedDate}
              sourceResults={data?.myResults ?? []}
              onSaved={saved}
              libraryWorkoutId={libraryWorkoutId}
              libraryWorkoutIds={libraryWorkoutIds}
              onLibraryWorkoutHandled={onLibraryWorkoutHandled}
              onInteractionBusy={setInteractionBusy}
            />
          ) : !session || !content ? (
            <section className="border-t border-border py-10">
              <h2 className="text-2xl font-semibold">Not published yet.</h2>
              <p className="mt-3 max-w-prose text-muted-foreground">
                There isn't a published session for {dateLabel(selectedDate)} on{" "}
                {activeTrack?.name ?? "this track"}. Choose another day or check
                your earlier workout schedule.
              </p>
              <a
                className="inline-flex min-h-11 items-center underline"
                href="/programming"
              >
                Browse tracks
              </a>
              <EarlierTrainingLinks />
            </section>
          ) : content.isRestDay ? (
            <section className="border-t border-border py-10">
              <h2 className="break-words text-3xl font-semibold">
                {content.title}
              </h2>
              <p className="mt-2 text-muted-foreground">
                Rest day · {dateLabel(selectedDate)} ·{" "}
                {activeTrack?.name ?? "this track"}
              </p>
              {content.coachNote ? (
                <p className="mt-6 max-w-prose whitespace-pre-wrap break-words leading-relaxed">
                  {content.coachNote}
                </p>
              ) : (
                <p className="mt-6 text-muted-foreground">
                  No training sections to complete today.
                </p>
              )}
            </section>
          ) : view === "team" ? (
            <AthleteTeamResults
              key={`${session.id}:${session.publishedVersion}`}
              session={session}
              results={data?.teamResults ?? []}
              userId={context.userId}
              onCheered={cheered}
            />
          ) : null}
        </>
      )}
    </main>
  )
}

function EarlierTrainingLinks() {
  return (
    <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
      <a
        href="/dashboard"
        className="inline-flex min-h-11 items-center text-muted-foreground underline underline-offset-4"
      >
        Earlier workout schedule
      </a>
      <a
        href="/log"
        className="inline-flex min-h-11 items-center text-muted-foreground underline underline-offset-4"
      >
        Workout log
      </a>
    </div>
  )
}

function AthleteHistory({
  teamId,
  trackId,
  userId,
}: {
  teamId: string
  trackId: string
  userId: string
}) {
  const [history, setHistory] = useState<OwnTrainingResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry counter intentionally refetches the same request.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      trackId
        ? getTrainingHistoryFn({ data: { teamId, trackId } })
        : Promise.resolve([]),
      getPersonalTrainingHistoryFn({ data: { teamId } }),
    ])
      .then(([source, personal]) => {
        if (!cancelled) setHistory([...source, ...personal])
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load your results. Try again.",
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [teamId, trackId, retry])

  return (
    <section className="py-8" aria-labelledby="training-progress-title">
      <h2 id="training-progress-title" className="text-3xl font-semibold">
        Your work, remembered.
      </h2>
      <p className="mt-2 text-muted-foreground">
        Your results on this track and your personal workouts, with the
        prescription you performed.
      </p>
      {loading ? (
        <output className="block py-8">Loading your results…</output>
      ) : error ? (
        <div role="alert" className="space-y-4 py-8">
          <p>{error}</p>
          <Button
            variant="outline"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </Button>
        </div>
      ) : history.length === 0 ? (
        <p className="py-8 text-muted-foreground">
          Your first saved result will appear here. Earlier workout logs are
          available below.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-border border-t border-border">
          {[...history]
            .sort(
              (a, b) =>
                b.trainingDate.localeCompare(a.trainingDate) ||
                b.publishedVersion - a.publishedVersion,
            )
            .map((result) => (
              <li key={result.id} className="py-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="min-w-0 break-words text-lg font-semibold">
                    {result.block.title}
                  </h3>
                  <p className="font-semibold tabular-nums">
                    {result.displayScore}
                    {result.block.kind === "load" ? ` ${result.unit}` : ""}
                  </p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {dateLabel(result.trainingDate, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  · Version {result.publishedVersion} ·{" "}
                  {result.scaling === "rx"
                    ? "Rx"
                    : result.scaling === "scaled"
                      ? "Scaled"
                      : "Custom"}{" "}
                  ·{" "}
                  {result.audience === "private"
                    ? "Only you"
                    : "Shared with gym"}
                </p>
                <details className="mt-2">
                  <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">
                    Prescription and notes
                  </summary>
                  <div className="space-y-3 text-sm">
                    <p className="max-w-prose whitespace-pre-wrap break-words leading-relaxed">
                      {result.block.prescription}
                    </p>
                    {result.modification ? (
                      <p className="whitespace-pre-wrap break-words">
                        <span className="font-medium">
                          Your modifications:{" "}
                        </span>
                        {result.modification}
                      </p>
                    ) : null}
                    {result.notes ? (
                      <p className="whitespace-pre-wrap break-words">
                        <span className="font-medium">Private notes: </span>
                        {result.notes}
                      </p>
                    ) : null}
                  </div>
                </details>
              </li>
            ))}
        </ul>
      )}
      <EarlierTrainingHistory userId={userId} teamId={teamId} />
    </section>
  )
}

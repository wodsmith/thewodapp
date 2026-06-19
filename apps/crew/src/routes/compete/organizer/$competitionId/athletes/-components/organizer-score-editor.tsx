import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  getSchemeLabel,
  getScoreHelpText,
  getScorePlaceholder,
} from "@/components/compete/score-entry-helpers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ScoreStatus } from "@/db/schemas/workouts"
import type { ParseResult, WorkoutScheme } from "@/lib/scoring"
import { decodeScore, parseScore } from "@/lib/scoring"
import { cn } from "@/lib/utils"
import { saveCompetitionScoreFn } from "@/server-fns/competition-score-fns"

const SCORE_STATUS_OPTIONS: { value: ScoreStatus; label: string }[] = [
  { value: "scored", label: "Scored" },
  { value: "cap", label: "Time cap" },
  { value: "dnf", label: "DNF" },
  { value: "dns", label: "DNS" },
  { value: "dq", label: "DQ" },
  { value: "withdrawn", label: "Withdrawn" },
]

const TERMINAL_STATUSES: ReadonlySet<ScoreStatus> = new Set([
  "dnf",
  "dns",
  "dq",
  "withdrawn",
])

interface ScoreEditorEvent {
  id: string
  trackWorkoutId: string
  workoutId: string
  scheme: string
  scoreType: string | null
  timeCap: number | null
  tiebreakScheme: string | null
  repsPerRound: number | null
  roundsToScore: number | null
}

interface ScoreEditorExisting {
  scoreValue: number | null
  scoreStatus: string
  tieBreakScore: number | null
  secondaryScore?: number | null
  scoreRounds?: { roundIndex: number; scoreValue: number }[]
}

interface OrganizerScoreEditorProps {
  event: ScoreEditorEvent
  competitionId: string
  organizingTeamId: string
  registrationId: string
  userId: string
  divisionId: string | null
  existing: ScoreEditorExisting | null
  onCancel: () => void
  onSaved?: () => void
}

function safeDecode(value: number | null | undefined, scheme: string): string {
  if (value == null) return ""
  try {
    return decodeScore(value, scheme as WorkoutScheme, { compact: false })
  } catch {
    return String(value)
  }
}

export function OrganizerScoreEditor({
  event,
  competitionId,
  organizingTeamId,
  registrationId,
  userId,
  divisionId,
  existing,
  onCancel,
  onSaved,
}: OrganizerScoreEditorProps) {
  const router = useRouter()
  const saveScore = useServerFn(saveCompetitionScoreFn)

  const scheme = event.scheme as WorkoutScheme
  const tiebreakScheme = event.tiebreakScheme as WorkoutScheme | null
  const roundsToScore = Math.max(1, event.roundsToScore ?? 1)
  const isMultiRound = roundsToScore > 1
  const timeCap = event.timeCap

  // Initialize with DECODED display values — the same human format the
  // athlete-facing `video-submission-form.tsx` uses, so organizers edit in
  // the same shape the server re-parses on save.
  const existingRoundsByIndex = useMemo(() => {
    const map = new Map<number, number>()
    for (const r of existing?.scoreRounds ?? []) {
      map.set(r.roundIndex, r.scoreValue)
    }
    return map
  }, [existing?.scoreRounds])

  const [scoreInput, setScoreInput] = useState(
    safeDecode(existing?.scoreValue, scheme),
  )
  const [roundScoreInputs, setRoundScoreInputs] = useState<string[]>(() =>
    Array.from({ length: roundsToScore }, (_, i) =>
      safeDecode(existingRoundsByIndex.get(i + 1), scheme),
    ),
  )
  const [scoreStatus, setScoreStatus] = useState<ScoreStatus>(
    (existing?.scoreStatus as ScoreStatus) ?? "scored",
  )
  const [secondaryScore, setSecondaryScore] = useState(
    existing?.secondaryScore != null ? String(existing.secondaryScore) : "",
  )
  const [tiebreak, setTiebreak] = useState(
    safeDecode(existing?.tieBreakScore, tiebreakScheme ?? scheme),
  )
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Parse feedback for single-round input
  const parseResult: ParseResult | null =
    !isMultiRound && scoreInput.trim() ? parseScore(scoreInput, scheme) : null

  // Parse feedback per round for multi-round
  const roundParseResults: (ParseResult | null)[] = isMultiRound
    ? roundScoreInputs.map((s) => (s.trim() ? parseScore(s, scheme) : null))
    : []

  const tiebreakParseResult: ParseResult | null =
    tiebreakScheme && tiebreak.trim()
      ? parseScore(tiebreak, tiebreakScheme)
      : null

  // Auto-derive cap for single-round time-with-cap so the secondary input
  // appears as soon as the parsed time reaches the cap — mirrors the athlete
  // form. Terminal statuses (dnf/dns/dq/withdrawn) always win.
  const effectiveStatus: ScoreStatus = (() => {
    if (TERMINAL_STATUSES.has(scoreStatus)) return scoreStatus
    if (
      !isMultiRound &&
      scheme === "time-with-cap" &&
      timeCap &&
      parseResult?.isValid &&
      parseResult.encoded !== null
    ) {
      const capMs = timeCap * 1000
      if (parseResult.encoded >= capMs) return "cap"
    }
    return scoreStatus
  })()

  const showSecondaryInput =
    !isMultiRound && scheme === "time-with-cap" && effectiveStatus === "cap"

  const isTerminal = TERMINAL_STATUSES.has(scoreStatus)

  const handleSave = async () => {
    setHasAttemptedSubmit(true)

    // Terminal statuses (DNF/DNS/DQ/Withdrawn) record without rounds/score.
    // Scored/cap require a valid score.
    if (!isTerminal) {
      if (isMultiRound) {
        for (let i = 0; i < roundScoreInputs.length; i++) {
          const input = roundScoreInputs[i]
          if (!input.trim()) {
            toast.error(`Please enter a score for round ${i + 1}`)
            return
          }
          const r = parseScore(input, scheme)
          if (!r.isValid) {
            toast.error(`Round ${i + 1}: ${r.error ?? "invalid score"}`)
            return
          }
        }
      } else {
        if (!scoreInput.trim()) {
          toast.error("Please enter a score")
          return
        }
        if (!parseResult?.isValid) {
          toast.error(parseResult?.error ?? "Invalid score")
          return
        }
      }
    }

    if (
      tiebreakScheme &&
      tiebreak.trim() &&
      !tiebreakParseResult?.isValid
    ) {
      toast.error(tiebreakParseResult?.error ?? "Invalid tiebreak")
      return
    }

    setIsSaving(true)
    try {
      await saveScore({
        data: {
          competitionId,
          organizingTeamId,
          trackWorkoutId: event.trackWorkoutId,
          workoutId: event.workoutId,
          registrationId,
          userId,
          divisionId,
          score: isTerminal
            ? ""
            : isMultiRound
              ? ""
              : scoreInput.trim(),
          scoreStatus: effectiveStatus,
          tieBreakScore: tiebreak.trim() || null,
          secondaryScore:
            !isMultiRound && effectiveStatus === "cap"
              ? secondaryScore.trim() || null
              : null,
          roundScores:
            isMultiRound && !isTerminal
              ? roundScoreInputs.map((s) => ({ score: s.trim() }))
              : undefined,
          workout: {
            scheme: event.scheme,
            scoreType: event.scoreType,
            timeCap: event.timeCap,
            tiebreakScheme: event.tiebreakScheme,
            repsPerRound: event.repsPerRound,
            roundsToScore: event.roundsToScore,
          },
        },
      })
      toast.success("Score saved")
      onSaved?.()
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save score",
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Score inputs — single or per-round, matching video-submission-form */}
      {!isTerminal && isMultiRound ? (
        <div className="space-y-3">
          <Label>{getSchemeLabel(scheme)} per Round</Label>
          {roundScoreInputs.map((input, i) => {
            const roundResult = roundParseResults[i]
            return (
              <div key={`${event.id}-round-${i + 1}`} className="space-y-1">
                <Label
                  htmlFor={`score-${event.id}-round-${i}`}
                  className="text-sm font-normal text-muted-foreground"
                >
                  Round {i + 1}
                </Label>
                <Input
                  id={`score-${event.id}-round-${i}`}
                  value={input}
                  onChange={(e) => {
                    const next = [...roundScoreInputs]
                    next[i] = e.target.value
                    setRoundScoreInputs(next)
                  }}
                  placeholder={getScorePlaceholder(scheme)}
                  className={cn(
                    "font-mono",
                    ((roundResult?.error && !roundResult?.isValid) ||
                      (hasAttemptedSubmit && !input.trim())) &&
                      "border-destructive",
                  )}
                  disabled={isSaving}
                />
                {roundResult?.isValid && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Parsed as: {roundResult.formatted}
                  </p>
                )}
                {roundResult?.error && (
                  <p className="text-xs text-destructive">
                    {roundResult.error}
                  </p>
                )}
              </div>
            )
          })}
          {getScoreHelpText(scheme, timeCap) && (
            <p className="text-xs text-muted-foreground">
              {getScoreHelpText(scheme, timeCap)}
            </p>
          )}
          {scheme === "time-with-cap" && timeCap ? (
            <p className="text-[11px] text-muted-foreground">
              Status is derived per round from the time vs the per-round cap.
            </p>
          ) : null}
        </div>
      ) : null}

      {!isTerminal && !isMultiRound ? (
        <div className="space-y-2">
          <Label htmlFor={`score-${event.id}`}>{getSchemeLabel(scheme)}</Label>
          <Input
            id={`score-${event.id}`}
            value={scoreInput}
            onChange={(e) => setScoreInput(e.target.value)}
            placeholder={getScorePlaceholder(scheme)}
            className={cn(
              "font-mono",
              ((parseResult?.error && !parseResult?.isValid) ||
                (hasAttemptedSubmit && !scoreInput.trim())) &&
                "border-destructive",
            )}
            disabled={isSaving}
          />
          {getScoreHelpText(scheme, timeCap) && (
            <p className="text-xs text-muted-foreground">
              {getScoreHelpText(scheme, timeCap)}
            </p>
          )}
          {parseResult?.isValid && (
            <p className="text-xs text-green-600 dark:text-green-400">
              Parsed as: {parseResult.formatted}
              {effectiveStatus === "cap" && " (Time Cap)"}
            </p>
          )}
          {parseResult?.error && (
            <p className="text-xs text-destructive">{parseResult.error}</p>
          )}
        </div>
      ) : null}

      {/* Secondary "reps at cap" input — appears when effective status is cap */}
      {showSecondaryInput && (
        <>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Time cap hit. Enter the reps completed at the cap below.
          </p>
          <div className="space-y-2">
            <Label htmlFor={`secondary-${event.id}`}>
              Reps Completed at Cap
            </Label>
            <Input
              id={`secondary-${event.id}`}
              type="number"
              value={secondaryScore}
              onChange={(e) => setSecondaryScore(e.target.value)}
              placeholder="e.g., 150"
              min="0"
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground">
              Total reps/work completed when the time cap hit
            </p>
          </div>
        </>
      )}

      {/* Tiebreak input — matches athlete form placeholder/help text + parse */}
      {tiebreakScheme && (
        <div className="space-y-2">
          <Label htmlFor={`tb-${event.id}`}>
            Tiebreak ({tiebreakScheme === "time" ? "Time" : "Reps/Weight"})
          </Label>
          <Input
            id={`tb-${event.id}`}
            value={tiebreak}
            onChange={(e) => setTiebreak(e.target.value)}
            placeholder={tiebreakScheme === "time" ? "e.g., 3:45" : "e.g., 100"}
            className={cn(
              "font-mono max-w-xs",
              tiebreakParseResult?.error &&
                !tiebreakParseResult?.isValid &&
                "border-destructive",
            )}
            disabled={isSaving}
          />
          {tiebreakParseResult?.isValid && (
            <p className="text-xs text-green-600 dark:text-green-400">
              Parsed as: {tiebreakParseResult.formatted}
            </p>
          )}
          {tiebreakParseResult?.error && (
            <p className="text-xs text-destructive">
              {tiebreakParseResult.error}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {tiebreakScheme === "time"
              ? "Time to complete specified reps/work"
              : "Reps or weight completed for tiebreak"}
          </p>
        </div>
      )}

      {/* Status select — organizer-only override (terminal statuses + cap) */}
      <div className="space-y-1.5 max-w-xs">
        <Label htmlFor={`status-${event.id}`}>Status</Label>
        <Select
          value={scoreStatus}
          onValueChange={(v) => setScoreStatus(v as ScoreStatus)}
        >
          <SelectTrigger id={`status-${event.id}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCORE_STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {effectiveStatus !== scoreStatus && (
          <p className="text-[11px] text-muted-foreground">
            Status will be recorded as{" "}
            <span className="font-medium">{effectiveStatus}</span> because the
            time reached the cap.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button onClick={handleSave} disabled={isSaving} size="sm">
          {isSaving ? "Saving..." : "Save score"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

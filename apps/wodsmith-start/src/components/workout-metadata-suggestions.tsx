import { Sparkles } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ScoreType, WorkoutScheme } from "@/lib/scoring/types"
import {
  hasWorkoutMetadataSuggestion,
  WORKOUT_METADATA_MIN_DESCRIPTION_LENGTH,
  type WorkoutMetadataSuggestion,
  type WorkoutMetadataWritePermission,
} from "@/lib/workout-metadata-suggestions"

export type WorkoutMetadataSuggestionContext =
  | {
      teamId: string
      writePermission: WorkoutMetadataWritePermission
      competitionId?: never
      competitionTeamId?: never
    }
  | {
      teamId: string
      writePermission?: never
      competitionId: string
      competitionTeamId: string
    }

export function WorkoutMetadataSuggestions({
  context,
  description,
  onApply,
}: {
  context: WorkoutMetadataSuggestionContext
  description: string
  onApply: (suggestion: {
    scheme?: WorkoutScheme
    scoreType?: ScoreType
    movementIds: string[]
  }) => void
}) {
  const [suggestion, setSuggestion] =
    useState<WorkoutMetadataSuggestion | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(false)
  const requestId = useRef(0)
  const deniedContext = useRef<string | null>(null)
  const { teamId, competitionId, competitionTeamId, writePermission } = context
  const contextKey = `${teamId}:${writePermission ?? ""}:${competitionId ?? ""}:${competitionTeamId ?? ""}`

  useEffect(() => {
    const normalizedDescription = description.trim()
    const currentRequestId = ++requestId.current
    setSuggestion(null)
    setError(false)
    if (
      deniedContext.current === contextKey ||
      normalizedDescription.length < WORKOUT_METADATA_MIN_DESCRIPTION_LENGTH
    ) {
      setIsLoading(false)
      return
    }

    const timeout = window.setTimeout(async () => {
      setIsLoading(true)
      try {
        const { suggestWorkoutMetadataFn } = await import(
          "@/server-fns/workout-metadata-suggestion-fns"
        )
        const result = await suggestWorkoutMetadataFn({
          data: {
            teamId,
            writePermission,
            description: normalizedDescription,
            competitionAccess:
              competitionId && competitionTeamId
                ? { competitionId, competitionTeamId }
                : undefined,
          },
        })
        if (currentRequestId !== requestId.current) return
        deniedContext.current = result.hasAccess ? null : contextKey
        if (
          result.hasAccess &&
          hasWorkoutMetadataSuggestion(result.suggestion)
        ) {
          setSuggestion(result.suggestion)
        }
      } catch {
        if (currentRequestId === requestId.current) setError(true)
      } finally {
        if (currentRequestId === requestId.current) setIsLoading(false)
      }
    }, 700)
    return () => window.clearTimeout(timeout)
  }, [
    competitionId,
    competitionTeamId,
    contextKey,
    description,
    teamId,
    writePermission,
  ])

  if (deniedContext.current === contextKey) return null
  if (!isLoading && !suggestion && !error) return null

  return (
    <div
      className="rounded-lg border border-primary/20 bg-primary/5 p-3"
      aria-live="polite"
      data-workout-metadata-suggestions
    >
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="text-sm font-medium">Suggested workout details</div>
          {isLoading && (
            <p className="text-xs text-muted-foreground">
              Reading the description…
            </p>
          )}
          {error && !isLoading && (
            <p className="text-xs text-muted-foreground">
              Suggestions are temporarily unavailable.
            </p>
          )}
          {suggestion && !isLoading && (
            <>
              <div className="flex flex-wrap gap-2">
                {suggestion.scheme && (
                  <Badge variant="secondary">{suggestion.scheme}</Badge>
                )}
                {suggestion.scoreType && (
                  <Badge variant="secondary">
                    Score: {suggestion.scoreType}
                  </Badge>
                )}
                {suggestion.movements.map((movement) => (
                  <Badge key={movement.id} variant="outline">
                    {movement.name}
                  </Badge>
                ))}
              </div>
              <div className="flex items-end justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Review before applying. Your description stays unchanged.
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setSuggestion(null)
                    onApply({
                      scheme: suggestion.scheme,
                      scoreType: suggestion.scoreType,
                      movementIds: suggestion.movements.map(({ id }) => id),
                    })
                  }}
                >
                  Apply
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

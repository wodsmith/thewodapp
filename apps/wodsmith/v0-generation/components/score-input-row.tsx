"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Check } from "lucide-react"
import { parseScore } from "@/lib/score-parser"
import type { AthleteInHeat, WorkoutType, Score } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ScoreInputRowProps {
  athlete: AthleteInHeat
  workoutType: WorkoutType
  timeCap: number
  score?: Score
  divisionBadge?: string
  onScoreChange: (athleteId: string, value: string, tieBreak?: string) => void
  onTabNext: () => void
  autoFocus?: boolean
}

export function ScoreInputRow({
  athlete,
  workoutType,
  timeCap,
  score,
  divisionBadge,
  onScoreChange,
  onTabNext,
  autoFocus,
}: ScoreInputRowProps) {
  const [inputValue, setInputValue] = useState(score?.value || "")
  const [tieBreakValue, setTieBreakValue] = useState(score?.tieBreak || "")
  const [showWarning, setShowWarning] = useState(false)
  const [parseResult, setParseResult] = useState<ReturnType<typeof parseScore> | null>(null)

  const scoreInputRef = useRef<HTMLInputElement>(null)
  const tieBreakInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) {
      scoreInputRef.current?.focus()
    }
  }, [autoFocus])

  const handleScoreChange = (value: string) => {
    setInputValue(value)

    if (!value.trim()) {
      setParseResult(null)
      return
    }

    const result = parseScore(value, workoutType, timeCap)
    setParseResult(result)

    if (result.error || score?.warning) {
      setShowWarning(true)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, field: "score" | "tieBreak") => {
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault()

      if (field === "score") {
        if (parseResult?.needsTieBreak && !tieBreakValue) {
          tieBreakInputRef.current?.focus()
        } else {
          onScoreChange(athlete.id, inputValue, tieBreakValue)
          onTabNext()
        }
      } else {
        onScoreChange(athlete.id, inputValue, tieBreakValue)
        onTabNext()
      }
    }

    if (e.key === "Enter") {
      e.preventDefault()
      if (showWarning) {
        setShowWarning(false)
        onScoreChange(athlete.id, inputValue, tieBreakValue)
      } else {
        onScoreChange(athlete.id, inputValue, tieBreakValue)
        onTabNext()
      }
    }
  }

  const handleConfirmWarning = () => {
    setShowWarning(false)
    onScoreChange(athlete.id, inputValue, tieBreakValue)
    onTabNext()
  }

  const isSaved = score?.status === "saved" || score?.status === "synced"
  const isWarning = showWarning || score?.warning

  return (
    <div
      className={cn(
        "grid grid-cols-[60px_1fr_2fr_1fr_100px] items-center gap-3 border-b p-3 transition-colors",
        isWarning && "bg-warning/10 border-warning",
        isSaved && !isWarning && "bg-success/5",
      )}
    >
      {/* Lane */}
      <div className="text-center font-semibold">{athlete.lane}</div>

      {/* Athlete Name */}
      <div className="min-w-0">
        <div className="truncate font-medium">
          {athlete.lastName}, {athlete.firstName}
        </div>
        {divisionBadge && (
          <Badge variant="outline" className="mt-1 text-xs">
            {divisionBadge}
          </Badge>
        )}
      </div>

      {/* Score Input */}
      <div className="space-y-2">
        <div className="relative">
          <Input
            ref={scoreInputRef}
            value={inputValue}
            onChange={(e) => handleScoreChange(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, "score")}
            placeholder="Enter score..."
            className={cn("h-12 text-base font-mono", isWarning && "border-warning")}
          />
          {parseResult && parseResult.isValid && (
            <div className="mt-1 text-xs text-muted-foreground">Preview: {parseResult.formatted}</div>
          )}
          {parseResult && parseResult.error && <div className="mt-1 text-xs text-destructive">{parseResult.error}</div>}
        </div>

        {/* Warning Message */}
        {isWarning && (
          <div className="flex items-start gap-2 rounded-md bg-warning/20 p-2 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning-foreground" />
            <div className="flex-1">
              <p className="font-medium text-warning-foreground">
                {score?.warning || "Score looks unusual - please verify"}
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" onClick={handleConfirmWarning}>
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowWarning(false)
                    scoreInputRef.current?.focus()
                  }}
                >
                  Edit
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tie-Break Input */}
      <div>
        {parseResult?.needsTieBreak ? (
          <Input
            ref={tieBreakInputRef}
            value={tieBreakValue}
            onChange={(e) => setTieBreakValue(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, "tieBreak")}
            placeholder="Tie-break..."
            className="h-12 text-base font-mono"
          />
        ) : (
          <div className="text-center text-muted-foreground">--</div>
        )}
      </div>

      {/* Status */}
      <div className="text-center">
        {isSaved ? (
          <div className="flex items-center justify-center gap-1.5 text-sm text-success">
            <Check className="h-4 w-4" />
            <span className="hidden sm:inline">Saved</span>
          </div>
        ) : inputValue ? (
          <span className="text-sm text-muted-foreground">Typing...</span>
        ) : (
          <span className="text-sm text-muted-foreground">Pending</span>
        )}
      </div>
    </div>
  )
}

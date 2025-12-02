"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ScoreInputRow } from "@/components/score-input-row"
import { StandardsPopover } from "@/components/standards-popover"
import { ChevronLeft, AlertCircle } from "lucide-react"
import type { HeatWithScores, Score } from "@/lib/types"
import { syncManager } from "@/lib/offline-sync"
import { Badge } from "@/components/ui/badge"

interface ActiveHeatViewProps {
  heat: HeatWithScores
  onBack: () => void
  onComplete: () => void
}

export function ActiveHeatView({ heat, onBack, onComplete }: ActiveHeatViewProps) {
  const [scores, setScores] = useState<Record<string, Score>>(
    heat.scores.reduce(
      (acc, score) => {
        acc[score.athleteId] = score
        return acc
      },
      {} as Record<string, Score>,
    ),
  )
  const [focusedIndex, setFocusedIndex] = useState(0)

  // Get workout details (mock - in real app, fetch from API)
  const workoutType = "for-time" as const
  const defaultTimeCap = 900 // 15:00

  const getStandardsForAthlete = (athleteId: string) => {
    const athlete = heat.athletes.find((a) => a.id === athleteId)
    if (!athlete) return { timeCap: defaultTimeCap }

    if (heat.isMixed && heat.standardsConfig) {
      const config = heat.standardsConfig[athlete.divisionId]
      return config || { timeCap: defaultTimeCap }
    }

    return { timeCap: defaultTimeCap }
  }

  const handleScoreChange = useCallback(
    async (athleteId: string, value: string, tieBreak?: string) => {
      const newScore: Score = {
        athleteId,
        heatId: heat.id,
        value,
        parsedValue: value, // TODO: Use parser
        tieBreak,
        status: "saved",
        lastModified: new Date(),
        modifiedBy: "Current User",
      }

      // Update local state
      setScores((prev) => ({
        ...prev,
        [athleteId]: newScore,
      }))

      // Add to offline sync queue
      await syncManager.addToQueue(newScore)

      console.log("[v0] Score saved for athlete:", athleteId, value)
    },
    [heat.id],
  )

  const handleTabNext = useCallback(() => {
    setFocusedIndex((prev) => Math.min(prev + 1, heat.athletes.length - 1))
  }, [heat.athletes.length])

  const handleMarkAllDNS = () => {
    heat.athletes.forEach((athlete) => {
      if (!scores[athlete.id]) {
        handleScoreChange(athlete.id, "dns")
      }
    })
  }

  const handleSubmitAndNext = () => {
    console.log("[v0] Submitting heat and moving to next")
    onComplete()
  }

  const completedCount = Object.keys(scores).length
  const totalCount = heat.athletes.length

  const standards =
    heat.isMixed && heat.standardsConfig
      ? Object.entries(heat.standardsConfig).map(([divId, config]) => {
          const athlete = heat.athletes.find((a) => a.divisionId === divId)
          return {
            divisionId: divId,
            divisionBadge: athlete?.divisionBadge || "DIV",
            divisionName: divId,
            timeCap: config.timeCap,
            load: config.load,
          }
        })
      : []

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <div className="sticky top-14 z-40 border-b bg-card shadow-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">
                Heat {heat.heatNumber}
                {!heat.isMixed && ` (${heat.divisionName})`}
              </h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {!heat.isMixed && (
                  <>
                    <span>Cap: {Math.floor(defaultTimeCap / 60)}:00</span>
                    <span>•</span>
                  </>
                )}
                <span>
                  {completedCount}/{totalCount} Scores
                </span>
              </div>
            </div>
          </div>

          {heat.isMixed && (
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="gap-1.5">
                <AlertCircle className="h-3 w-3" />
                {standards.length} Standards Active
              </Badge>
              <StandardsPopover standards={standards} />
            </div>
          )}
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[60px_1fr_2fr_1fr_100px] gap-3 border-b bg-muted/30 p-3 text-sm font-medium text-muted-foreground">
        <div className="text-center">LANE</div>
        <div>ATHLETE</div>
        <div>SCORE INPUT</div>
        <div>TIE-BREAK</div>
        <div className="text-center">STATUS</div>
      </div>

      {/* Score Entry Rows */}
      <div className="flex-1">
        {heat.athletes.map((athlete, index) => {
          const athleteStandards = getStandardsForAthlete(athlete.id)

          return (
            <ScoreInputRow
              key={athlete.id}
              athlete={athlete}
              workoutType={workoutType}
              timeCap={athleteStandards.timeCap}
              score={scores[athlete.id]}
              divisionBadge={heat.isMixed ? athlete.divisionBadge : undefined}
              onScoreChange={handleScoreChange}
              onTabNext={handleTabNext}
              autoFocus={index === focusedIndex}
            />
          )
        })}
      </div>

      {/* Bottom Actions */}
      <div className="sticky bottom-0 border-t bg-card p-4 shadow-lg">
        <div className="flex items-center justify-between gap-4">
          <Button variant="outline" onClick={handleMarkAllDNS}>
            Mark All Remaining as DNS
          </Button>
          <Button onClick={handleSubmitAndNext} disabled={completedCount < totalCount} size="lg">
            Submit & Next Heat
          </Button>
        </div>
      </div>
    </div>
  )
}

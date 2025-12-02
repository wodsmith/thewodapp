"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Clock, Users, Lock } from "lucide-react"
import type { HeatWithScores } from "@/lib/types"
import { cn } from "@/lib/utils"

interface HeatCardProps {
  heat: HeatWithScores
  onResume?: () => void
}

export function HeatCard({ heat, onResume }: HeatCardProps) {
  const isLocked = heat.status === "complete"
  const isScoring = heat.status === "scoring"
  const isActive = heat.status === "active" || heat.status === "scoring"

  const statusConfig = {
    upcoming: { label: "Upcoming", variant: "secondary" as const },
    active: { label: "Active", variant: "default" as const },
    scoring: { label: "Scoring", variant: "default" as const },
    complete: { label: "Completed", variant: "outline" as const },
  }

  const status = statusConfig[heat.status]

  return (
    <Card className={cn("p-4 transition-all", isActive && "border-primary bg-primary/5")}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          {/* Heat Header */}
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Heat {heat.heatNumber}</h3>
            <Badge variant={status.variant}>{status.label}</Badge>
            {isLocked && <Lock className="h-4 w-4 text-muted-foreground" />}
            {heat.isMixed && (
              <Badge variant="outline" className="text-warning">
                Mixed Divisions
              </Badge>
            )}
          </div>

          {/* Time */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{new Date(heat.scheduledStartTime).toLocaleTimeString()}</span>
          </div>

          {/* Progress */}
          {isScoring && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {heat.completedCount}/{heat.totalCount} Scores
                </span>
                {heat.lastUpdateBy && (
                  <span className="text-xs text-muted-foreground">Last update by {heat.lastUpdateBy}</span>
                )}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${(heat.completedCount / heat.totalCount) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Athletes count */}
          {!isScoring && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{heat.athletes.length} Athletes</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div>
          {isScoring && onResume && (
            <Button onClick={onResume} size="sm">
              Resume Scoring
            </Button>
          )}
          {heat.status === "active" && onResume && (
            <Button onClick={onResume} size="sm">
              Start Scoring
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

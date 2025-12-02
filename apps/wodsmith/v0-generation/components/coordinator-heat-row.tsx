"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Lock, Unlock, UserCog, Edit } from "lucide-react"
import type { HeatWithScores } from "@/lib/types"
import { cn } from "@/lib/utils"

interface CoordinatorHeatRowProps {
  heat: HeatWithScores
  isLocked: boolean
  onToggleLock: (heatId: string) => void
  onTakeOver: (heatId: string) => void
  onEditLanes: (heatId: string) => void
}

export function CoordinatorHeatRow({ heat, isLocked, onToggleLock, onTakeOver, onEditLanes }: CoordinatorHeatRowProps) {
  const statusColors = {
    upcoming: "text-muted-foreground",
    active: "text-primary",
    scoring: "text-accent",
    complete: "text-success",
  }

  return (
    <div
      className={cn(
        "grid grid-cols-[auto_80px_1fr_120px_1fr_auto] items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/30",
        isLocked && "bg-muted/10",
      )}
    >
      {/* Selection Checkbox */}
      <input type="checkbox" className="h-4 w-4" aria-label={`Select heat ${heat.heatNumber}`} />

      {/* Heat Number */}
      <div className="font-semibold">Heat {heat.heatNumber}</div>

      {/* Division Name */}
      <div className="min-w-0">
        <div className="truncate font-medium">{heat.divisionName}</div>
        {heat.isMixed && (
          <Badge variant="outline" className="mt-1">
            Mixed
          </Badge>
        )}
      </div>

      {/* Status */}
      <div>
        <Badge variant="outline" className={cn("font-medium", statusColors[heat.status])}>
          {heat.status.toUpperCase()}
        </Badge>
      </div>

      {/* Progress */}
      <div className="text-sm">
        {heat.status === "scoring" || heat.status === "complete" ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {heat.completedCount}/{heat.totalCount} scores
              </span>
              {heat.lastUpdateBy && <span className="text-xs text-muted-foreground">by {heat.lastUpdateBy}</span>}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${(heat.completedCount / heat.totalCount) * 100}%`,
                }}
              />
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">{heat.athletes.length} athletes</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onToggleLock(heat.id)}
          title={isLocked ? "Unlock heat" : "Lock heat"}
        >
          {isLocked ? (
            <Lock className="h-4 w-4 text-destructive" />
          ) : (
            <Unlock className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>

        {heat.status === "scoring" && (
          <Button variant="ghost" size="icon" onClick={() => onTakeOver(heat.id)} title="Take over scoring">
            <UserCog className="h-4 w-4" />
          </Button>
        )}

        {heat.status === "upcoming" && (
          <Button variant="ghost" size="icon" onClick={() => onEditLanes(heat.id)} title="Edit lane assignments">
            <Edit className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

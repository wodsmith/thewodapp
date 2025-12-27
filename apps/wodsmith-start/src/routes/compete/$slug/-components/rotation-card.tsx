'use client'

import {Clock, MapPin} from 'lucide-react'
import {Badge} from '@/components/ui/badge'
import {Card, CardContent} from '@/components/ui/card'
import {LANE_SHIFT_PATTERN} from '@/db/schema'
import type {EnrichedRotation} from '@/server-fns/volunteer-schedule-fns'
import {cn} from '@/utils/cn'

interface RotationCardProps {
  rotation: EnrichedRotation
  /** Callback when a division badge is clicked - opens workout details for that division */
  onDivisionClick?: (divisionId: string) => void
  /** Currently selected division ID for highlighting */
  selectedDivisionId?: string | null
}

/**
 * Format a scheduled time for display
 */
function formatTime(date: Date | null): string | null {
  if (!date) return null
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

/**
 * Get the lane number for a specific heat based on lane shift pattern
 */
function getLaneForHeat(
  startingLane: number,
  startingHeat: number,
  heatNumber: number,
  laneShiftPattern: string,
): number {
  if (laneShiftPattern === LANE_SHIFT_PATTERN.SHIFT_RIGHT) {
    return startingLane + (heatNumber - startingHeat)
  }
  return startingLane
}

/**
 * Displays a single judge rotation assignment with each heat on its own row
 * Shows time, lane, and division for maximum clarity
 */
export function RotationCard({
  rotation,
  onDivisionClick,
  selectedDivisionId,
}: RotationCardProps) {
  const {rotation: rot, heats, isUpcoming} = rotation

  const isShifting = rot.laneShiftPattern === LANE_SHIFT_PATTERN.SHIFT_RIGHT

  return (
    <Card
      className={cn(
        'border-l-4',
        isUpcoming ? 'border-l-primary' : 'border-l-muted opacity-70',
      )}
    >
      <CardContent className="py-3 px-4 space-y-3">
        {/* Lane info header */}
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {isShifting
              ? `Starting Lane ${rot.startingLane}`
              : `Lane ${rot.startingLane}`}
          </span>
          {isShifting && (
            <Badge variant="secondary" className="text-xs">
              Shifting
            </Badge>
          )}
        </div>

        {/* Heat rows - each heat gets its own row */}
        <div className="space-y-1.5">
          {heats.map((heat) => {
            const lane = getLaneForHeat(
              rot.startingLane,
              rot.startingHeat,
              heat.heatNumber,
              rot.laneShiftPattern,
            )
            const time = formatTime(heat.scheduledTime)
            const isSelected = heat.divisionId === selectedDivisionId

            return (
              <div
                key={heat.heatNumber}
                className={cn(
                  'flex items-center gap-3 py-1.5 px-2 rounded-md text-sm',
                  'bg-muted/30 hover:bg-muted/50 transition-colors',
                  isSelected && 'bg-primary/10 ring-1 ring-primary/30',
                )}
              >
                {/* Time */}
                <div className="flex items-center gap-1.5 min-w-[90px] text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="font-medium">{time || 'TBD'}</span>
                </div>

                {/* Heat number */}
                <span className="font-semibold min-w-[60px]">
                  Heat {heat.heatNumber}
                </span>

                {/* Lane (show if shifting) */}
                {isShifting && (
                  <span className="text-muted-foreground min-w-[55px]">
                    Lane {lane}
                  </span>
                )}

                {/* Division - clickable */}
                {heat.divisionId && heat.divisionName ? (
                  <button
                    type="button"
                    className={cn(
                      'text-left flex-1 hover:text-primary transition-colors',
                      isSelected && 'text-primary font-medium',
                      onDivisionClick && 'cursor-pointer',
                    )}
                    onClick={() => onDivisionClick?.(heat.divisionId as string)}
                  >
                    {heat.divisionName}
                  </button>
                ) : (
                  <span className="text-muted-foreground flex-1">TBD</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Rotation-specific notes */}
        {rot.notes && (
          <div className="text-sm text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30 rounded px-2 py-1">
            {rot.notes}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

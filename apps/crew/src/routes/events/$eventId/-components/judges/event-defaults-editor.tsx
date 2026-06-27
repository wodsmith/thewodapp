"use client"

// @lat: [[crew#Judge Rotations#Judge Assignments Grid]]

import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LANE_SHIFT_PATTERN, type LaneShiftPattern } from "@/db/schema"
import { updateCrewJudgeEventDefaultsFn } from "@/server-fns/crew-judge-rotations-fns"

const DEBOUNCE_MS = 500

interface EventDefaultsEditorProps {
  eventId: string
  trackWorkoutId: string
  /** Event-level override, or null to use the fallback default. */
  defaultHeatsCount: number | null
  defaultLaneShiftPattern: LaneShiftPattern | null
  minHeatBuffer: number | null
}

const LANE_SHIFT_OPTIONS = [
  {
    value: LANE_SHIFT_PATTERN.STAY,
    label: "Stay in Lane",
    description: "Judges stay in the same lane for all heats",
  },
  {
    value: LANE_SHIFT_PATTERN.SHIFT_RIGHT,
    label: "Shift Lanes",
    description: "Judges rotate one lane to the right after each heat",
  },
] as const

const FALLBACK_HEATS = 4
const FALLBACK_PATTERN: LaneShiftPattern = LANE_SHIFT_PATTERN.STAY
const FALLBACK_BUFFER = 2

/**
 * Inline editor for per-workout judge rotation defaults — default rotation
 * length, lane-shift pattern (stay vs shift right), and minimum heat buffer.
 * Ported from wodsmith-start; persists through Crew's event-defaults server fn.
 */
export function EventDefaultsEditor({
  eventId,
  trackWorkoutId,
  defaultHeatsCount,
  defaultLaneShiftPattern,
  minHeatBuffer,
}: EventDefaultsEditorProps) {
  const router = useRouter()
  const saveDefaults = useServerFn(updateCrewJudgeEventDefaultsFn)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const effectiveHeats = defaultHeatsCount ?? FALLBACK_HEATS
  const effectivePattern = defaultLaneShiftPattern ?? FALLBACK_PATTERN
  const effectiveBuffer = minHeatBuffer ?? FALLBACK_BUFFER

  const [localHeats, setLocalHeats] = useState(effectiveHeats)
  const [localBuffer, setLocalBuffer] = useState(effectiveBuffer)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bufferDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLocalHeats(effectiveHeats)
  }, [effectiveHeats])

  useEffect(() => {
    setLocalBuffer(effectiveBuffer)
  }, [effectiveBuffer])

  async function save(data: {
    defaultHeatsCount?: number
    defaultLaneShiftPattern?: LaneShiftPattern
    minHeatBuffer?: number
  }) {
    setIsSubmitting(true)
    try {
      await saveDefaults({ data: { eventId, trackWorkoutId, ...data } })
      toast.success("Event defaults updated")
      await router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update")
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleHeatsChange(value: string) {
    const newHeats = Number.parseInt(value, 10)
    if (Number.isNaN(newHeats) || newHeats < 1 || newHeats > 20) return
    setLocalHeats(newHeats)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(
      () => save({ defaultHeatsCount: newHeats }),
      DEBOUNCE_MS,
    )
  }

  function handleBufferChange(value: string) {
    const newBuffer = Number.parseInt(value, 10)
    if (Number.isNaN(newBuffer) || newBuffer < 1 || newBuffer > 10) return
    setLocalBuffer(newBuffer)
    if (bufferDebounceRef.current) clearTimeout(bufferDebounceRef.current)
    bufferDebounceRef.current = setTimeout(
      () => save({ minHeatBuffer: newBuffer }),
      DEBOUNCE_MS,
    )
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (bufferDebounceRef.current) clearTimeout(bufferDebounceRef.current)
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Default rotation length */}
      <div className="space-y-2">
        <Label htmlFor="defaultHeatsCount" className="text-sm">
          Default rotation length (heats)
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="defaultHeatsCount"
            type="number"
            min={1}
            max={20}
            value={localHeats}
            onChange={(e) => handleHeatsChange(e.target.value)}
            disabled={isSubmitting}
            className="max-w-[120px]"
          />
          {isSubmitting && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {defaultHeatsCount === null
            ? `Using default (${FALLBACK_HEATS})`
            : "Event-specific override"}
        </p>
      </div>

      {/* Lane shift pattern */}
      <div className="space-y-2">
        <Label htmlFor="defaultLaneShiftPattern" className="text-sm">
          Lane assignment
        </Label>
        <p className="text-xs text-muted-foreground">
          {LANE_SHIFT_OPTIONS.find((opt) => opt.value === effectivePattern)
            ?.description ?? "Select a pattern"}
        </p>
        <Select
          value={effectivePattern}
          onValueChange={(value) =>
            save({ defaultLaneShiftPattern: value as LaneShiftPattern })
          }
          disabled={isSubmitting}
        >
          <SelectTrigger id="defaultLaneShiftPattern" className="max-w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANE_SHIFT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {defaultLaneShiftPattern === null
            ? `Using default (${LANE_SHIFT_OPTIONS.find((opt) => opt.value === FALLBACK_PATTERN)?.label})`
            : "Event-specific override"}
        </p>
      </div>

      {/* Scheduling rules */}
      <div className="space-y-2 border-t pt-4">
        <h3 className="text-sm font-medium">Scheduling Rules</h3>
        <Label htmlFor="minHeatBuffer" className="text-sm">
          Heat buffer between rotations
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="minHeatBuffer"
            type="number"
            min={1}
            max={10}
            value={localBuffer}
            onChange={(e) => handleBufferChange(e.target.value)}
            disabled={isSubmitting}
            className="max-w-[120px]"
          />
          {isSubmitting && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Minimum heats between a judge's rotations.{" "}
          {minHeatBuffer === null
            ? `Using default (${FALLBACK_BUFFER})`
            : "Override"}
        </p>
      </div>
    </div>
  )
}

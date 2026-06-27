"use client"

// @lat: [[crew#Judge Rotations#Judge Assignments Grid]]

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { ChevronDown, Loader2, MousePointer2, Plus, Trash2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select"
import {
  type CompetitionJudgeRotation,
  LANE_SHIFT_PATTERN,
  type LaneShiftPattern,
} from "@/db/schema"
import type { CrewJudgeVolunteer } from "@/server-fns/crew-judge-rotations-fns"
import { getCrewJudgeName } from "./judge-grid-utils"

/** A single rotation block to persist for a volunteer. */
export interface RotationDraft {
  startingHeat: number
  startingLane: number
  heatsCount: number
  notes?: string
}

/** Extended preview cell with block index for multi-rotation preview */
export interface MultiPreviewCell {
  heat: number
  lane: number
  blockIndex: number
}

interface MultiRotationEditorProps {
  maxHeats: number
  maxLanes: number
  availableJudges: CrewJudgeVolunteer[]
  /** All rotations grouped by canonical assignee id (membershipId) */
  rotationsByVolunteer: Map<string, CompetitionJudgeRotation[]>
  existingRotations?: CompetitionJudgeRotation[] // For editing - all rotations for this volunteer
  initialHeat?: number
  initialLane?: number
  externalPosition?: { heat: number; lane: number; timestamp?: number } | null
  activeBlockIndex: number
  onActiveBlockChange: (index: number) => void
  eventLaneShiftPattern: LaneShiftPattern
  eventDefaultHeatsCount: number
  /** Persist this volunteer's full set of rotations (replace semantics). */
  onSave: (membershipId: string, rotations: RotationDraft[]) => Promise<void>
  onSuccess: () => void
  onCancel: () => void
  onPreviewChange?: (cells: MultiPreviewCell[]) => void
  /** Called when judge selection changes (for highlighting existing rotations) */
  onJudgeSelect?: (membershipId: string | null) => void
}

/**
 * Form schema for multiple rotations.
 * Judge selected once, multiple rotation blocks managed with useFieldArray.
 */
const multiRotationSchema = z.object({
  membershipId: z.string().min(1, "Judge is required"),
  rotations: z
    .array(
      z.object({
        startingHeat: z
          .number()
          .int()
          .min(1, "Starting heat must be at least 1"),
        startingLane: z
          .number()
          .int()
          .min(1, "Starting lane must be at least 1"),
        heatsCount: z.number().int().min(1, "Must cover at least 1 heat"),
        notes: z.string().max(500, "Notes too long").optional(),
      }),
    )
    .min(1, "At least one rotation required"),
})

type MultiRotationFormValues = z.infer<typeof multiRotationSchema>

/**
 * Multi-rotation editor component with accordion-style UI.
 * Allows creating/editing multiple rotations for the same volunteer.
 * Each rotation block is collapsible with independent form fields.
 * Preview cells for ALL blocks with different visual treatment per block.
 */
export function MultiRotationEditor({
  maxHeats,
  maxLanes,
  availableJudges,
  rotationsByVolunteer,
  existingRotations,
  initialHeat,
  initialLane,
  externalPosition,
  activeBlockIndex,
  onActiveBlockChange,
  eventLaneShiftPattern,
  eventDefaultHeatsCount,
  onSave,
  onSuccess,
  onCancel,
  onPreviewChange,
  onJudgeSelect,
}: MultiRotationEditorProps) {
  const isEditing = !!existingRotations && existingRotations.length > 0
  // When adding a new rotation (activeBlockIndex >= existingRotations length),
  // start with no blocks open - the new block will be opened when it's added
  // Otherwise, open the first block by default
  const isAddingNewRotation =
    isEditing && activeBlockIndex >= (existingRotations?.length ?? 0)
  const [openBlocks, setOpenBlocks] = useState<Set<number>>(
    isAddingNewRotation ? new Set() : new Set([0]),
  )

  const [isSaving, setIsSaving] = useState(false)

  const form = useForm<MultiRotationFormValues>({
    resolver: standardSchemaResolver(multiRotationSchema),
    defaultValues: {
      membershipId: getRotationAssigneeId(existingRotations?.[0]) ?? "",
      rotations:
        existingRotations && existingRotations.length > 0
          ? existingRotations.map((r) => ({
              startingHeat: r.startingHeat,
              startingLane: r.startingLane,
              heatsCount: r.heatsCount,
              notes: r.notes ?? "",
            }))
          : [
              {
                startingHeat: initialHeat ?? 1,
                startingLane: initialLane ?? 1,
                heatsCount: eventDefaultHeatsCount ?? Math.min(4, maxHeats),
                notes: "",
              },
            ],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "rotations",
  })

  const formValues = form.watch()
  // Use useWatch to trigger re-renders when rotation values change
  const watchedRotations = useWatch({
    control: form.control,
    name: "rotations",
  })

  // Track if we've already auto-added for this activeBlockIndex to prevent double-adds
  const hasAutoAddedRef = useRef(false)

  // Auto-add a new rotation block if activeBlockIndex is beyond current fields
  useEffect(() => {
    if (
      activeBlockIndex >= fields.length &&
      fields.length > 0 &&
      !hasAutoAddedRef.current
    ) {
      hasAutoAddedRef.current = true
      append({
        startingHeat: 1,
        startingLane: 1,
        heatsCount: eventDefaultHeatsCount ?? Math.min(4, maxHeats),
        notes: "",
      })
      setOpenBlocks(new Set([fields.length]))
    }
  }, [
    activeBlockIndex,
    fields.length,
    append,
    eventDefaultHeatsCount,
    maxHeats,
  ])

  /**
   * Calculate the lane for a given heat iteration. Uses the same logic as
   * expandRotationToAssignments in judge-rotation-utils.ts.
   */
  const calculateLane = useCallback(
    (startingLane: number, iteration: number): number => {
      if (eventLaneShiftPattern === LANE_SHIFT_PATTERN.STAY) {
        return startingLane
      }
      // shift_right
      return ((startingLane - 1 + iteration) % maxLanes) + 1
    },
    [eventLaneShiftPattern, maxLanes],
  )

  // Calculate preview cells for ALL rotations
  const previewCells = useMemo(() => {
    if (!watchedRotations) return []

    const allCells: MultiPreviewCell[] = []

    for (
      let blockIndex = 0;
      blockIndex < watchedRotations.length;
      blockIndex++
    ) {
      const rotation = watchedRotations[blockIndex]
      if (!rotation) continue

      for (let i = 0; i < rotation.heatsCount; i++) {
        const heat = rotation.startingHeat + i
        if (heat > maxHeats) break

        const lane = calculateLane(rotation.startingLane, i)
        allCells.push({ heat, lane, blockIndex })
      }
    }

    return allCells
  }, [watchedRotations, maxHeats, calculateLane])

  // Notify parent of preview changes
  useEffect(() => {
    onPreviewChange?.(previewCells)
  }, [previewCells, onPreviewChange])

  // Track last applied timestamp to prevent duplicate updates
  const [lastAppliedTimestamp, setLastAppliedTimestamp] = useState<
    number | null
  >(null)

  // Handle external position updates (click-to-shift for active block ONLY)
  useEffect(() => {
    if (!externalPosition || activeBlockIndex >= fields.length) return

    const timestamp = externalPosition.timestamp ?? 0
    if (timestamp === lastAppliedTimestamp) return

    form.setValue(
      `rotations.${activeBlockIndex}.startingHeat`,
      externalPosition.heat,
      { shouldValidate: true },
    )
    form.setValue(
      `rotations.${activeBlockIndex}.startingLane`,
      externalPosition.lane,
      { shouldValidate: true },
    )

    // Clamp heatsCount so rotation doesn't extend beyond maxHeats
    const currentHeatsCount =
      form.getValues(`rotations.${activeBlockIndex}.heatsCount`) ?? 1
    const maxAllowedHeats = maxHeats - externalPosition.heat + 1
    if (currentHeatsCount > maxAllowedHeats) {
      form.setValue(
        `rotations.${activeBlockIndex}.heatsCount`,
        Math.max(1, maxAllowedHeats),
        { shouldValidate: true },
      )
    }

    setLastAppliedTimestamp(timestamp)
  }, [
    externalPosition,
    activeBlockIndex,
    fields.length,
    form,
    lastAppliedTimestamp,
    maxHeats,
  ])

  async function onSubmit(values: MultiRotationFormValues) {
    // Clamp heatsCount so rotations don't extend beyond maxHeats
    const finalRotations: RotationDraft[] = values.rotations.map((r) => ({
      startingHeat: r.startingHeat,
      startingLane: r.startingLane,
      heatsCount: Math.min(r.heatsCount, maxHeats - r.startingHeat + 1),
      notes: r.notes,
    }))

    if (finalRotations.length === 0) {
      toast.error("At least one rotation is required")
      return
    }

    setIsSaving(true)
    try {
      await onSave(values.membershipId, finalRotations)
      onSuccess()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save rotations"
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleBlock = (index: number) => {
    setOpenBlocks((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const addRotation = () => {
    const newIndex = fields.length
    append({
      startingHeat: 1,
      startingLane: 1,
      heatsCount: eventDefaultHeatsCount ?? Math.min(4, maxHeats),
      notes: "",
    })
    setOpenBlocks((prev) => new Set([...prev, newIndex]))
    onActiveBlockChange(newIndex)
  }

  const removeRotation = (index: number) => {
    if (fields.length > 1) {
      remove(index)
      if (activeBlockIndex === index) {
        onActiveBlockChange(Math.max(0, index - 1))
      } else if (activeBlockIndex > index) {
        onActiveBlockChange(activeBlockIndex - 1)
      }
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Judge Selection - Single selector outside accordion */}
        <FormField
          control={form.control}
          name="membershipId"
          render={({ field }) => {
            // Sort judges by rotation count (fewest first)
            const sortedJudges = [...availableJudges].sort((a, b) => {
              const aCount =
                rotationsByVolunteer.get(a.membershipId)?.length ?? 0
              const bCount =
                rotationsByVolunteer.get(b.membershipId)?.length ?? 0
              return aCount - bCount
            })

            const judgeOptions: SearchableSelectOption[] = sortedJudges.map(
              (judge) => {
                const rotationCount =
                  rotationsByVolunteer.get(judge.membershipId)?.length ?? 0
                const judgeName = getCrewJudgeName(judge)
                const labelWithCredentials = judge.credentials
                  ? `${judgeName} (${judge.credentials})`
                  : judgeName
                const description =
                  rotationCount === 0
                    ? "No rotations"
                    : rotationCount === 1
                      ? "1 rotation"
                      : `${rotationCount} rotations`

                return {
                  value: judge.membershipId,
                  label: labelWithCredentials,
                  description,
                }
              },
            )

            return (
              <FormItem>
                <FormLabel>Judge</FormLabel>
                <FormControl>
                  <SearchableSelect
                    options={judgeOptions}
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value)
                      onJudgeSelect?.(value || null)
                    }}
                    placeholder="Select a judge"
                    searchPlaceholder="Search judges..."
                    emptyMessage="No judges found."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )
          }}
        />

        {/* Rotation Blocks - Accordion/Collapsible */}
        <div className="space-y-2">
          <FormLabel>Rotations</FormLabel>
          {fields.map((field, index) => {
            const rotation = formValues.rotations[index]
            const isOpen = openBlocks.has(index)
            const isActive = activeBlockIndex === index

            return (
              <Collapsible
                key={field.id}
                open={isOpen}
                onOpenChange={() => toggleBlock(index)}
              >
                <div
                  className={`rounded-lg border ${isActive ? "ring-2 ring-primary" : ""}`}
                >
                  {/* Block Header */}
                  <div className="flex items-center justify-between p-3 hover:bg-muted/50">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex flex-1 items-center gap-2 text-left"
                        onClick={() => onActiveBlockChange(index)}
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                        <span className="font-medium">
                          Rotation {index + 1}
                          {rotation && (
                            <span className="ml-2 text-sm text-muted-foreground">
                              {(() => {
                                const endHeat = Math.min(
                                  rotation.startingHeat +
                                    rotation.heatsCount -
                                    1,
                                  maxHeats,
                                )
                                return rotation.startingHeat === endHeat
                                  ? `Heat ${rotation.startingHeat}`
                                  : `Heats ${rotation.startingHeat} - ${endHeat}`
                              })()}
                            </span>
                          )}
                        </span>
                        {isActive && (
                          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            <MousePointer2 className="h-3 w-3" />
                            Active
                          </span>
                        )}
                      </button>
                    </CollapsibleTrigger>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRotation(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Block Content */}
                  <CollapsibleContent>
                    <div className="space-y-3 border-t p-3">
                      {/* Heat, Lane, Count - inline */}
                      <div className="grid grid-cols-3 gap-2">
                        <FormField
                          control={form.control}
                          name={`rotations.${index}.startingHeat`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Heat</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={1}
                                  max={maxHeats}
                                  className="h-8"
                                  {...field}
                                  onChange={(e) =>
                                    field.onChange(Number(e.target.value))
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`rotations.${index}.startingLane`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Lane</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={1}
                                  max={maxLanes}
                                  className="h-8"
                                  {...field}
                                  onChange={(e) =>
                                    field.onChange(Number(e.target.value))
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`rotations.${index}.heatsCount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs"># Heats</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={1}
                                  max={maxHeats}
                                  className="h-8"
                                  {...field}
                                  onChange={(e) =>
                                    field.onChange(Number(e.target.value))
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Notes - compact */}
                      <FormField
                        control={form.control}
                        name={`rotations.${index}.notes`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Notes</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Optional notes..."
                                maxLength={500}
                                className="h-8"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )
          })}

          {/* Add rotation Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRotation}
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add rotation
          </Button>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Update rotations" : "Create rotations"}
          </Button>
        </div>
      </form>
    </Form>
  )
}

/**
 * Canonical assignee id for a stored rotation: the membership id for account-
 * backed judges, otherwise the invitation id for imported / manual judges.
 */
function getRotationAssigneeId(
  rotation:
    | Pick<CompetitionJudgeRotation, "membershipId" | "invitationId">
    | undefined,
): string | undefined {
  if (!rotation) return undefined
  return rotation.membershipId ?? rotation.invitationId ?? undefined
}

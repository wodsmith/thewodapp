"use client"

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine"
import {
  draggable,
  dropTargetForElements,
  type ElementDropTargetEventBasePayload,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { pointerOutsideOfPreview } from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview"
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview"
import {
  attachClosestEdge,
  type Edge,
  extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge"
import { DropIndicator } from "@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box"
import {
  AlertTriangle,
  ChevronDown,
  GripVertical,
  Trash2,
  Users,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/utils/cn"

export interface OrganizerDivisionItemProps {
  id: string
  label: string
  description: string | null
  maxSpots: number | null
  defaultMaxSpots: number | null
  teamSize: number
  index: number
  registrationCount: number
  isOnly: boolean
  instanceId: symbol
  onLabelSave: (value: string) => void
  onTeamSizeSave: (value: number) => void
  onDescriptionSave: (value: string | null) => void
  onMaxSpotsSave: (value: number | null) => void
  onRemove: () => void
  onDrop: (sourceIndex: number, targetIndex: number) => void
}

export function OrganizerDivisionItem({
  id,
  label,
  description,
  maxSpots,
  defaultMaxSpots,
  teamSize,
  index,
  registrationCount,
  isOnly,
  instanceId,
  onLabelSave,
  onTeamSizeSave,
  onDescriptionSave,
  onMaxSpotsSave,
  onRemove,
  onDrop,
}: OrganizerDivisionItemProps) {
  const ref = useRef<HTMLDivElement>(null)
  const dragHandleRef = useRef<HTMLButtonElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null)
  const closestEdgeRef = useRef<Edge | null>(null)
  const [localLabel, setLocalLabel] = useState(label)
  const labelRef = useRef(label)
  const [localDescription, setLocalDescription] = useState(description ?? "")
  const [localMaxSpots, setLocalMaxSpots] = useState(maxSpots?.toString() ?? "")
  const [localTeamSize, setLocalTeamSize] = useState(teamSize.toString())
  const [isExpanded, setIsExpanded] = useState(false)

  const effectiveMaxSpots = maxSpots ?? defaultMaxSpots
  const isOverCapacity =
    effectiveMaxSpots !== null && registrationCount > effectiveMaxSpots
  const isAtCapacity =
    effectiveMaxSpots !== null && registrationCount === effectiveMaxSpots
  const isNearCapacity =
    effectiveMaxSpots !== null &&
    registrationCount < effectiveMaxSpots &&
    registrationCount >= Math.ceil(effectiveMaxSpots * 0.8)
  const capacityState = isOverCapacity
    ? "over"
    : isAtCapacity
      ? "full"
      : isNearCapacity
        ? "near"
        : "open"
  const capacityLabel =
    effectiveMaxSpots === null
      ? `${registrationCount} / unlimited`
      : `${registrationCount} / ${effectiveMaxSpots}`
  const teamSizeLabel = teamSize === 1 ? "Individual" : `Team of ${teamSize}`

  // Sync local state when prop changes (e.g., after server update)
  useEffect(() => {
    setLocalLabel(label)
    labelRef.current = label
  }, [label])

  useEffect(() => {
    setLocalDescription(description ?? "")
  }, [description])

  useEffect(() => {
    setLocalMaxSpots(maxSpots?.toString() ?? "")
  }, [maxSpots])

  useEffect(() => {
    setLocalTeamSize(teamSize.toString())
  }, [teamSize])

  const canDelete = registrationCount === 0 && !isOnly

  const handleMaxSpotsBlur = () => {
    const newVal =
      localMaxSpots.trim() === "" ? null : parseInt(localMaxSpots, 10)
    if (newVal !== maxSpots) {
      if (newVal !== null && (Number.isNaN(newVal) || newVal < 1)) {
        setLocalMaxSpots(maxSpots?.toString() ?? "")
        return
      }
      onMaxSpotsSave(newVal)
    }
  }

  const handleTeamSizeChange = (value: string) => {
    setLocalTeamSize(value)
    const nextTeamSize = Number(value)
    if (Number.isInteger(nextTeamSize) && nextTeamSize !== teamSize) {
      onTeamSizeSave(nextTeamSize)
    }
  }

  useEffect(() => {
    const element = ref.current
    const dragHandle = dragHandleRef.current
    if (!element || !dragHandle) return

    const divisionData = {
      id,
      index,
      instanceId,
    }

    return combine(
      draggable({
        element: dragHandle,
        getInitialData: () => divisionData,
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
        onGenerateDragPreview({ nativeSetDragImage }) {
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: pointerOutsideOfPreview({
              x: "16px",
              y: "8px",
            }),
            render({ container }) {
              const preview = document.createElement("div")
              preview.style.cssText = `
								background: hsl(var(--background));
								border: 2px solid hsl(var(--border));
								border-radius: 6px;
								padding: 8px 12px;
								font-size: 14px;
								color: hsl(var(--foreground));
								box-shadow: 0 2px 8px rgba(0,0,0,0.15);
							`
              preview.textContent = labelRef.current || "Division"
              container.appendChild(preview)
            },
          })
        },
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => {
          return (
            source.data.instanceId === instanceId && source.data.index !== index
          )
        },
        getData({ input }) {
          return attachClosestEdge(divisionData, {
            element,
            input,
            allowedEdges: ["top", "bottom"],
          })
        },
        onDrag({ source, self }: ElementDropTargetEventBasePayload) {
          const isSource = source.data.index === index
          if (isSource) {
            closestEdgeRef.current = null
            setClosestEdge(null)
            return
          }

          const edge = extractClosestEdge(self.data)
          const sourceIndex = source.data.index

          if (typeof sourceIndex !== "number") return

          const isItemBeforeSource = index === sourceIndex - 1
          const isItemAfterSource = index === sourceIndex + 1

          const isDropIndicatorHidden =
            (isItemBeforeSource && edge === "bottom") ||
            (isItemAfterSource && edge === "top")

          if (isDropIndicatorHidden) {
            closestEdgeRef.current = null
            setClosestEdge(null)
            return
          }

          closestEdgeRef.current = edge
          setClosestEdge(edge)
        },
        onDragLeave: () => {
          closestEdgeRef.current = null
          setClosestEdge(null)
        },
        onDrop({ source }) {
          const sourceIndex = source.data.index
          if (typeof sourceIndex === "number" && sourceIndex !== index) {
            const edge = closestEdgeRef.current
            const targetIndex = edge === "top" ? index : index + 1
            const adjustedTargetIndex =
              sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
            onDrop(sourceIndex, adjustedTargetIndex)
          }
          closestEdgeRef.current = null
          setClosestEdge(null)
        },
      }),
    )
  }, [id, index, instanceId, onDrop])

  return (
    <div ref={ref} className="relative">
      {closestEdge && <DropIndicator edge={closestEdge} gap="2px" />}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div
          className={cn(
            "border rounded-lg bg-background transition-colors",
            isDragging && "opacity-50",
            capacityState === "near" && "border-amber-300 bg-amber-50/40",
            capacityState === "full" && "border-orange-300 bg-orange-50/40",
            capacityState === "over" && "border-destructive bg-destructive/5",
          )}
        >
          <div className="grid gap-3 p-3 md:grid-cols-[auto_auto_minmax(12rem,1fr)_9rem_12rem_auto_auto] md:items-center">
            <button
              ref={dragHandleRef}
              type="button"
              className="cursor-grab active:cursor-grabbing justify-self-start"
              aria-label="Drag to reorder"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </button>
            <span className="text-sm font-mono text-muted-foreground w-8">
              #{index + 1}
            </span>
            <div className="space-y-1">
              <label
                htmlFor={`divisionName-${id}`}
                className="text-xs font-medium text-muted-foreground"
              >
                Division
              </label>
              <Input
                id={`divisionName-${id}`}
                value={localLabel}
                onChange={(e) => setLocalLabel(e.target.value)}
                onBlur={() => {
                  if (localLabel !== label) {
                    onLabelSave(localLabel)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && localLabel !== label) {
                    onLabelSave(localLabel)
                    e.currentTarget.blur()
                  }
                }}
                placeholder="Enter division name"
              />
              <Badge variant="secondary" className="w-fit">
                {teamSizeLabel}
              </Badge>
            </div>
            <div className="space-y-1">
              <label
                htmlFor={`teamSize-${id}`}
                className="text-xs font-medium text-muted-foreground"
              >
                Type
              </label>
              <Select
                value={localTeamSize}
                onValueChange={handleTeamSizeChange}
              >
                <SelectTrigger id={`teamSize-${id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size === 1 ? "Individual" : `Team of ${size}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label
                htmlFor={`maxSpots-${id}`}
                className="text-xs font-medium text-muted-foreground"
              >
                Capacity
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id={`maxSpots-${id}`}
                  type="number"
                  min={1}
                  value={localMaxSpots}
                  onChange={(e) => setLocalMaxSpots(e.target.value)}
                  onBlur={handleMaxSpotsBlur}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleMaxSpotsBlur()
                      e.currentTarget.blur()
                    }
                  }}
                  placeholder={
                    defaultMaxSpots ? `${defaultMaxSpots} default` : "Unlimited"
                  }
                  className="min-w-0"
                />
                <Badge
                  variant={capacityState === "over" ? "destructive" : "outline"}
                  className={cn(
                    "shrink-0 gap-1 whitespace-nowrap",
                    capacityState === "near" &&
                      "border-amber-300 text-amber-700",
                    capacityState === "full" &&
                      "border-orange-300 text-orange-700",
                  )}
                >
                  {capacityState !== "open" && (
                    <AlertTriangle className="h-3 w-3" />
                  )}
                  <Users className="h-3 w-3" />
                  {capacityLabel}
                </Badge>
              </div>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={onRemove}
                      disabled={!canDelete}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                {!canDelete && (
                  <TooltipContent>
                    {isOnly
                      ? "Competition must have at least one division"
                      : `Cannot delete: ${registrationCount} athlete${registrationCount > 1 ? "s" : ""} registered`}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={
                  isExpanded
                    ? "Collapse division details"
                    : "Expand division details"
                }
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
          </div>
          {capacityState !== "open" && (
            <div className="px-3 pb-3 md:pl-20">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {capacityState === "near" && (
                  <span className="font-medium text-amber-700">
                    Near capacity
                  </span>
                )}
                {capacityState === "full" && (
                  <span className="font-medium text-orange-700">
                    At capacity
                  </span>
                )}
                {capacityState === "over" && (
                  <span className="font-medium text-destructive">
                    Over capacity
                  </span>
                )}
              </div>
            </div>
          )}
          <CollapsibleContent>
            <div className="px-3 pb-3 pl-3 sm:pl-14 space-y-3">
              <p className="text-xs text-muted-foreground">
                {defaultMaxSpots
                  ? "Blank capacity uses the competition default. Add metadata here for gender, category, or eligibility notes."
                  : "Blank capacity keeps this division unlimited. Add metadata here for gender, category, or eligibility notes."}
              </p>
              <Textarea
                value={localDescription}
                onChange={(e) => setLocalDescription(e.target.value)}
                onBlur={() => {
                  const newDesc = localDescription.trim() || null
                  if (newDesc !== description) {
                    onDescriptionSave(newDesc)
                  }
                }}
                placeholder="Description (optional) - Describe who this division is for"
                className="text-sm"
                rows={2}
              />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  )
}

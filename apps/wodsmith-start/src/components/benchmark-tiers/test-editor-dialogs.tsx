"use client"

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SCORE_TYPES, WORKOUT_SCHEMES } from "@/lib/scoring/types"

export interface TestThresholdInput {
  variant: string
  tier: number
  rawValue: string
}

export interface TestDraft {
  name: string
  categoryKey: string
  scheme: string
  scoreType: string
  inputUnit: string
  includedInScoring: boolean
  scoreModel?: string
  hybridFlipTier?: number | null
  thresholds?: TestThresholdInput[]
}

const HYBRID_SCHEME = "time-with-cap"

/** Schemes whose results are entered as times, so the input unit must be "time". */
function isTimeScheme(scheme: string): boolean {
  return scheme === "time" || scheme === HYBRID_SCHEME
}

/**
 * Hybrid tests store reps completed at the cap for tiers below the flip and
 * finish times for tiers at/above it, so cells need different placeholders.
 */
function hybridTierPlaceholder(
  tier: number,
  hybridFlipTier: number | null | undefined,
): string | undefined {
  if (hybridFlipTier == null) return undefined
  return tier < hybridFlipTier ? "reps" : "mm:ss"
}

export interface CategoryOption {
  key: string
  label: string
}

export interface EventLinkOption {
  id: string
  name: string
  /** Name of the test this event is already linked to, null if unlinked */
  linkedTestName: string | null
  /** Event workout scheme, used to prefill the test editor when known */
  scheme?: string | null
  /** Event workout score type, used to prefill the test editor when known */
  scoreType?: string | null
}

export interface AddTestDialogProps {
  categories: CategoryOption[]
  defaultCategoryKey?: string
  maxTier: number
  variants: string[]
  disabled?: boolean
  /** Competition events offered for linking; unlinked events sort first */
  events?: EventLinkOption[]
  defaultEventId?: string
  /** Fix the linked event (inline creation from an event's edit page) */
  lockEvent?: boolean
  /** Custom dialog trigger; defaults to an "Add event tiers" button */
  trigger?: ReactNode
  onCreate: (
    test: TestDraft,
    linkTrackWorkoutId: string | null,
  ) => Promise<void>
}

export interface EditableTest extends TestDraft {
  id: string
  hasCompleteThresholds: boolean
}

export interface EditTestDialogProps {
  test: EditableTest
  categories: CategoryOption[]
  maxTier: number
  variants: string[]
  disabled?: boolean
  onUpdate: (testId: string, updates: Partial<TestDraft>) => Promise<void>
  onDelete: (testId: string) => Promise<void>
}

const DEFAULT_SCHEME = "reps"
const DEFAULT_SCORE_TYPE = "max"
const DEFAULT_INPUT_UNIT = "reps"

const INPUT_UNIT_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "reps", label: "Reps" },
  { value: "lb", label: "Pounds (lb)" },
  { value: "in", label: "Inches (in)" },
  { value: "ft", label: "Feet (ft)" },
  { value: "cal", label: "Calories (cal)" },
  { value: "m", label: "Meters (m)" },
  { value: "time", label: "Time" },
]

function thresholdKey(variant: string, tier: number): string {
  return `${variant}:${tier}`
}

function allThresholdsFilled(
  values: Record<string, string>,
  variants: string[],
  maxTier: number,
): boolean {
  if (variants.length === 0) return false
  for (const variant of variants) {
    for (let tier = 1; tier <= maxTier; tier++) {
      if ((values[thresholdKey(variant, tier)] ?? "").trim().length === 0) {
        return false
      }
    }
  }
  return true
}

function buildThresholdsArray(
  values: Record<string, string>,
  variants: string[],
  maxTier: number,
): TestThresholdInput[] {
  const thresholds: TestThresholdInput[] = []
  for (const variant of variants) {
    for (let tier = 1; tier <= maxTier; tier++) {
      thresholds.push({
        variant,
        tier,
        rawValue: (values[thresholdKey(variant, tier)] ?? "").trim(),
      })
    }
  }
  return thresholds
}

function ThresholdGrid({
  variants,
  maxTier,
  values,
  onChange,
  disabled,
  hybridFlipTier,
}: {
  variants: string[]
  maxTier: number
  values: Record<string, string>
  onChange: (variant: string, tier: number, value: string) => void
  disabled?: boolean
  hybridFlipTier?: number | null
}) {
  const tiers = Array.from({ length: maxTier }, (_, index) => index + 1)

  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">
        Tier thresholds
      </p>
      {variants.map((variant) => (
        <div key={variant} className="space-y-1">
          <p className="text-sm font-medium capitalize">{variant}</p>
          <div className="flex flex-wrap gap-2">
            {tiers.map((tier) => {
              const key = thresholdKey(variant, tier)
              const id = `threshold-${key}`
              return (
                <div key={tier} className="flex flex-col gap-1">
                  <Label htmlFor={id} className="text-xs text-muted-foreground">
                    T{tier}
                  </Label>
                  <Input
                    id={id}
                    aria-label={`${variant} T${tier}`}
                    value={values[key] ?? ""}
                    onChange={(event) =>
                      onChange(variant, tier, event.target.value)
                    }
                    disabled={disabled}
                    placeholder={hybridTierPlaceholder(tier, hybridFlipTier)}
                    className="h-8 w-16 text-center text-sm tabular-nums"
                  />
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function TestFieldSet({
  idPrefix,
  name,
  onNameChange,
  categories,
  categoryKey,
  onCategoryChange,
  scheme,
  onSchemeChange,
  scoreType,
  onScoreTypeChange,
  inputUnit,
  onInputUnitChange,
  includedInScoring,
  onIncludedChange,
  scoreModel,
  onScoreModelChange,
  hybridFlipTier,
  onHybridFlipTierChange,
  maxTier,
  disabled,
}: {
  idPrefix: string
  name: string
  onNameChange: (value: string) => void
  categories: CategoryOption[]
  categoryKey: string
  onCategoryChange: (value: string) => void
  scheme: string
  onSchemeChange: (value: string) => void
  scoreType: string
  onScoreTypeChange: (value: string) => void
  inputUnit: string
  onInputUnitChange: (value: string) => void
  includedInScoring: boolean
  onIncludedChange: (value: boolean) => void
  scoreModel: string
  onScoreModelChange: (value: string) => void
  hybridFlipTier: number | null
  onHybridFlipTierChange: (value: number | null) => void
  maxTier: number
  disabled?: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Test name</Label>
        <Input
          id={`${idPrefix}-name`}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          disabled={disabled}
          placeholder="e.g. Max pull-ups"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-category`}>Category</Label>
        <Select
          value={categoryKey}
          onValueChange={onCategoryChange}
          disabled={disabled}
        >
          <SelectTrigger id={`${idPrefix}-category`}>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.key} value={category.key}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-scheme`}>Scheme</Label>
          <Select
            value={scheme}
            onValueChange={onSchemeChange}
            disabled={disabled}
          >
            <SelectTrigger id={`${idPrefix}-scheme`}>
              <SelectValue placeholder="Select scheme" />
            </SelectTrigger>
            <SelectContent>
              {WORKOUT_SCHEMES.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-score-type`}>Score type</Label>
          <Select
            value={scoreType}
            onValueChange={onScoreTypeChange}
            disabled={disabled}
          >
            <SelectTrigger id={`${idPrefix}-score-type`}>
              <SelectValue placeholder="Select score type" />
            </SelectTrigger>
            <SelectContent>
              {SCORE_TYPES.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-input-unit`}>Input unit</Label>
          <Select
            value={inputUnit}
            onValueChange={onInputUnitChange}
            disabled={disabled}
          >
            <SelectTrigger id={`${idPrefix}-input-unit`}>
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              {INPUT_UNIT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-score-model`}>Score model</Label>
          <Select
            value={scoreModel}
            onValueChange={onScoreModelChange}
            disabled={disabled}
          >
            <SelectTrigger id={`${idPrefix}-score-model`}>
              <SelectValue placeholder="Select score model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">standard</SelectItem>
              <SelectItem value="hybrid">hybrid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {scoreModel === "hybrid" && (
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-flip-tier`}>First time tier</Label>
            <Input
              id={`${idPrefix}-flip-tier`}
              type="number"
              min={2}
              max={maxTier}
              value={hybridFlipTier ?? ""}
              onChange={(event) => {
                const raw = event.target.value.trim()
                onHybridFlipTierChange(raw === "" ? null : Number(raw))
              }}
              disabled={disabled}
              placeholder="e.g. 9"
            />
          </div>
        )}
      </div>

      {scoreModel === "hybrid" && (
        <p className="text-xs text-muted-foreground">
          Requires the {HYBRID_SCHEME} scheme. Tiers below this one are reps
          completed at the time cap; tiers at or above it are finish times.
        </p>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          id={`${idPrefix}-included`}
          checked={includedInScoring}
          onCheckedChange={(checked) => onIncludedChange(checked === true)}
          disabled={disabled}
        />
        <Label htmlFor={`${idPrefix}-included`}>Included in scoring</Label>
      </div>
    </div>
  )
}

export function AddTestDialog({
  categories,
  defaultCategoryKey,
  maxTier,
  variants,
  disabled,
  events,
  defaultEventId,
  lockEvent,
  trigger,
  onCreate,
}: AddTestDialogProps) {
  const initialCategory = defaultCategoryKey ?? categories[0]?.key ?? ""
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [categoryKey, setCategoryKey] = useState(initialCategory)
  const [scheme, setScheme] = useState<string>(DEFAULT_SCHEME)
  const [scoreType, setScoreType] = useState<string>(DEFAULT_SCORE_TYPE)
  const [inputUnit, setInputUnit] = useState<string>(DEFAULT_INPUT_UNIT)
  const [includedInScoring, setIncludedInScoring] = useState(true)
  const [scoreModel, setScoreModel] = useState<string>("standard")
  const [hybridFlipTier, setHybridFlipTier] = useState<number | null>(null)
  const [thresholds, setThresholds] = useState<Record<string, string>>({})
  const [eventId, setEventId] = useState(defaultEventId ?? "")
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Last name we auto-filled from an event, so switching events replaces it
  // without ever clobbering a name the organizer typed themselves.
  const eventDerivedName = useRef<string | null>(null)

  // Unlinked events first so connecting a fresh event is the default path
  const sortedEvents = events
    ? [...events].sort(
        (a, b) =>
          Number(a.linkedTestName !== null) - Number(b.linkedTestName !== null),
      )
    : []
  const lockedEvent = lockEvent
    ? (events?.find((event) => event.id === defaultEventId) ?? null)
    : null

  const resetForm = () => {
    setName("")
    setCategoryKey(initialCategory)
    setScheme(DEFAULT_SCHEME)
    setScoreType(DEFAULT_SCORE_TYPE)
    setInputUnit(DEFAULT_INPUT_UNIT)
    setIncludedInScoring(true)
    setScoreModel("standard")
    setHybridFlipTier(null)
    setThresholds({})
    setEventId(defaultEventId ?? "")
    eventDerivedName.current = null
  }

  // Time-based schemes are always entered as times, so pick the unit for the
  // organizer; leaving a time scheme drops the auto-picked unit again.
  const handleSchemeChange = (value: string) => {
    setScheme(value)
    if (isTimeScheme(value)) {
      setInputUnit("time")
    } else {
      setInputUnit((current) =>
        current === "time" ? DEFAULT_INPUT_UNIT : current,
      )
    }
  }

  // Derive test config from the linked event; everything stays editable and
  // category, score model, and thresholds remain the organizer's call.
  const applyEventPrefill = (event: EventLinkOption) => {
    if (name.trim().length === 0 || name === eventDerivedName.current) {
      setName(event.name)
    }
    eventDerivedName.current = event.name
    if (event.scheme) handleSchemeChange(event.scheme)
    if (event.scoreType) setScoreType(event.scoreType)
  }

  const handleEventChange = (value: string) => {
    if (value === "none") {
      setEventId("")
      return
    }
    setEventId(value)
    const selected = events?.find((event) => event.id === value)
    if (selected) applyEventPrefill(selected)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      resetForm()
    } else if (lockedEvent) {
      applyEventPrefill(lockedEvent)
    }
    setOpen(next)
  }

  const handleThresholdChange = (
    variant: string,
    tier: number,
    value: string,
  ) => {
    setThresholds((current) => ({
      ...current,
      [thresholdKey(variant, tier)]: value,
    }))
  }

  // Hybrid tests need a flip tier and the time-with-cap scheme to encode
  // "reps at cap" below the flip and "finish time" at/above it.
  const hybridValid =
    scoreModel !== "hybrid" ||
    (hybridFlipTier !== null &&
      Number.isInteger(hybridFlipTier) &&
      hybridFlipTier >= 2 &&
      hybridFlipTier <= maxTier &&
      scheme === HYBRID_SCHEME)

  // Force the compatible scheme when hybrid is selected so the flip encoding
  // stays valid without the organizer hunting for the right scheme.
  const handleScoreModelChange = (value: string) => {
    setScoreModel(value)
    if (value === "hybrid") handleSchemeChange(HYBRID_SCHEME)
  }

  const thresholdsComplete = includedInScoring
    ? allThresholdsFilled(thresholds, variants, maxTier)
    : true
  const isValid =
    name.trim().length > 0 &&
    categoryKey.length > 0 &&
    thresholdsComplete &&
    hybridValid
  const canSave = isValid && !isSubmitting

  const handleCreate = async () => {
    if (!canSave) return
    setIsSubmitting(true)
    try {
      const draft: TestDraft = {
        name: name.trim(),
        categoryKey,
        scheme,
        scoreType,
        inputUnit,
        includedInScoring,
        scoreModel,
        hybridFlipTier: scoreModel === "hybrid" ? hybridFlipTier : null,
      }
      if (includedInScoring) {
        draft.thresholds = buildThresholdsArray(thresholds, variants, maxTier)
      }
      await onCreate(draft, eventId || null)
      resetForm()
      setOpen(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create event tiers",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button disabled={disabled} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add event tiers
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add event tiers</DialogTitle>
          <DialogDescription>
            Set tier thresholds and connect them to an event in this
            competition.
          </DialogDescription>
        </DialogHeader>

        {events !== undefined &&
          (lockedEvent ? (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Linked event</p>
              <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {lockedEvent.name}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="add-test-event">Linked event</Label>
              <Select
                value={eventId || "none"}
                onValueChange={handleEventChange}
                disabled={isSubmitting}
              >
                <SelectTrigger id="add-test-event">
                  <SelectValue placeholder="Select an event" />
                </SelectTrigger>
                {/* Bounded so long event lists scroll instead of filling the screen */}
                <SelectContent className="max-h-80">
                  <SelectItem value="none">No event yet</SelectItem>
                  {sortedEvents.map((event) => (
                    <SelectItem
                      key={event.id}
                      value={event.id}
                      disabled={event.linkedTestName !== null}
                    >
                      {event.name}
                      {event.linkedTestName !== null
                        ? ` (has tiers: ${event.linkedTestName})`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Scores only get tier context once these tiers are connected to
                an event.
              </p>
            </div>
          ))}

        <TestFieldSet
          idPrefix="add-test"
          name={name}
          onNameChange={setName}
          categories={categories}
          categoryKey={categoryKey}
          onCategoryChange={setCategoryKey}
          scheme={scheme}
          onSchemeChange={handleSchemeChange}
          scoreType={scoreType}
          onScoreTypeChange={setScoreType}
          inputUnit={inputUnit}
          onInputUnitChange={setInputUnit}
          includedInScoring={includedInScoring}
          onIncludedChange={setIncludedInScoring}
          scoreModel={scoreModel}
          onScoreModelChange={handleScoreModelChange}
          hybridFlipTier={hybridFlipTier}
          onHybridFlipTierChange={setHybridFlipTier}
          maxTier={maxTier}
          disabled={isSubmitting}
        />

        {includedInScoring && (
          <ThresholdGrid
            variants={variants}
            maxTier={maxTier}
            values={thresholds}
            onChange={handleThresholdChange}
            disabled={isSubmitting}
            hybridFlipTier={
              scoreModel === "hybrid" ? hybridFlipTier : undefined
            }
          />
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} disabled={!canSave}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create event tiers
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EditTestDialog({
  test,
  categories,
  maxTier,
  variants,
  disabled,
  onUpdate,
  onDelete,
}: EditTestDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(test.name)
  const [categoryKey, setCategoryKey] = useState(test.categoryKey)
  const [scheme, setScheme] = useState(test.scheme)
  const [scoreType, setScoreType] = useState(test.scoreType)
  const [inputUnit, setInputUnit] = useState(test.inputUnit)
  const [includedInScoring, setIncludedInScoring] = useState(
    test.includedInScoring,
  )
  const [scoreModel, setScoreModel] = useState<string>(
    test.scoreModel ?? "standard",
  )
  const [hybridFlipTier, setHybridFlipTier] = useState<number | null>(
    test.hybridFlipTier ?? null,
  )
  const [thresholds, setThresholds] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(test.name)
    setCategoryKey(test.categoryKey)
    setScheme(test.scheme)
    setScoreType(test.scoreType)
    setInputUnit(test.inputUnit)
    setIncludedInScoring(test.includedInScoring)
    setScoreModel(test.scoreModel ?? "standard")
    setHybridFlipTier(test.hybridFlipTier ?? null)
    setThresholds({})
  }, [open, test])

  // Time-based schemes are always entered as times, so pick the unit for the
  // organizer; leaving a time scheme falls back to the test's original unit.
  const handleSchemeChange = (value: string) => {
    setScheme(value)
    if (isTimeScheme(value)) {
      setInputUnit("time")
    } else {
      setInputUnit((current) =>
        current === "time"
          ? test.inputUnit !== "time"
            ? test.inputUnit
            : DEFAULT_INPUT_UNIT
          : current,
      )
    }
  }

  // Force the compatible scheme when hybrid is selected so the flip encoding
  // stays valid without hunting for the right scheme.
  const handleScoreModelChange = (value: string) => {
    setScoreModel(value)
    if (value === "hybrid") handleSchemeChange(HYBRID_SCHEME)
  }

  const handleThresholdChange = (
    variant: string,
    tier: number,
    value: string,
  ) => {
    setThresholds((current) => ({
      ...current,
      [thresholdKey(variant, tier)]: value,
    }))
  }

  // Grid only appears when moving a deferred test into scoring and it has no
  // existing threshold rows to edit in the page's main table.
  const showGrid =
    !test.includedInScoring && includedInScoring && !test.hasCompleteThresholds

  // Hybrid tests store the flip tier; other models clear it to null.
  const effectiveFlipTier = scoreModel === "hybrid" ? hybridFlipTier : null
  const originalModel = test.scoreModel ?? "standard"
  const originalFlipTier = test.hybridFlipTier ?? null

  const changes: Partial<TestDraft> = {}
  if (name.trim() !== test.name) changes.name = name.trim()
  if (categoryKey !== test.categoryKey) changes.categoryKey = categoryKey
  if (scheme !== test.scheme) changes.scheme = scheme
  if (scoreType !== test.scoreType) changes.scoreType = scoreType
  if (inputUnit !== test.inputUnit) changes.inputUnit = inputUnit
  if (includedInScoring !== test.includedInScoring) {
    changes.includedInScoring = includedInScoring
  }
  if (scoreModel !== originalModel) changes.scoreModel = scoreModel
  if (effectiveFlipTier !== originalFlipTier) {
    changes.hybridFlipTier = effectiveFlipTier
  }
  if (showGrid) {
    changes.thresholds = buildThresholdsArray(thresholds, variants, maxTier)
  }

  const hybridValid =
    scoreModel !== "hybrid" ||
    (hybridFlipTier !== null &&
      Number.isInteger(hybridFlipTier) &&
      hybridFlipTier >= 2 &&
      hybridFlipTier <= maxTier &&
      scheme === HYBRID_SCHEME)

  const isDirty = Object.keys(changes).length > 0
  const gridComplete = showGrid
    ? allThresholdsFilled(thresholds, variants, maxTier)
    : true
  const isValid = name.trim().length > 0 && gridComplete && hybridValid
  const canSave = isDirty && isValid && !isSubmitting

  const handleUpdate = async () => {
    if (!canSave) return
    setIsSubmitting(true)
    try {
      await onUpdate(test.id, changes)
      setOpen(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update test",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onDelete(test.id)
      setOpen(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete test",
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label={`Edit ${test.name}`}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit benchmark test</DialogTitle>
          <DialogDescription>
            Update this test's configuration or remove it from the benchmark.
          </DialogDescription>
        </DialogHeader>

        <TestFieldSet
          idPrefix="edit-test"
          name={name}
          onNameChange={setName}
          categories={categories}
          categoryKey={categoryKey}
          onCategoryChange={setCategoryKey}
          scheme={scheme}
          onSchemeChange={handleSchemeChange}
          scoreType={scoreType}
          onScoreTypeChange={setScoreType}
          inputUnit={inputUnit}
          onInputUnitChange={setInputUnit}
          includedInScoring={includedInScoring}
          onIncludedChange={setIncludedInScoring}
          scoreModel={scoreModel}
          onScoreModelChange={handleScoreModelChange}
          hybridFlipTier={hybridFlipTier}
          onHybridFlipTierChange={setHybridFlipTier}
          maxTier={maxTier}
          disabled={isSubmitting}
        />

        {showGrid && (
          <ThresholdGrid
            variants={variants}
            maxTier={maxTier}
            values={thresholds}
            onChange={handleThresholdChange}
            disabled={isSubmitting}
            hybridFlipTier={
              scoreModel === "hybrid" ? hybridFlipTier : undefined
            }
          />
        )}

        <div className="rounded-md border border-destructive/30 p-3">
          <p className="text-sm font-medium">Danger zone</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Deleting a test removes it and its thresholds permanently.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="mt-3"
                disabled={isSubmitting || isDeleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete test
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {test.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes {test.name} and all of its tier
                  thresholds. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault()
                    void handleDelete()
                  }}
                  disabled={isDeleting}
                >
                  {isDeleting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleUpdate} disabled={!canSave}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

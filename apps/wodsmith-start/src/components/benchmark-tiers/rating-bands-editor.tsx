"use client"

import { Loader2, Plus, Save, Trash2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface RatingBandDraft {
  key: string
  label: string
  minScore: number
  maxScore: number
}

export interface RatingBandsEditorProps {
  bands: RatingBandDraft[]
  scoreMax: number
  disabled?: boolean
  onSave: (bands: RatingBandDraft[]) => Promise<void>
}

interface BandRow {
  rowId: string
  key: string
  label: string
  minScore: string
  maxScore: string
  isNew: boolean
}

let rowIdCounter = 0
function nextRowId() {
  rowIdCounter += 1
  return `band-row-${rowIdCounter}`
}

function slugify(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[^a-z]+/, "")
  return base || "band"
}

function toRows(bands: RatingBandDraft[]): BandRow[] {
  return bands.map((band) => ({
    rowId: nextRowId(),
    key: band.key,
    label: band.label,
    minScore: String(band.minScore),
    maxScore: String(band.maxScore),
    isNew: false,
  }))
}

function serializeRows(
  rows: Array<{
    key: string
    label: string
    minScore: string
    maxScore: string
  }>,
): string {
  return JSON.stringify(
    rows.map((row) => [row.key, row.label, row.minScore, row.maxScore]),
  )
}

function serializeBands(bands: RatingBandDraft[]): string {
  return serializeRows(
    bands.map((band) => ({
      key: band.key,
      label: band.label,
      minScore: String(band.minScore),
      maxScore: String(band.maxScore),
    })),
  )
}

// Derive the effective, de-duplicated key for every row. Existing bands keep
// their original key; new bands are slugged from their label and suffixed
// (_2, _3, …) to avoid collisions.
function computeEffectiveKeys(rows: BandRow[]): string[] {
  const seen = new Set(rows.filter((row) => !row.isNew).map((row) => row.key))
  return rows.map((row) => {
    if (!row.isNew) return row.key
    const base = slugify(row.label)
    let candidate = base
    let suffix = 2
    while (seen.has(candidate)) {
      candidate = `${base}_${suffix}`
      suffix += 1
    }
    seen.add(candidate)
    return candidate
  })
}

interface RowValidation {
  label?: string
  min?: string
  max?: string
  key?: string
  overlap?: string
}

interface ValidationResult {
  rows: RowValidation[]
  isValid: boolean
}

function validate(
  rows: BandRow[],
  keys: string[],
  scoreMax: number,
): ValidationResult {
  const rowErrors: RowValidation[] = rows.map(() => ({}))

  if (rows.length === 0) {
    return { rows: rowErrors, isValid: false }
  }

  const parsed = rows.map((row) => {
    const min = row.minScore.trim() === "" ? Number.NaN : Number(row.minScore)
    const max = row.maxScore.trim() === "" ? Number.NaN : Number(row.maxScore)
    return { min, max }
  })

  rows.forEach((row, index) => {
    const errors = rowErrors[index]
    const { min, max } = parsed[index]

    if (row.label.trim() === "") {
      errors.label = "Label is required"
    }

    if (Number.isNaN(min)) {
      errors.min = "Required"
    } else if (min < 0 || min > scoreMax) {
      errors.min = `0–${scoreMax}`
    }

    if (Number.isNaN(max)) {
      errors.max = "Required"
    } else if (max < 0 || max > scoreMax) {
      errors.max = `0–${scoreMax}`
    }

    if (
      !Number.isNaN(min) &&
      !Number.isNaN(max) &&
      !errors.min &&
      !errors.max &&
      min > max
    ) {
      errors.max = "Max must be ≥ min"
    }
  })

  // Duplicate keys.
  const keyCounts = new Map<string, number>()
  for (const key of keys) {
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1)
  }
  keys.forEach((key, index) => {
    if ((keyCounts.get(key) ?? 0) > 1) {
      rowErrors[index].key = `Duplicate key "${key}"`
    }
  })

  // Overlapping ranges (inclusive) between valid rows.
  for (let i = 0; i < rows.length; i += 1) {
    const a = parsed[i]
    if (Number.isNaN(a.min) || Number.isNaN(a.max) || a.min > a.max) continue
    for (let j = i + 1; j < rows.length; j += 1) {
      const b = parsed[j]
      if (Number.isNaN(b.min) || Number.isNaN(b.max) || b.min > b.max) continue
      if (a.min <= b.max && b.min <= a.max) {
        rowErrors[i].overlap = "Range overlaps another band"
        rowErrors[j].overlap = "Range overlaps another band"
      }
    }
  }

  const isValid = rowErrors.every(
    (errors) =>
      !errors.label &&
      !errors.min &&
      !errors.max &&
      !errors.key &&
      !errors.overlap,
  )

  return { rows: rowErrors, isValid }
}

export function RatingBandsEditor({
  bands,
  scoreMax,
  disabled = false,
  onSave,
}: RatingBandsEditorProps) {
  const [rows, setRows] = useState<BandRow[]>(() => toRows(bands))
  const [isSaving, setIsSaving] = useState(false)

  const initialSerialized = useMemo(() => serializeBands(bands), [bands])

  // Reset editor state whenever the parent supplies new bands (e.g. after a
  // successful save). Read the latest prop through a ref so the effect only
  // fires when the serialized value actually changes, not on every render.
  const bandsRef = useRef(bands)
  bandsRef.current = bands
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on server state change only
  useEffect(() => {
    setRows(toRows(bandsRef.current))
  }, [initialSerialized])

  const effectiveKeys = useMemo(() => computeEffectiveKeys(rows), [rows])
  const validation = useMemo(
    () => validate(rows, effectiveKeys, scoreMax),
    [rows, effectiveKeys, scoreMax],
  )

  const isDirty = useMemo(
    () => serializeRows(rows) !== initialSerialized,
    [rows, initialSerialized],
  )

  const updateRow = (rowId: string, patch: Partial<BandRow>) => {
    setRows((current) =>
      current.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)),
    )
  }

  const handleAddBand = () => {
    setRows((current) => [
      ...current,
      {
        rowId: nextRowId(),
        key: "",
        label: "",
        minScore: "",
        maxScore: "",
        isNew: true,
      },
    ])
  }

  const handleRemoveBand = (rowId: string) => {
    setRows((current) => current.filter((row) => row.rowId !== rowId))
  }

  const handleSave = async () => {
    if (!validation.isValid) return
    const payload: RatingBandDraft[] = rows
      .map((row, index) => ({
        key: effectiveKeys[index],
        label: row.label.trim(),
        minScore: Number(row.minScore),
        maxScore: Number(row.maxScore),
      }))
      .sort((a, b) => a.minScore - b.minScore)

    setIsSaving(true)
    try {
      await onSave(payload)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save rating bands",
      )
    } finally {
      setIsSaving(false)
    }
  }

  const saveDisabled = disabled || isSaving || !isDirty || !validation.isValid

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rating Bands</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Bands label athletes by total score. Ranges must stay within 0–
          {scoreMax} and cannot overlap.
        </p>

        <div className="space-y-3">
          {rows.map((row, index) => {
            const errors = validation.rows[index] ?? {}
            const rowNumber = index + 1
            return (
              <div
                key={row.rowId}
                className="rounded-md border p-3 sm:p-4"
                data-testid={`band-row-${index}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-1">
                    <Label
                      htmlFor={`${row.rowId}-label`}
                      className="text-xs uppercase text-muted-foreground"
                    >
                      Label
                    </Label>
                    <Input
                      id={`${row.rowId}-label`}
                      aria-label={`Rating band ${rowNumber} label`}
                      aria-invalid={errors.label ? true : undefined}
                      value={row.label}
                      disabled={disabled}
                      onChange={(event) =>
                        updateRow(row.rowId, { label: event.target.value })
                      }
                    />
                  </div>
                  <div className="w-full space-y-1 sm:w-24">
                    <Label
                      htmlFor={`${row.rowId}-min`}
                      className="text-xs uppercase text-muted-foreground"
                    >
                      Min
                    </Label>
                    <Input
                      id={`${row.rowId}-min`}
                      type="number"
                      aria-label={`Rating band ${rowNumber} minimum score`}
                      aria-invalid={
                        errors.min || errors.overlap ? true : undefined
                      }
                      value={row.minScore}
                      disabled={disabled}
                      className="tabular-nums"
                      onChange={(event) =>
                        updateRow(row.rowId, { minScore: event.target.value })
                      }
                    />
                  </div>
                  <div className="w-full space-y-1 sm:w-24">
                    <Label
                      htmlFor={`${row.rowId}-max`}
                      className="text-xs uppercase text-muted-foreground"
                    >
                      Max
                    </Label>
                    <Input
                      id={`${row.rowId}-max`}
                      type="number"
                      aria-label={`Rating band ${rowNumber} maximum score`}
                      aria-invalid={
                        errors.max || errors.overlap ? true : undefined
                      }
                      value={row.maxScore}
                      disabled={disabled}
                      className="tabular-nums"
                      onChange={(event) =>
                        updateRow(row.rowId, { maxScore: event.target.value })
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove rating band ${rowNumber}`}
                    disabled={disabled}
                    onClick={() => handleRemoveBand(row.rowId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {(errors.label ||
                  errors.min ||
                  errors.max ||
                  errors.key ||
                  errors.overlap) && (
                  <ul className="mt-2 space-y-0.5 text-xs text-destructive">
                    {errors.label && <li>{errors.label}</li>}
                    {errors.min && <li>Min score: {errors.min}</li>}
                    {errors.max && <li>Max score: {errors.max}</li>}
                    {errors.overlap && <li>{errors.overlap}</li>}
                    {errors.key && <li>{errors.key}</li>}
                  </ul>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleAddBand}
            disabled={disabled}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add band
          </Button>
          <Button type="button" onClick={handleSave} disabled={saveDisabled}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save rating bands
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

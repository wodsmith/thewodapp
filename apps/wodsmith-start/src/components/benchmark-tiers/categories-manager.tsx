"use client"

import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from "lucide-react"
import type { JSX } from "react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export interface CategoryDraft {
  key: string
  label: string
  weight: number
}

export interface CategorySummaryItem extends CategoryDraft {
  totalTestCount: number
}

export interface CategoriesManagerProps {
  categories: CategorySummaryItem[]
  disabled?: boolean
  onSave: (categories: CategoryDraft[]) => Promise<void>
}

interface CategoryRow {
  /** Stable internal id for React keys and reorder tracking. */
  rowId: string
  /** Immutable key for existing categories; empty for new rows (derived from label). */
  key: string
  label: string
  /** Weight held as a string so the input can be cleared while editing. */
  weight: string
  totalTestCount: number
  isNew: boolean
}

const DELETE_HINT = "Move or delete its tests first"

function slugify(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^[^a-z]+/, "")
    .replace(/_+$/, "")
  return base || "category"
}

/**
 * Resolves the persisted key for every row. Existing categories keep their
 * immutable key; new rows are slugged from their label and deduped with a
 * numeric suffix so keys stay unique.
 */
function resolveKeys(rows: CategoryRow[]): string[] {
  const used = new Set<string>()
  for (const row of rows) {
    if (!row.isNew) used.add(row.key)
  }
  return rows.map((row) => {
    if (!row.isNew) return row.key
    const base = slugify(row.label)
    let candidate = base
    let suffix = 2
    while (used.has(candidate)) {
      candidate = `${base}_${suffix}`
      suffix += 1
    }
    used.add(candidate)
    return candidate
  })
}

function toRows(categories: CategorySummaryItem[]): CategoryRow[] {
  return categories.map((category, index) => ({
    rowId: `existing-${category.key}-${index}`,
    key: category.key,
    label: category.label,
    weight: String(category.weight),
    totalTestCount: category.totalTestCount,
    isNew: false,
  }))
}

function serializeCategories(categories: CategoryDraft[]): string {
  return JSON.stringify(
    categories.map((category) => [category.key, category.label, category.weight]),
  )
}

export function CategoriesManager({
  categories,
  disabled = false,
  onSave,
}: CategoriesManagerProps): JSX.Element {
  const [rows, setRows] = useState<CategoryRow[]>(() => toRows(categories))
  const [isSaving, setIsSaving] = useState(false)

  // Reset the working draft whenever the server state changes (e.g. after a
  // save from this form or another editor on the page).
  const categoriesSignature = serializeCategories(categories)
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on server state change only
  useEffect(() => {
    setRows(toRows(categories))
  }, [categoriesSignature])

  const resolvedKeys = useMemo(() => resolveKeys(rows), [rows])

  const payload = useMemo<CategoryDraft[]>(
    () =>
      rows.map((row, index) => ({
        key: resolvedKeys[index],
        label: row.label.trim(),
        weight: Number(row.weight),
      })),
    [rows, resolvedKeys],
  )

  const validation = useMemo(() => {
    if (rows.length === 0) return { valid: false }
    const seen = new Set<string>()
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]
      const label = row.label.trim()
      if (label.length < 1 || label.length > 80) return { valid: false }
      const weight = Number(row.weight)
      if (row.weight.trim() === "" || Number.isNaN(weight) || weight <= 0) {
        return { valid: false }
      }
      const key = resolvedKeys[index]
      if (seen.has(key)) return { valid: false }
      seen.add(key)
    }
    return { valid: true }
  }, [rows, resolvedKeys])

  const isDirty = useMemo(() => {
    const original = categories.map((category) => ({
      key: category.key,
      label: category.label,
      weight: category.weight,
    }))
    return JSON.stringify(original) !== JSON.stringify(payload)
  }, [categories, payload])

  const canSave = !disabled && !isSaving && validation.valid && isDirty

  // Live share of the overall score per row, so "weight" means something
  // concrete while the organizer edits.
  const totalWeight = rows.reduce((sum, row) => {
    const weight = Number(row.weight)
    return Number.isFinite(weight) && weight > 0 ? sum + weight : sum
  }, 0)

  const updateRow = (rowId: string, patch: Partial<CategoryRow>) => {
    setRows((current) =>
      current.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)),
    )
  }

  const moveRow = (index: number, direction: -1 | 1) => {
    setRows((current) => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)
      return next
    })
  }

  const deleteRow = (rowId: string) => {
    setRows((current) => current.filter((row) => row.rowId !== rowId))
  }

  const addRow = () => {
    setRows((current) => [
      ...current,
      {
        rowId: `new-${Date.now()}-${current.length}`,
        key: "",
        label: "",
        weight: "1",
        totalTestCount: 0,
        isNew: true,
      },
    ])
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(payload)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save categories",
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle>Categories</CardTitle>
        <CardDescription>
          Group your tests into categories (like Strength or Engine) and set
          how much each one counts toward the overall score. A category with
          weight 2 counts twice as much as one with weight 1.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="space-y-3">
            {rows.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                No categories yet. Add one to get started.
              </p>
            ) : (
              rows.map((row, index) => {
                const canDelete = row.totalTestCount === 0
                const weight = Number(row.weight)
                const share =
                  totalWeight > 0 && Number.isFinite(weight) && weight > 0
                    ? Math.round((weight / totalWeight) * 100)
                    : null
                return (
                  <div
                    key={row.rowId}
                    className="flex items-start gap-2 rounded-md border p-3"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="flex-1 space-y-1">
                          <Label
                            htmlFor={`category-label-${row.rowId}`}
                            className="sr-only"
                          >
                            Category label
                          </Label>
                          <Input
                            id={`category-label-${row.rowId}`}
                            value={row.label}
                            placeholder="Category label"
                            maxLength={80}
                            onChange={(event) =>
                              updateRow(row.rowId, {
                                label: event.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="w-full space-y-1 sm:w-28">
                          <Label
                            htmlFor={`category-weight-${row.rowId}`}
                            className="sr-only"
                          >
                            Category weight
                          </Label>
                          <Input
                            id={`category-weight-${row.rowId}`}
                            type="number"
                            min={0}
                            step="any"
                            value={row.weight}
                            placeholder="Weight"
                            className="tabular-nums"
                            onChange={(event) =>
                              updateRow(row.rowId, {
                                weight: event.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {row.totalTestCount} test
                        {row.totalTestCount === 1 ? "" : "s"}
                        {share !== null &&
                          ` · counts for ${share}% of the overall score`}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${row.label || "category"} up`}
                        disabled={index === 0}
                        onClick={() => moveRow(index, -1)}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${row.label || "category"} down`}
                        disabled={index === rows.length - 1}
                        onClick={() => moveRow(index, 1)}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${row.label || "category"}`}
                              disabled={!canDelete}
                              onClick={() => deleteRow(row.rowId)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {!canDelete && (
                          <TooltipContent>{DELETE_HINT}</TooltipContent>
                        )}
                      </Tooltip>
                    </div>
                  </div>
                )
              })
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="outline" onClick={addRow}>
                <Plus className="mr-2 h-4 w-4" />
                Add category
              </Button>
              <Button type="button" onClick={handleSave} disabled={!canSave}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save categories
              </Button>
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}

"use client"

// @lat: [[crew#Role And Shift Templates]]
import { Save, WandSparkles } from "lucide-react"
import { useMemo, useState } from "react"
import { VOLUNTEER_ROLE_LABELS } from "@/db/schemas/volunteers"
import {
  buildCrewTemplateApplyPlan,
  buildCrewTemplatePreview,
  type CrewRoleShiftTemplate,
  type CrewRoleShiftTemplateRef,
} from "@/lib/crew/templates"
import type { CrewTemplatePageData } from "@/server-fns/crew-template-fns"

interface CrewTemplatePanelProps {
  templatePage: CrewTemplatePageData
  onApply: (input: {
    templateRef: CrewRoleShiftTemplateRef
    fillEmptyAssumptions: boolean
  }) => Promise<void>
  onSavePreset: (input: {
    templateRef: CrewRoleShiftTemplateRef
    name: string
  }) => Promise<void>
}

export function CrewTemplatePanel({
  templatePage,
  onApply,
  onSavePreset,
}: CrewTemplatePanelProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    templatePage.templates[0]?.id ?? "",
  )
  const [fillEmptyAssumptions, setFillEmptyAssumptions] = useState(true)
  const [presetName, setPresetName] = useState("")
  const [isApplying, setIsApplying] = useState(false)
  const [isSavingPreset, setIsSavingPreset] = useState(false)
  const selectedTemplate =
    templatePage.templates.find(
      (template) => template.id === selectedTemplateId,
    ) ?? templatePage.templates[0]
  const preview = useMemo(
    () =>
      selectedTemplate
        ? buildCrewTemplatePreview(selectedTemplate, templatePage.context)
        : null,
    [selectedTemplate, templatePage.context],
  )
  const applyPlan = preview
    ? buildCrewTemplateApplyPlan(preview, { fillEmptyAssumptions })
    : null
  const templateRef = selectedTemplate ? getTemplateRef(selectedTemplate) : null

  async function handleApply() {
    if (!templateRef || !applyPlan) return
    setIsApplying(true)
    try {
      await onApply({ templateRef, fillEmptyAssumptions })
    } finally {
      setIsApplying(false)
    }
  }

  async function handleSavePreset() {
    if (!templateRef || !presetName.trim()) return
    setIsSavingPreset(true)
    try {
      await onSavePreset({ templateRef, name: presetName })
      setPresetName("")
    } finally {
      setIsSavingPreset(false)
    }
  }

  if (!selectedTemplate || !preview || !applyPlan) {
    return null
  }

  return (
    <section className="rounded-md border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Role and shift templates</h2>
          <p className="text-sm text-muted-foreground">
            Preview common staffing patterns, append missing shifts, and save
            team presets.
          </p>
        </div>
        <span className="inline-flex rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground">
          {templatePage.context.existingShifts.length} existing shifts
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(16rem,22rem)_1fr]">
        <div className="space-y-4">
          <label className="space-y-2">
            <span className="text-sm font-medium">Template</span>
            <select
              value={selectedTemplate.id}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              {templatePage.templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.source === "team_preset" ? "Preset: " : ""}
                  {template.name}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-md border bg-background p-3 text-sm">
            <p className="font-medium">{selectedTemplate.name}</p>
            <p className="mt-1 text-muted-foreground">
              {selectedTemplate.description}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <Metric label="Roles" value={preview.summary.roles} />
              <Metric label="New" value={preview.summary.newShifts} />
              <Metric label="Skipped" value={preview.summary.duplicateShifts} />
            </div>
          </div>

          <label className="flex items-start gap-2 rounded-md border bg-background p-3 text-sm">
            <input
              type="checkbox"
              checked={fillEmptyAssumptions}
              disabled={!preview.summary.canFillAssumptions}
              onChange={(event) =>
                setFillEmptyAssumptions(event.target.checked)
              }
              className="mt-0.5 size-4"
            />
            <span>
              Fill empty staffing assumptions
              {!preview.summary.canFillAssumptions ? (
                <span className="block text-xs text-muted-foreground">
                  Existing assumptions will not be overwritten.
                </span>
              ) : null}
            </span>
          </label>

          <button
            type="button"
            disabled={
              isApplying ||
              (applyPlan.shiftsToCreate.length === 0 &&
                !applyPlan.assumptionsToWrite)
            }
            onClick={handleApply}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <WandSparkles className="size-4" aria-hidden="true" />
            {isApplying ? "Applying..." : "Apply missing shifts"}
          </button>

          <div className="grid gap-2">
            <label className="space-y-2">
              <span className="text-sm font-medium">Save as team preset</span>
              <input
                value={presetName}
                maxLength={255}
                onChange={(event) => setPresetName(event.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={isSavingPreset || !presetName.trim()}
              onClick={handleSavePreset}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted disabled:opacity-60"
            >
              <Save className="size-4" aria-hidden="true" />
              {isSavingPreset ? "Saving..." : "Save preset"}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {preview.summary.warnings.length > 0 ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800">
              {preview.summary.warnings.join(" ")}
            </div>
          ) : null}

          <div>
            <h3 className="text-sm font-semibold">Roles</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {preview.roles.map((role) => (
                <div
                  key={role.roleType}
                  className="rounded-md border bg-background p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">
                      {VOLUNTEER_ROLE_LABELS[role.roleType]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {role.targetCount}
                    </span>
                  </div>
                  {role.notes ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {role.notes}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Shifts</h3>
            <div className="mt-2 overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Shift</th>
                    <th className="px-3 py-2 font-medium">Window</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.shifts.map((shift) => (
                    <tr key={shift.key} className="border-t">
                      <td className="px-3 py-2">
                        <div className="font-medium">{shift.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {shift.location ?? "No location"} / cap{" "}
                          {shift.capacity}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {shift.date
                          ? `${shift.date} ${shift.startTime}-${shift.endTime}`
                          : `${shift.startTime}-${shift.endTime}`}
                      </td>
                      <td className="px-3 py-2">
                        {VOLUNTEER_ROLE_LABELS[shift.roleType]}
                      </td>
                      <td className="px-3 py-2">
                        <ShiftStatus status={shift.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Assumptions</h3>
            <p className="mt-2 rounded-md border bg-background p-3 text-sm text-muted-foreground">
              {preview.staffingAssumptions || "No assumptions in template."}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-card px-2 py-2">
      <div className="font-semibold">{value}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  )
}

function ShiftStatus({
  status,
}: {
  status: "new" | "already_exists" | "outside_event_dates"
}) {
  const label =
    status === "new"
      ? "Will add"
      : status === "already_exists"
        ? "Exists"
        : "Outside dates"
  const className =
    status === "new"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800"
      : status === "already_exists"
        ? "border-muted bg-muted text-muted-foreground"
        : "border-amber-500/30 bg-amber-500/10 text-amber-800"

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  )
}

function getTemplateRef(
  template: CrewRoleShiftTemplate,
): CrewRoleShiftTemplateRef {
  return template.source === "team_preset" && template.presetId
    ? { source: "team_preset", presetId: template.presetId }
    : { source: "built_in", templateId: template.id }
}

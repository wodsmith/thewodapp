// @lat: [[crew#Guided Setup State]]
import { Link } from "@tanstack/react-router"
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  CircleDot,
  Save,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import {
  crewGuidedSetupStatusLabels,
  type CrewGuidedSetupOperatorStatus,
  type CrewGuidedSetupState,
  type CrewGuidedSetupStatus,
  type CrewGuidedSetupStep,
  type CrewGuidedSetupStepKey,
} from "@/lib/crew/guided-setup"

type StatusControlValue = CrewGuidedSetupOperatorStatus | "system"

interface GuidedSetupShellProps {
  eventId: string
  guidedSetup: CrewGuidedSetupState
  onUpdate: (input: {
    stepKey: CrewGuidedSetupStepKey
    status: CrewGuidedSetupOperatorStatus | null
    note: string
  }) => Promise<void>
}

const statusOptions: Array<{
  value: StatusControlValue
  label: string
}> = [
  { value: "system", label: "Use source state" },
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "complete", label: "Complete" },
]

export function GuidedSetupShell({
  eventId,
  guidedSetup,
  onUpdate,
}: GuidedSetupShellProps) {
  const [activeStepKey, setActiveStepKey] = useState<CrewGuidedSetupStepKey>(
    guidedSetup.activeStep,
  )
  const activeStep = useMemo(
    () =>
      guidedSetup.steps.find((step) => step.key === activeStepKey) ??
      guidedSetup.steps[0],
    [activeStepKey, guidedSetup.steps],
  )
  const [status, setStatus] = useState<StatusControlValue>(
    activeStep.operatorStatus ?? "system",
  )
  const [note, setNote] = useState(activeStep.note)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setActiveStepKey(guidedSetup.activeStep)
  }, [guidedSetup.activeStep])

  useEffect(() => {
    setStatus(activeStep.operatorStatus ?? "system")
    setNote(activeStep.note)
  }, [activeStep])

  async function handleSave() {
    setIsSaving(true)
    try {
      await onUpdate({
        stepKey: activeStep.key,
        status: status === "system" ? null : status,
        note,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="rounded-md border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Guided setup</h2>
          <p className="text-sm text-muted-foreground">
            {guidedSetup.summary.complete}/{guidedSetup.summary.total} steps
            complete
          </p>
        </div>
        <StatusBadge status={guidedSetup.summary.highestStatus} />
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="font-medium">Progress</span>
          <span className="text-muted-foreground">
            {guidedSetup.summary.progressPercent}%
          </span>
        </div>
        <ProgressBar value={guidedSetup.summary.progressPercent} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[18rem_1fr]">
        <div className="grid gap-2">
          {guidedSetup.steps.map((step) => (
            <StepButton
              key={step.key}
              step={step}
              active={step.key === activeStep.key}
              onClick={() => setActiveStepKey(step.key)}
            />
          ))}
        </div>

        <section className="rounded-md border bg-background p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <StatusIcon status={activeStep.status} />
                <h3 className="font-semibold">{activeStep.label}</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {activeStep.summary}
              </p>
            </div>
            <StatusBadge status={activeStep.status} compact />
          </div>

          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {activeStep.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>

          <div className="mt-5 grid gap-4 md:grid-cols-[minmax(12rem,16rem)_1fr]">
            <label className="space-y-2">
              <span className="text-sm font-medium">Operator state</span>
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as StatusControlValue)
                }
                className="h-10 w-full rounded-md border bg-card px-3 text-sm"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Note</span>
              <input
                value={note}
                maxLength={2000}
                onChange={(event) => setNote(event.target.value)}
                className="h-10 w-full rounded-md border bg-card px-3 text-sm"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <Save className="size-4" aria-hidden="true" />
              {isSaving ? "Saving..." : "Save step"}
            </button>
            <Link
              to={activeStep.action.to}
              params={{ eventId }}
              className="inline-flex h-10 items-center rounded-md border px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {activeStep.action.label}
            </Link>
          </div>

          {activeStep.operatorStatus &&
          activeStep.systemStatus === "blocked" ? (
            <p className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
              Source data is still blocking this step.
            </p>
          ) : null}
        </section>
      </div>
    </section>
  )
}

function StepButton({
  step,
  active,
  onClick,
}: {
  step: CrewGuidedSetupStep
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-h-14 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted ${
        active ? "bg-muted text-foreground" : "text-muted-foreground"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <StatusIcon status={step.status} />
        <span className="truncate font-medium">{step.label}</span>
      </span>
      <span className="shrink-0 text-xs">
        {crewGuidedSetupStatusLabels[step.status]}
      </span>
    </button>
  )
}

function StatusBadge({
  status,
  compact = false,
}: {
  status: CrewGuidedSetupStatus
  compact?: boolean
}) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-md border px-2 py-1 text-xs font-medium ${statusBadgeClass(status)} ${compact ? "" : "self-start"}`}
    >
      {crewGuidedSetupStatusLabels[status]}
    </span>
  )
}

function StatusIcon({ status }: { status: CrewGuidedSetupStatus }) {
  const Icon =
    status === "complete"
      ? CheckCircle2
      : status === "blocked"
        ? AlertCircle
        : status === "in_progress"
          ? CircleDot
          : Circle

  return (
    <Icon
      className={`size-4 shrink-0 ${statusIconClass(status)}`}
      aria-hidden="true"
    />
  )
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

function statusBadgeClass(status: CrewGuidedSetupStatus) {
  if (status === "complete") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
  }
  if (status === "blocked") {
    return "border-destructive/30 bg-destructive/10 text-destructive"
  }
  if (status === "in_progress") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700"
  }
  return "border-muted-foreground/30 bg-muted text-muted-foreground"
}

function statusIconClass(status: CrewGuidedSetupStatus) {
  if (status === "complete") return "text-emerald-600"
  if (status === "blocked") return "text-destructive"
  if (status === "in_progress") return "text-amber-600"
  return "text-muted-foreground"
}

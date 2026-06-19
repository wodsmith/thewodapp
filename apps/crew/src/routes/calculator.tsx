import { createFileRoute } from "@tanstack/react-router"
import type { ChangeEvent, ReactNode } from "react"
import { useMemo, useState } from "react"
import {
  defaultStaffingCalculatorInputs,
  estimateCrewStaffing,
  formatStaffingDuration,
  normalizeStaffingCalculatorInputs,
  type StaffingCalculatorInputs,
  type StaffingRoleAssumption,
  type StaffingRoleBasis,
  type StaffingRoleEstimate,
  type StaffingRoleGroup,
} from "@/lib/crew-staffing-calculator"

export const Route = createFileRoute("/calculator")({
  component: StaffingCalculatorPage,
})

function StaffingCalculatorPage() {
  const [inputs, setInputs] = useState<StaffingCalculatorInputs>(
    normalizeStaffingCalculatorInputs(defaultStaffingCalculatorInputs),
  )
  const estimate = useMemo(() => estimateCrewStaffing(inputs), [inputs])

  function updateNumberField(
    key: keyof Pick<
      StaffingCalculatorInputs,
      "lanes" | "floors" | "heats" | "heatDurationMinutes" | "shiftLengthHours"
    >,
    value: string,
  ) {
    const nextValue = Number(value)
    setInputs((current) =>
      normalizeStaffingCalculatorInputs({
        ...current,
        [key]: Number.isFinite(nextValue) ? nextValue : 0,
      }),
    )
  }

  function updateRole(
    roleId: string,
    updates: Partial<StaffingRoleAssumption>,
  ) {
    setInputs((current) =>
      normalizeStaffingCalculatorInputs({
        ...current,
        roleAssumptions: current.roleAssumptions.map((role) =>
          role.id === roleId ? { ...role, ...updates } : role,
        ),
      }),
    )
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Staffing calculator
          </p>
          <h1 className="mt-2 text-3xl font-semibold">
            Estimate judges, volunteers, and shift coverage.
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Adjust event assumptions to get a deterministic staffing estimate
            before building a final schedule.
          </p>
        </div>
        <SummaryBadge
          label="Workout block"
          value={formatStaffingDuration(estimate.eventMinutes)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <section className="rounded-md border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Event assumptions</h2>
          <div className="mt-5 grid gap-4">
            <NumberField
              label="Lanes per floor"
              value={inputs.lanes}
              min={1}
              step={1}
              onChange={(event) =>
                updateNumberField("lanes", event.target.value)
              }
            />
            <NumberField
              label="Floors"
              value={inputs.floors}
              min={1}
              step={1}
              onChange={(event) =>
                updateNumberField("floors", event.target.value)
              }
            />
            <NumberField
              label="Heats"
              value={inputs.heats}
              min={1}
              step={1}
              onChange={(event) =>
                updateNumberField("heats", event.target.value)
              }
            />
            <NumberField
              label="Heat duration"
              value={inputs.heatDurationMinutes}
              min={1}
              step={1}
              suffix="min"
              onChange={(event) =>
                updateNumberField("heatDurationMinutes", event.target.value)
              }
            />
            <NumberField
              label="Shift length"
              value={inputs.shiftLengthHours}
              min={0.25}
              step={0.25}
              suffix="hr"
              onChange={(event) =>
                updateNumberField("shiftLengthHours", event.target.value)
              }
            />
          </div>
        </section>

        <section className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryPanel
              label="Judges"
              primary={estimate.judgeShiftSlots}
              secondary={`${estimate.judgeConcurrentPeople} concurrent`}
            />
            <SummaryPanel
              label="Volunteers"
              primary={estimate.volunteerShiftSlots}
              secondary={`${estimate.volunteerConcurrentPeople} concurrent`}
            />
            <SummaryPanel
              label="Total shift slots"
              primary={estimate.totalShiftSlots}
              secondary={`${estimate.totalConcurrentPeople} people on deck`}
            />
          </div>

          <section className="rounded-md border bg-card shadow-sm">
            <div className="border-b p-5">
              <h2 className="text-lg font-semibold">Role assumptions</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Tune the default role mix without creating assignments.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Role</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">Basis</th>
                    <th className="px-5 py-3 font-medium">People</th>
                    <th className="px-5 py-3 font-medium">Concurrent</th>
                    <th className="px-5 py-3 font-medium">Shift slots</th>
                  </tr>
                </thead>
                <tbody>
                  {estimate.roleEstimates.map((role) => (
                    <RoleRow
                      key={role.id}
                      role={role}
                      onChange={(updates) => updateRole(role.id, updates)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-md border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Coverage notes</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
              <Fact
                label="Heat time"
                value={`${inputs.heats} x ${inputs.heatDurationMinutes} min`}
              />
              <Fact
                label="Shift length"
                value={formatStaffingDuration(estimate.shiftLengthMinutes)}
              />
              <Fact
                label="Coverage formula"
                value="Concurrent people x event minutes"
              />
            </dl>
          </section>
        </section>
      </div>
    </main>
  )
}

interface NumberFieldProps {
  label: string
  value: number
  min: number
  step: number
  suffix?: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}

function NumberField({
  label,
  value,
  min,
  step,
  suffix,
  onChange,
}: NumberFieldProps) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <span className="flex items-center overflow-hidden rounded-md border bg-background">
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={onChange}
          className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
        />
        {suffix ? (
          <span className="border-l px-3 text-sm text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </span>
    </label>
  )
}

interface RoleRowProps {
  role: StaffingRoleEstimate
  onChange: (updates: Partial<StaffingRoleAssumption>) => void
}

function RoleRow({ role, onChange }: RoleRowProps) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-5 py-3 font-medium">{role.label}</td>
      <td className="px-5 py-3">
        <select
          value={role.group}
          onChange={(event) =>
            onChange({ group: event.target.value as StaffingRoleGroup })
          }
          className="h-9 rounded-md border bg-background px-2"
        >
          <option value="judge">Judge</option>
          <option value="volunteer">Volunteer</option>
        </select>
      </td>
      <td className="px-5 py-3">
        <select
          value={role.basis}
          onChange={(event) =>
            onChange({ basis: event.target.value as StaffingRoleBasis })
          }
          className="h-9 rounded-md border bg-background px-2"
        >
          <option value="event">Event</option>
          <option value="floor">Floor</option>
          <option value="lane">Lane</option>
          <option value="lanePerFloor">Lane per floor</option>
        </select>
      </td>
      <td className="px-5 py-3">
        <input
          type="number"
          min={0}
          step={0.25}
          value={role.peoplePerUnit}
          onChange={(event) =>
            onChange({ peoplePerUnit: Number(event.target.value) })
          }
          className="h-9 w-24 rounded-md border bg-background px-2"
        />
      </td>
      <td className="px-5 py-3 font-medium">{role.concurrentPeople}</td>
      <td className="px-5 py-3 font-medium">{role.shiftSlots}</td>
    </tr>
  )
}

interface SummaryPanelProps {
  label: string
  primary: number
  secondary: string
}

function SummaryPanel({ label, primary, secondary }: SummaryPanelProps) {
  return (
    <section className="rounded-md border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{primary}</p>
      <p className="mt-1 text-sm text-muted-foreground">{secondary}</p>
    </section>
  )
}

interface SummaryBadgeProps {
  label: string
  value: string
}

function SummaryBadge({ label, value }: SummaryBadgeProps) {
  return (
    <div className="w-fit rounded-md border bg-card px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}

interface FactProps {
  label: string
  value: ReactNode
}

function Fact({ label, value }: FactProps) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  )
}

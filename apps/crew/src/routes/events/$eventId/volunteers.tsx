import type { FormEvent, ReactNode } from "react"
import {
  createFileRoute,
  getRouteApi,
  Link,
  useRouter,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ClipboardPaste, Loader2, UserPlus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type {
  VolunteerAvailability,
  VolunteerRoleType,
} from "@/db/schemas/volunteers"
import {
  VOLUNTEER_AVAILABILITY,
  VOLUNTEER_ROLE_OPTIONS,
} from "@/db/schemas/volunteers"
import { formatCrewValue } from "@/lib/crew-event-display"
import type {
  CrewRosterStatus,
  CrewRosterVolunteer,
} from "@/lib/crew/roster-shifts"
import {
  formatVolunteerAvailability,
  formatVolunteerRole,
} from "@/lib/crew/roster-shifts"
import type { ManualCrewVolunteerMutationResult } from "@/server-fns/crew-roster-shift-fns"
import {
  createManualCrewVolunteerFn,
  getCrewRosterPageFn,
  pasteManualCrewVolunteerEmailsFn,
} from "@/server-fns/crew-roster-shift-fns"

export const Route = createFileRoute("/events/$eventId/volunteers")({
  loader: async ({ params }) =>
    await getCrewRosterPageFn({ data: { eventId: params.eventId } }),
  component: VolunteersPage,
})

const parentRoute = getRouteApi("/events/$eventId")

function VolunteersPage() {
  const { eventId } = parentRoute.useParams()
  const { roster, summary, shiftSummary } = Route.useLoaderData()
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const reloadRoster = async () => {
    await router.invalidate()
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Roster</h2>
          <p className="text-sm text-muted-foreground">
            {summary.total} volunteers, {summary.assignable} assignable
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPasteOpen(true)}>
            <ClipboardPaste />
            Paste emails
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus />
            Add volunteer
          </Button>
          <Button asChild variant="outline">
            <Link to="/events/$eventId/shifts" params={{ eventId }}>
              Manage shifts
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <StatusPanel label="Pending" value={summary.pending} />
        <StatusPanel label="Accepted" value={summary.accepted} />
        <StatusPanel label="Active" value={summary.active} />
        <StatusPanel
          label="Shift coverage"
          value={`${shiftSummary.assignedSlots}/${shiftSummary.capacity}`}
        />
        <StatusPanel
          label="Confirmed"
          value={shiftSummary.confirmationSummary.confirmed}
        />
      </div>

      <section className="overflow-hidden rounded-md border bg-card shadow-sm">
        {roster.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Volunteer</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Roles</th>
                  <th className="px-4 py-3 font-medium">Availability</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((volunteer) => (
                  <VolunteerRow key={volunteer.id} volunteer={volunteer} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <h3 className="font-semibold">No volunteers yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Add volunteers one at a time, paste a list of emails, share the
              public signup link, or import a file to build the roster.
            </p>
          </div>
        )}
      </section>

      <AddVolunteerDialog
        open={addOpen}
        eventId={eventId}
        onOpenChange={setAddOpen}
        onCreated={reloadRoster}
      />
      <PasteVolunteerEmailsDialog
        open={pasteOpen}
        eventId={eventId}
        onOpenChange={setPasteOpen}
        onCreated={reloadRoster}
      />
    </section>
  )
}

function AddVolunteerDialog({
  open,
  eventId,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  eventId: string
  onOpenChange: (open: boolean) => void
  onCreated: () => Promise<void>
}) {
  const createVolunteer = useServerFn(createManualCrewVolunteerFn)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const availability = getFormString(formData, "availability")

    setIsSubmitting(true)
    setError(null)
    try {
      const result = await createVolunteer({
        data: {
          eventId,
          email: getFormString(formData, "email"),
          name: getFormString(formData, "name"),
          phone: getFormString(formData, "phone"),
          roleTypes: getFormStringList(formData, "roleTypes"),
          availability: availability
            ? (availability as VolunteerAvailability)
            : undefined,
          availabilityNotes: getFormString(formData, "availabilityNotes"),
          notes: getFormString(formData, "notes"),
        },
      })

      if (result.summary.created > 0) {
        toast.success("Volunteer added")
        form.reset()
        onOpenChange(false)
        await onCreated()
      } else if (result.skipped.length > 0) {
        const skipped = result.skipped[0]
        const message = skipped?.message ?? "Volunteer already exists"
        toast.warning(message)
        setError(message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Volunteer add failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setError(null)
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add volunteer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" htmlFor="manual-volunteer-email">
              <Input
                id="manual-volunteer-email"
                name="email"
                type="email"
                required
                disabled={isSubmitting}
              />
            </Field>
            <Field label="Name" htmlFor="manual-volunteer-name">
              <Input
                id="manual-volunteer-name"
                name="name"
                disabled={isSubmitting}
              />
            </Field>
            <Field label="Phone" htmlFor="manual-volunteer-phone">
              <Input
                id="manual-volunteer-phone"
                name="phone"
                disabled={isSubmitting}
              />
            </Field>
            <Field label="Availability" htmlFor="manual-volunteer-availability">
              <select
                id="manual-volunteer-availability"
                name="availability"
                className="h-10 rounded-md border bg-background px-3 text-sm"
                disabled={isSubmitting}
                defaultValue=""
              >
                <option value="">Not set</option>
                <option value={VOLUNTEER_AVAILABILITY.MORNING}>Morning</option>
                <option value={VOLUNTEER_AVAILABILITY.AFTERNOON}>
                  Afternoon
                </option>
                <option value={VOLUNTEER_AVAILABILITY.ALL_DAY}>All day</option>
              </select>
            </Field>
          </div>

          <RoleTypeCheckboxes disabled={isSubmitting} />

          <Field
            label="Availability notes"
            htmlFor="manual-volunteer-availability-notes"
          >
            <Textarea
              id="manual-volunteer-availability-notes"
              name="availabilityNotes"
              disabled={isSubmitting}
            />
          </Field>

          <Field label="Notes" htmlFor="manual-volunteer-notes">
            <Textarea
              id="manual-volunteer-notes"
              name="notes"
              disabled={isSubmitting}
            />
          </Field>

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : null}
              Add volunteer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PasteVolunteerEmailsDialog({
  open,
  eventId,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  eventId: string
  onOpenChange: (open: boolean) => void
  onCreated: () => Promise<void>
}) {
  const pasteVolunteers = useServerFn(pasteManualCrewVolunteerEmailsFn)
  const [pasteText, setPasteText] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] =
    useState<ManualCrewVolunteerMutationResult | null>(null)

  async function handleSubmit() {
    setIsSubmitting(true)
    setError(null)
    setResult(null)
    try {
      const nextResult = await pasteVolunteers({
        data: { eventId, pasteText },
      })
      setResult(nextResult)
      if (nextResult.summary.created > 0) {
        await onCreated()
      }
      const message = formatManualVolunteerResult(nextResult)
      if (nextResult.summary.invalid > 0 || nextResult.summary.skipped > 0) {
        toast.warning(message)
      } else {
        toast.success(message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Email paste failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setPasteText("")
          setError(null)
          setResult(null)
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Paste emails</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Emails" htmlFor="manual-volunteer-paste">
            <Textarea
              id="manual-volunteer-paste"
              className="h-48 font-mono text-sm"
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              disabled={isSubmitting}
              placeholder={`jane@example.com\nbob@example.com\nor: jane@example.com, bob@example.com`}
            />
          </Field>

          {result ? <ManualVolunteerResult result={result} /> : null}

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {result ? "Done" : "Cancel"}
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || pasteText.trim().length === 0}
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : null}
              Add emails
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RoleTypeCheckboxes({ disabled }: { disabled: boolean }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Roles</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {VOLUNTEER_ROLE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              name="roleTypes"
              value={option.value}
              disabled={disabled}
              className="size-4"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function ManualVolunteerResult({
  result,
}: {
  result: ManualCrewVolunteerMutationResult
}) {
  return (
    <section className="space-y-3 rounded-md border bg-muted/40 p-3 text-sm">
      <div className="grid gap-2 sm:grid-cols-3">
        <ResultCount label="Created" value={result.summary.created} />
        <ResultCount label="Skipped" value={result.summary.skipped} />
        <ResultCount label="Invalid" value={result.summary.invalid} />
      </div>
      {result.skipped.length > 0 ? (
        <ResultList
          label="Skipped rows"
          rows={result.skipped.map(
            (row) => `${row.rowNumber}: ${row.email} - ${row.message}`,
          )}
        />
      ) : null}
      {result.invalid.length > 0 ? (
        <ResultList
          label="Invalid rows"
          rows={result.invalid.map(
            (row) =>
              `${row.rowNumber}: ${row.value} - ${formatInvalidReason(
                row.reason,
              )}`,
          )}
        />
      ) : null}
    </section>
  )
}

function ResultCount({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  )
}

function ResultList({ label, rows }: { label: string; rows: string[] }) {
  const visibleRows = rows.slice(0, 8)
  return (
    <div>
      <p className="font-medium">{label}</p>
      <ul className="mt-1 space-y-1 text-muted-foreground">
        {visibleRows.map((row) => (
          <li key={row}>{row}</li>
        ))}
        {rows.length > visibleRows.length ? (
          <li>{rows.length - visibleRows.length} more</li>
        ) : null}
      </ul>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-1 text-sm">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function formatManualVolunteerResult(
  result: ManualCrewVolunteerMutationResult,
) {
  const parts = [`${result.summary.created} created`]
  if (result.summary.skipped > 0)
    parts.push(`${result.summary.skipped} skipped`)
  if (result.summary.invalid > 0)
    parts.push(`${result.summary.invalid} invalid`)
  return parts.join(" · ")
}

function formatInvalidReason(
  reason: ManualCrewVolunteerMutationResult["invalid"][number]["reason"],
) {
  if (reason === "batch_limit") return "Batch limit reached"
  return "Invalid email"
}

function getFormString(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === "string" ? value.trim() : ""
}

function getFormStringList(
  formData: FormData,
  name: string,
): VolunteerRoleType[] {
  return formData
    .getAll(name)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value as VolunteerRoleType)
}

function VolunteerRow({ volunteer }: { volunteer: CrewRosterVolunteer }) {
  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-3 align-top">
        <div className="font-medium">{volunteer.name}</div>
        <div className="text-muted-foreground">{volunteer.email}</div>
        {volunteer.phone ? (
          <div className="text-muted-foreground">{volunteer.phone}</div>
        ) : null}
      </td>
      <td className="px-4 py-3 align-top">
        <StatusBadge status={volunteer.status} />
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-wrap gap-1">
          {volunteer.roleTypes.map((roleType) => (
            <span
              key={roleType}
              className="rounded-md border bg-background px-2 py-1 text-xs"
            >
              {formatVolunteerRole(roleType)}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <div>{formatVolunteerAvailability(volunteer.availability)}</div>
        {volunteer.availabilityNotes ? (
          <div className="mt-1 max-w-xs text-muted-foreground">
            {volunteer.availabilityNotes}
          </div>
        ) : null}
      </td>
      <td className="px-4 py-3 align-top text-muted-foreground">
        <div>
          {volunteer.imported ? "Imported" : formatCrewValue(volunteer.source)}
        </div>
        {volunteer.signupSource ? (
          <div className="mt-1">{formatCrewValue(volunteer.signupSource)}</div>
        ) : null}
      </td>
    </tr>
  )
}

function StatusPanel({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <section className="rounded-md border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </section>
  )
}

function StatusBadge({ status }: { status: CrewRosterStatus }) {
  const className =
    status === "active"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
      : status === "accepted"
        ? "border-sky-500/30 bg-sky-500/10 text-sky-700"
        : status === "pending"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
          : "border-muted bg-muted text-muted-foreground"

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}
    >
      {formatCrewValue(status)}
    </span>
  )
}

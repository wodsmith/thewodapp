// @lat: [[crew#Roster Volunteer Editing]]
import type { FormEvent, ReactNode } from "react"
import {
  createFileRoute,
  getRouteApi,
  Link,
  useRouter,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ClipboardPaste, FileUp, History, Loader2, Pencil, UserPlus } from "lucide-react"
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
import { VolunteerImportFlow } from "@/components/crew/volunteer-import-flow"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type {
  VolunteerAvailability,
  VolunteerRoleType,
} from "@/db/schemas/volunteers"
import {
  VOLUNTEER_AVAILABILITY,
  VOLUNTEER_ROLE_OPTIONS,
} from "@/db/schemas/volunteers"
import { formatCrewValue } from "@/lib/crew-event-display"
import type { CrewReturningVolunteerSuggestion } from "@/lib/crew/returning-volunteers"
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
  updateCrewRosterVolunteerFn,
} from "@/server-fns/crew-roster-shift-fns"
import { bulkAssignVolunteerRoleFn } from "@/server-fns/volunteer-fns"

export const Route = createFileRoute("/events/$eventId/volunteers")({
  loader: async ({ params }) =>
    await getCrewRosterPageFn({ data: { eventId: params.eventId } }),
  component: VolunteersPage,
})

const parentRoute = getRouteApi("/events/$eventId")

function VolunteersPage() {
  const { eventId } = parentRoute.useParams()
  const { event, roster, summary, shiftSummary, returningVolunteerSuggestions } =
    Route.useLoaderData()
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editingVolunteer, setEditingVolunteer] =
    useState<CrewRosterVolunteer | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkRole, setBulkRole] = useState<VolunteerRoleType | "">("")
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false)
  const bulkAssignRole = useServerFn(bulkAssignVolunteerRoleFn)

  const reloadRoster = async () => {
    await router.invalidate()
  }

  const allIds = roster.map((v) => v.sourceId)
  const selectedCount = selectedIds.size
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))
  const someSelected = selectedCount > 0 && !allSelected

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(allIds))
    } else {
      setSelectedIds(new Set())
    }
  }

  function handleSelectVolunteer(sourceId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(sourceId)
      } else {
        next.delete(sourceId)
      }
      return next
    })
  }

  async function handleBulkAssign() {
    if (!bulkRole || selectedIds.size === 0) return
    setIsBulkSubmitting(true)
    try {
      await bulkAssignRole({
        data: {
          membershipIds: Array.from(selectedIds),
          organizingTeamId: event.organizingTeamId,
          competitionId: event.id,
          roleType: bulkRole,
        },
      })
      toast.success(
        `Assigned "${VOLUNTEER_ROLE_OPTIONS.find((o) => o.value === bulkRole)?.label ?? bulkRole}" to ${selectedIds.size} volunteer${selectedIds.size === 1 ? "" : "s"}`,
      )
      setSelectedIds(new Set())
      setBulkRole("")
      await router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk assign failed")
    } finally {
      setIsBulkSubmitting(false)
    }
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
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileUp />
            Import volunteers
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

      <ReturningVolunteersPanel suggestions={returningVolunteerSuggestions} />

      {selectedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/50 px-4 py-3 text-sm">
          <span className="font-medium">
            {selectedCount} volunteer{selectedCount === 1 ? "" : "s"} selected
          </span>
          <label htmlFor="bulk-role-select" className="sr-only">
            Role to assign
          </label>
          <select
            id="bulk-role-select"
            value={bulkRole}
            onChange={(e) => setBulkRole(e.target.value as VolunteerRoleType | "")}
            className="h-9 rounded-md border bg-background px-3 text-sm"
            disabled={isBulkSubmitting}
          >
            <option value="">Pick a role…</option>
            {VOLUNTEER_ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            onClick={handleBulkAssign}
            disabled={isBulkSubmitting || !bulkRole}
          >
            {isBulkSubmitting ? <Loader2 className="animate-spin" /> : null}
            Assign role
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
            disabled={isBulkSubmitting}
          >
            Clear selection
          </Button>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-md border bg-card shadow-sm">
        {roster.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all volunteers"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected
                      }}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="size-4"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">Volunteer</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Roles</th>
                  <th className="px-4 py-3 font-medium">Availability</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((volunteer) => (
                  <VolunteerRow
                    key={volunteer.id}
                    volunteer={volunteer}
                    selected={selectedIds.has(volunteer.sourceId)}
                    onSelectChange={(checked) =>
                      handleSelectVolunteer(volunteer.sourceId, checked)
                    }
                    onEdit={() => setEditingVolunteer(volunteer)}
                  />
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
      <ImportVolunteersDialog
        open={importOpen}
        eventId={eventId}
        onOpenChange={setImportOpen}
        onImported={reloadRoster}
      />
      <EditRosterVolunteerDialog
        volunteer={editingVolunteer}
        eventId={eventId}
        onOpenChange={(open) => {
          if (!open) setEditingVolunteer(null)
        }}
        onSaved={reloadRoster}
      />
    </section>
  )
}

function ReturningVolunteersPanel({
  suggestions,
}: {
  suggestions: CrewReturningVolunteerSuggestion[]
}) {
  if (suggestions.length === 0) return null

  return (
    <section className="rounded-md border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <History className="h-4 w-4 text-muted-foreground" />
        <div>
          <h3 className="font-semibold">Returning volunteers</h3>
          <p className="text-sm text-muted-foreground">
            {suggestions.length} matched on organizer history
          </p>
        </div>
      </div>
      <div className="divide-y">
        {suggestions.map((suggestion) => (
          <ReturningVolunteerRow
            key={suggestion.rosterVolunteerId}
            suggestion={suggestion}
          />
        ))}
      </div>
    </section>
  )
}

function ReturningVolunteerRow({
  suggestion,
}: {
  suggestion: CrewReturningVolunteerSuggestion
}) {
  const facts = buildReturningVolunteerFacts(suggestion)

  return (
    <div className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div>
        <div className="font-medium">{suggestion.volunteerName}</div>
        <div className="mt-1 text-sm text-muted-foreground">
          {suggestion.priorEventCount} prior event
          {suggestion.priorEventCount === 1 ? "" : "s"}
          {suggestion.lastEvent ? (
            <>
              {" "}
              · Last: {suggestion.lastEvent.label},{" "}
              {formatReturningVolunteerDate(suggestion.lastEvent.occurredAt)}
            </>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {suggestion.currentRoleTypes.map((roleType) => (
            <span
              key={roleType}
              className="rounded-md border bg-background px-2 py-1 text-xs"
            >
              {formatVolunteerRole(roleType)}
            </span>
          ))}
          <span className="rounded-md border bg-background px-2 py-1 text-xs">
            {formatVolunteerAvailability(suggestion.currentAvailability)}
          </span>
        </div>
      </div>
      <div className="space-y-2">
        <FactList facts={facts} />
        {suggestion.priorRoleTypes.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Prior roles:{" "}
            {suggestion.priorRoleTypes.map(formatVolunteerRole).join(", ")}
          </p>
        ) : null}
        {suggestion.credentials.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Credentials:{" "}
            {suggestion.credentials
              .map(
                (credential) =>
                  `${credential.credentialLabel} (${formatCrewValue(
                    credential.status,
                  )})`,
              )
              .join(", ")}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function FactList({ facts }: { facts: string[] }) {
  if (facts.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1">
      {facts.map((fact) => (
        <span
          key={fact}
          className="rounded-md border bg-background px-2 py-1 text-xs"
        >
          {fact}
        </span>
      ))}
    </div>
  )
}

function buildReturningVolunteerFacts(
  suggestion: CrewReturningVolunteerSuggestion,
) {
  const { reliability } = suggestion
  return [
    formatReturningFact("Confirmed", reliability.confirmed),
    formatReturningFact("Completed", reliability.completed),
    formatReturningFact("Assigned", reliability.assigned),
    formatReturningFact("Signed up", reliability.signedUp),
    formatReturningFact("Imported", reliability.imported),
    formatReturningFact("Declined", reliability.declined),
    formatReturningFact("Change requested", reliability.changeRequested),
    formatReturningFact("No-show", reliability.noShow),
  ].filter((fact): fact is string => Boolean(fact))
}

function formatReturningFact(label: string, count: number) {
  return count > 0 ? `${label} ${count}` : null
}

function formatReturningVolunteerDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "unknown date"
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    date,
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
                disabled={isSubmitting}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Optional. Leave blank to add a volunteer without an email.
              </p>
            </Field>
            <Field label="Name" htmlFor="manual-volunteer-name">
              <Input
                id="manual-volunteer-name"
                name="name"
                disabled={isSubmitting}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Required when no email is provided.
              </p>
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

function ImportVolunteersDialog({
  open,
  eventId,
  onOpenChange,
  onImported,
}: {
  open: boolean
  eventId: string
  onOpenChange: (open: boolean) => void
  onImported: () => Promise<void>
}) {
  async function handleApplyComplete() {
    onOpenChange(false)
    await onImported()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import volunteers</DialogTitle>
        </DialogHeader>
        <VolunteerImportFlow
          eventId={eventId}
          onApplyComplete={handleApplyComplete}
        />
      </DialogContent>
    </Dialog>
  )
}

function EditRosterVolunteerDialog({
  volunteer,
  eventId,
  onOpenChange,
  onSaved,
}: {
  volunteer: CrewRosterVolunteer | null
  eventId: string
  onOpenChange: (open: boolean) => void
  onSaved: () => Promise<void>
}) {
  const updateVolunteer = useServerFn(updateCrewRosterVolunteerFn)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = volunteer !== null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!volunteer) return

    const form = event.currentTarget
    const formData = new FormData(form)
    const availability = getFormString(formData, "availability")

    setIsSubmitting(true)
    setError(null)
    try {
      await updateVolunteer({
        data: {
          eventId,
          source: volunteer.source,
          sourceId: volunteer.sourceId,
          email: getFormString(formData, "email"),
          name: getFormString(formData, "name"),
          phone: getFormString(formData, "phone"),
          roleTypes: getFormStringList(formData, "roleTypes"),
          availability: availability
            ? (availability as VolunteerAvailability)
            : undefined,
          availabilityNotes: getFormString(formData, "availabilityNotes"),
          credentials: getFormString(formData, "credentials"),
          notes: getFormString(formData, "notes"),
        },
      })
      toast.success("Volunteer updated")
      onOpenChange(false)
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Volunteer update failed")
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
          <DialogTitle>Edit volunteer</DialogTitle>
        </DialogHeader>
        {volunteer ? (
          <form
            key={volunteer.id}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" htmlFor="edit-volunteer-email">
                <Input
                  id="edit-volunteer-email"
                  name="email"
                  type="email"
                  disabled={isSubmitting}
                  maxLength={255}
                  defaultValue={volunteer.email}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Optional when a name is provided.
                </p>
              </Field>
              <Field label="Name" htmlFor="edit-volunteer-name">
                <Input
                  id="edit-volunteer-name"
                  name="name"
                  disabled={isSubmitting}
                  maxLength={200}
                  defaultValue={volunteer.name}
                />
              </Field>
              <Field label="Phone" htmlFor="edit-volunteer-phone">
                <Input
                  id="edit-volunteer-phone"
                  name="phone"
                  disabled={isSubmitting}
                  maxLength={50}
                  defaultValue={volunteer.phone ?? ""}
                />
              </Field>
              <Field label="Availability" htmlFor="edit-volunteer-availability">
                <select
                  id="edit-volunteer-availability"
                  name="availability"
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  disabled={isSubmitting}
                  defaultValue={volunteer.availability ?? ""}
                >
                  <option value="">Not set</option>
                  <option value={VOLUNTEER_AVAILABILITY.MORNING}>
                    Morning
                  </option>
                  <option value={VOLUNTEER_AVAILABILITY.AFTERNOON}>
                    Afternoon
                  </option>
                  <option value={VOLUNTEER_AVAILABILITY.ALL_DAY}>
                    All day
                  </option>
                </select>
              </Field>
            </div>

            <RoleTypeCheckboxes
              disabled={isSubmitting}
              defaultValues={volunteer.roleTypes}
            />

            <Field label="Credentials" htmlFor="edit-volunteer-credentials">
              <Input
                id="edit-volunteer-credentials"
                name="credentials"
                disabled={isSubmitting}
                maxLength={1000}
                defaultValue={volunteer.credentials ?? ""}
              />
            </Field>

            <Field
              label="Availability notes"
              htmlFor="edit-volunteer-availability-notes"
            >
              <Textarea
                id="edit-volunteer-availability-notes"
                name="availabilityNotes"
                disabled={isSubmitting}
                maxLength={5000}
                defaultValue={volunteer.availabilityNotes ?? ""}
              />
            </Field>

            <Field label="Notes" htmlFor="edit-volunteer-notes">
              <Textarea
                id="edit-volunteer-notes"
                name="notes"
                disabled={isSubmitting}
                maxLength={5000}
                defaultValue={volunteer.notes ?? ""}
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
                Save changes
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function RoleTypeCheckboxes({
  disabled,
  defaultValues = [],
}: {
  disabled: boolean
  defaultValues?: VolunteerRoleType[]
}) {
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
              defaultChecked={defaultValues.includes(option.value)}
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

function VolunteerRow({
  volunteer,
  selected,
  onSelectChange,
  onEdit,
}: {
  volunteer: CrewRosterVolunteer
  selected: boolean
  onSelectChange: (checked: boolean) => void
  onEdit: () => void
}) {
  const editLabelTarget =
    volunteer.name.trim() || volunteer.email.trim() || "volunteer"

  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-3 align-top">
        <input
          type="checkbox"
          aria-label={`Select ${editLabelTarget}`}
          checked={selected}
          onChange={(e) => onSelectChange(e.target.checked)}
          className="size-4"
        />
      </td>
      <td className="px-4 py-3 align-top">
        <div className="font-medium">{volunteer.name}</div>
        <div className="text-muted-foreground">
          {volunteer.email.trim() || "No email"}
        </div>
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
        {volunteer.credentials ? (
          <div className="mt-2 max-w-xs text-muted-foreground">
            {volunteer.credentials}
          </div>
        ) : null}
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
      <td className="px-4 py-3 text-right align-top">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={onEdit}
                aria-label={`Edit ${editLabelTarget}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit volunteer</TooltipContent>
          </Tooltip>
        </TooltipProvider>
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

// @lat: [[crew#Department Leads]]
import type { FormEvent, ReactNode } from "react"
import { useMemo, useState } from "react"
import { Ban, Pencil, ShieldCheck, UserRoundPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { VOLUNTEER_ROLE_OPTIONS } from "@/db/schemas/volunteers"
import type {
  CrewDepartmentLeadListItem,
  CrewDepartmentLeadsPageData,
} from "@/server-fns/crew-department-lead-fns"

type DepartmentLeadSubmitData = {
  leadId?: string
  eventId: string
  email: string | null
  name: string | null
  membershipId: string | null
  roleType: CrewDepartmentLeadListItem["roleType"]
  floor: string | null
  startsAt: string | null
  endsAt: string | null
  status: CrewDepartmentLeadListItem["status"]
  notes: string | null
}

export function CrewDepartmentLeadsPanel({
  pageData,
  onCreate,
  onUpdate,
  onRevoke,
}: {
  pageData: CrewDepartmentLeadsPageData
  onCreate: (data: DepartmentLeadSubmitData) => Promise<void>
  onUpdate: (
    data: DepartmentLeadSubmitData & { leadId: string },
  ) => Promise<void>
  onRevoke: (leadId: string) => Promise<void>
}) {
  const [editingLead, setEditingLead] =
    useState<CrewDepartmentLeadListItem | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const roleOptions = useMemo(() => VOLUNTEER_ROLE_OPTIONS, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const payload: DepartmentLeadSubmitData = {
      eventId: pageData.event.id,
      email: getFormString(formData, "email"),
      name: getFormString(formData, "name"),
      membershipId: getFormString(formData, "membershipId"),
      roleType: getFormString(
        formData,
        "roleType",
      ) as CrewDepartmentLeadListItem["roleType"],
      floor: getFormString(formData, "floor"),
      startsAt: getFormString(formData, "startsAt"),
      endsAt: getFormString(formData, "endsAt"),
      status: getFormString(
        formData,
        "status",
      ) as CrewDepartmentLeadListItem["status"],
      notes: getFormString(formData, "notes"),
    }

    setIsSubmitting(true)
    try {
      if (editingLead) {
        await onUpdate({ ...payload, leadId: editingLead.id })
        setEditingLead(null)
      } else {
        await onCreate(payload)
        form.reset()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRevoke(leadId: string) {
    setRevokingId(leadId)
    try {
      await onRevoke(leadId)
      if (editingLead?.id === leadId) setEditingLead(null)
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <section className="rounded-md border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Department leads</h2>
          <p className="text-sm text-muted-foreground">
            {pageData.leads.length} scoped leads
          </p>
        </div>
        {editingLead ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setEditingLead(null)}
          >
            <UserRoundPlus />
            New lead
          </Button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)]">
        <div className="overflow-hidden rounded-md border">
          {pageData.leads.length > 0 ? (
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Lead</th>
                  <th className="px-4 py-3 font-medium">Scope</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageData.leads.map((lead) => (
                  <tr key={lead.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {lead.name || lead.email || lead.membershipId}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {lead.email ?? lead.membershipId}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div>{getRoleLabel(lead.roleType)}</div>
                      <div className="text-xs">
                        {[lead.floor, formatWindow(lead)]
                          .filter(Boolean)
                          .join(" · ") || "All floors and times"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-md border px-2 py-1 text-xs font-medium capitalize">
                        {lead.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingLead(lead)}
                        >
                          <Pencil />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={
                            lead.status === "revoked" || revokingId === lead.id
                          }
                          onClick={() => void handleRevoke(lead.id)}
                        >
                          <Ban />
                          Revoke
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center">
              <ShieldCheck className="mx-auto size-8 text-muted-foreground" />
              <h3 className="mt-3 font-semibold">No department leads</h3>
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-md border p-4"
        >
          <h3 className="font-semibold">
            {editingLead ? "Edit lead" : "Add lead"}
          </h3>
          <Field label="Volunteer" htmlFor="department-lead-membership">
            <select
              id="department-lead-membership"
              name="membershipId"
              defaultValue={editingLead?.membershipId ?? ""}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              disabled={isSubmitting}
            >
              <option value="">Email invite</option>
              {pageData.volunteerOptions.map((volunteer) => (
                <option
                  key={volunteer.membershipId}
                  value={volunteer.membershipId}
                >
                  {volunteer.name} ({volunteer.email})
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email" htmlFor="department-lead-email">
              <Input
                id="department-lead-email"
                name="email"
                type="email"
                defaultValue={editingLead?.email ?? ""}
                disabled={isSubmitting}
              />
            </Field>
            <Field label="Name" htmlFor="department-lead-name">
              <Input
                id="department-lead-name"
                name="name"
                defaultValue={editingLead?.name ?? ""}
                disabled={isSubmitting}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Role" htmlFor="department-lead-role">
              <select
                id="department-lead-role"
                name="roleType"
                required
                defaultValue={editingLead?.roleType ?? "general"}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                disabled={isSubmitting}
              >
                {roleOptions.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Floor" htmlFor="department-lead-floor">
              <Input
                id="department-lead-floor"
                name="floor"
                defaultValue={editingLead?.floor ?? ""}
                disabled={isSubmitting}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Starts" htmlFor="department-lead-starts">
              <Input
                id="department-lead-starts"
                name="startsAt"
                type="datetime-local"
                defaultValue={toDateTimeLocal(editingLead?.startsAt)}
                disabled={isSubmitting}
              />
            </Field>
            <Field label="Ends" htmlFor="department-lead-ends">
              <Input
                id="department-lead-ends"
                name="endsAt"
                type="datetime-local"
                defaultValue={toDateTimeLocal(editingLead?.endsAt)}
                disabled={isSubmitting}
              />
            </Field>
          </div>
          <Field label="Status" htmlFor="department-lead-status">
            <select
              id="department-lead-status"
              name="status"
              defaultValue={editingLead?.status ?? "invited"}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              disabled={isSubmitting}
            >
              <option value="invited">Invited</option>
              <option value="active">Active</option>
              <option value="revoked">Revoked</option>
            </select>
          </Field>
          <Field label="Notes" htmlFor="department-lead-notes">
            <Textarea
              id="department-lead-notes"
              name="notes"
              defaultValue={editingLead?.notes ?? ""}
              disabled={isSubmitting}
            />
          </Field>
          <Button type="submit" disabled={isSubmitting}>
            <ShieldCheck />
            {editingLead ? "Save lead" : "Add lead"}
          </Button>
        </form>
      </div>
    </section>
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
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function getRoleLabel(roleType: CrewDepartmentLeadListItem["roleType"]) {
  return (
    VOLUNTEER_ROLE_OPTIONS.find((role) => role.value === roleType)?.label ??
    roleType
  )
}

function formatWindow(lead: CrewDepartmentLeadListItem) {
  if (!lead.startsAt && !lead.endsAt) return null
  return `${formatDate(lead.startsAt) || "Any start"} to ${
    formatDate(lead.endsAt) || "Any end"
  }`
}

function formatDate(value: Date | string | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function toDateTimeLocal(value: Date | string | null | undefined) {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16)
}

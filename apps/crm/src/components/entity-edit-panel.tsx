import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Save, X } from "lucide-react"
import { useEffect, useState } from "react"
import {
  type CrmCampaign,
  type CrmContact,
  type CrmGym,
  type CrmInteraction,
  updateCampaignFn,
  updateContactFn,
  updateGymFn,
  updateInteractionFn,
} from "@/server-fns/crm"

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error"

const GYM_STATUS_OPTIONS = [
  "Prospect",
  "Warm Prospect",
  "Outreach Sent",
  "Demo Scheduled",
  "Demo Complete",
  "Current User",
  "Active Partner",
  "Customer",
  "Not Now",
  "Closed/Lost",
]

const GYM_PRIORITY_OPTIONS = ["High", "Medium", "Low"]

const GYM_RELATIONSHIP_OPTIONS = [
  "Cold Lead",
  "Warm Prospect",
  "Intro Made",
  "Outreach Sent",
  "Demo Scheduled",
  "Demo Complete",
  "MWFC Host",
  "Active Partner",
  "Customer",
  "Not Now",
]

const CONTACT_STATUS_OPTIONS = [
  "Lead",
  "Contacted",
  "Qualified",
  "Active",
  "Customer",
  "Inactive",
  "Do Not Contact",
]

const INTERACTION_CHANNEL_OPTIONS = [
  "Email",
  "Call",
  "Text",
  "Instagram",
  "In Person",
  "Demo",
  "Meeting",
  "Referral",
]

const INTERACTION_STATUS_OPTIONS = [
  "Planned",
  "Sent",
  "Completed",
  "No Response",
  "Replied",
  "Follow Up",
  "Not Interested",
]

const CAMPAIGN_STATUS_OPTIONS = ["Planning", "Active", "Paused", "Completed"]

const OWNER_OPTIONS = ["Ian", "Zac"]

export function CampaignEditPanel({
  campaign,
  onCancel,
  onSaved,
}: {
  campaign: CrmCampaign
  onCancel: () => void
  onSaved: () => void
}) {
  const router = useRouter()
  const updateCampaign = useServerFn(updateCampaignFn)
  const [state, setState] = useState<SaveState>("idle")
  const [error, setError] = useState<string | null>(null)

  useUnsavedChanges(state === "dirty")

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setState("saving")
    setError(null)
    try {
      await updateCampaign({
        data: {
          id: campaign.id,
          name: field(form, "name"),
          status: field(form, "status"),
          owner: field(form, "owner") as "Ian" | "Zac",
          goal: field(form, "goal"),
          templateSubject: field(form, "templateSubject"),
          templateBody: field(form, "templateBody"),
          startDate: field(form, "startDate"),
          endDate: field(form, "endDate"),
        },
      })
      await router.invalidate()
      setState("saved")
      onSaved()
    } catch (caught) {
      setError(messageFor(caught))
      setState("dirty")
    }
  }

  return (
    <EditPanel
      title="Edit Campaign"
      state={state}
      error={error}
      onSubmit={handleSubmit}
      onChange={() => setState("dirty")}
      onCancel={onCancel}
    >
      <TextField
        name="name"
        label="Campaign"
        defaultValue={campaign.name}
        required
      />
      <SelectField
        name="status"
        label="Status"
        defaultValue={campaign.status}
        emptyLabel="No Status"
        options={optionsWithCurrent(CAMPAIGN_STATUS_OPTIONS, campaign.status)}
      />
      <SelectField
        name="owner"
        label="Owner"
        defaultValue={campaign.owner}
        emptyLabel="No Owner"
        options={optionsWithCurrent(OWNER_OPTIONS, campaign.owner)}
      />
      <TextField
        name="startDate"
        label="Start"
        type="date"
        defaultValue={campaign.startDate}
      />
      <TextField
        name="endDate"
        label="End"
        type="date"
        defaultValue={campaign.endDate}
      />
      <TextareaField name="goal" label="Goal" defaultValue={campaign.goal} />
      <TextareaField
        name="templateSubject"
        label="Template Subject"
        defaultValue={campaign.templateSubject}
      />
      <TextareaField
        name="templateBody"
        label="Template Body"
        defaultValue={campaign.templateBody}
      />
    </EditPanel>
  )
}

export function GymEditPanel({
  gym,
  onCancel,
  onSaved,
}: {
  gym: CrmGym
  onCancel: () => void
  onSaved: () => void
}) {
  const router = useRouter()
  const updateGym = useServerFn(updateGymFn)
  const [state, setState] = useState<SaveState>("idle")
  const [error, setError] = useState<string | null>(null)

  useUnsavedChanges(state === "dirty")

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setState("saving")
    setError(null)
    try {
      await updateGym({
        data: {
          id: gym.id,
          name: field(form, "name"),
          location: field(form, "location"),
          website: field(form, "website"),
          crossfitPage: field(form, "crossfitPage"),
          email: field(form, "email"),
          phone: field(form, "phone"),
          instagram: field(form, "instagram"),
          ownerManager: field(form, "ownerManager"),
          status: field(form, "status"),
          priority: field(form, "priority"),
          relationship: field(form, "relationship"),
          notes: field(form, "notes"),
        },
      })
      await router.invalidate()
      setState("saved")
      onSaved()
    } catch (caught) {
      setError(messageFor(caught))
      setState("dirty")
    }
  }

  return (
    <EditPanel
      title="Edit Gym"
      state={state}
      error={error}
      onSubmit={handleSubmit}
      onChange={() => setState("dirty")}
      onCancel={onCancel}
    >
      <TextField name="name" label="Gym" defaultValue={gym.name} required />
      <TextField name="location" label="Location" defaultValue={gym.location} />
      <TextField
        name="ownerManager"
        label="Owner or Manager"
        defaultValue={gym.ownerManager}
      />
      <SelectField
        name="relationship"
        label="Relationship"
        defaultValue={gym.relationship}
        emptyLabel="No Relationship"
        options={optionsWithCurrent(GYM_RELATIONSHIP_OPTIONS, gym.relationship)}
      />
      <TextField name="website" label="Website" defaultValue={gym.website} />
      <TextField
        name="crossfitPage"
        label="CrossFit Page"
        defaultValue={gym.crossfitPage}
      />
      <TextField
        name="email"
        label="Email"
        type="email"
        defaultValue={gym.email}
      />
      <TextField
        name="phone"
        label="Phone"
        type="tel"
        defaultValue={gym.phone}
      />
      <TextField
        name="instagram"
        label="Instagram"
        defaultValue={gym.instagram}
      />
      <SelectField
        name="status"
        label="Status"
        defaultValue={gym.status}
        emptyLabel="No Status"
        options={optionsWithCurrent(GYM_STATUS_OPTIONS, gym.status)}
      />
      <SelectField
        name="priority"
        label="Priority"
        defaultValue={gym.priority}
        emptyLabel="No Priority"
        options={optionsWithCurrent(GYM_PRIORITY_OPTIONS, gym.priority)}
      />
      <TextareaField name="notes" label="Notes" defaultValue={gym.notes} />
    </EditPanel>
  )
}

export function ContactEditPanel({
  contact,
  gyms,
  onCancel,
  onSaved,
}: {
  contact: CrmContact
  gyms: CrmGym[]
  onCancel: () => void
  onSaved: () => void
}) {
  const router = useRouter()
  const updateContact = useServerFn(updateContactFn)
  const [state, setState] = useState<SaveState>("idle")
  const [error, setError] = useState<string | null>(null)

  useUnsavedChanges(state === "dirty")

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setState("saving")
    setError(null)
    try {
      await updateContact({
        data: {
          id: contact.id,
          fullName: field(form, "fullName"),
          email: field(form, "email"),
          phone: field(form, "phone"),
          status: field(form, "status"),
          companyId: field(form, "companyId"),
          notes: field(form, "notes"),
        },
      })
      await router.invalidate()
      setState("saved")
      onSaved()
    } catch (caught) {
      setError(messageFor(caught))
      setState("dirty")
    }
  }

  return (
    <EditPanel
      title="Edit Contact"
      state={state}
      error={error}
      onSubmit={handleSubmit}
      onChange={() => setState("dirty")}
      onCancel={onCancel}
    >
      <TextField
        name="fullName"
        label="Name"
        defaultValue={contact.fullName}
        required
      />
      <TextField
        name="email"
        label="Email"
        type="email"
        defaultValue={contact.email}
      />
      <TextField
        name="phone"
        label="Phone"
        type="tel"
        defaultValue={contact.phone}
      />
      <SelectField
        name="companyId"
        label="Gym"
        defaultValue={contact.companyId}
        emptyLabel="No Gym"
        options={gyms.map((gym) => ({ label: gym.name, value: gym.id }))}
      />
      <SelectField
        name="status"
        label="Status"
        defaultValue={contact.status}
        emptyLabel="No Status"
        options={optionsWithCurrent(CONTACT_STATUS_OPTIONS, contact.status)}
      />
      <TextareaField name="notes" label="Notes" defaultValue={contact.notes} />
    </EditPanel>
  )
}

export function InteractionEditPanel({
  interaction,
  gyms,
  contacts,
  onCancel,
  onSaved,
}: {
  interaction: CrmInteraction
  gyms: CrmGym[]
  contacts: CrmContact[]
  onCancel: () => void
  onSaved: () => void
}) {
  const router = useRouter()
  const updateInteraction = useServerFn(updateInteractionFn)
  const [state, setState] = useState<SaveState>("idle")
  const [error, setError] = useState<string | null>(null)

  useUnsavedChanges(state === "dirty")

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setState("saving")
    setError(null)
    try {
      await updateInteraction({
        data: {
          id: interaction.id,
          source: interaction.source,
          title: field(form, "title"),
          date: field(form, "date"),
          channel: field(form, "channel"),
          status: field(form, "status"),
          companyId: field(form, "companyId"),
          contactId: field(form, "contactId"),
          notes: field(form, "notes"),
          content: field(form, "content"),
        },
      })
      await router.invalidate()
      setState("saved")
      onSaved()
    } catch (caught) {
      setError(messageFor(caught))
      setState("dirty")
    }
  }

  return (
    <EditPanel
      title="Edit Interaction"
      state={state}
      error={error}
      onSubmit={handleSubmit}
      onChange={() => setState("dirty")}
      onCancel={onCancel}
    >
      <TextField
        name="title"
        label="Subject"
        defaultValue={interaction.title}
        required
      />
      <TextField
        name="date"
        label="Date"
        type="date"
        defaultValue={interaction.date}
      />
      <SelectField
        name="channel"
        label="Channel"
        defaultValue={interaction.channel}
        emptyLabel="No Channel"
        options={optionsWithCurrent(
          INTERACTION_CHANNEL_OPTIONS,
          interaction.channel,
        )}
      />
      <SelectField
        name="status"
        label="Status"
        defaultValue={interaction.status}
        emptyLabel="No Status"
        options={optionsWithCurrent(
          INTERACTION_STATUS_OPTIONS,
          interaction.status,
        )}
      />
      <SelectField
        name="companyId"
        label="Gym"
        defaultValue={interaction.companyId}
        emptyLabel="No Gym"
        options={gyms.map((gym) => ({ label: gym.name, value: gym.id }))}
      />
      <SelectField
        name="contactId"
        label="Contact"
        defaultValue={interaction.contactId}
        emptyLabel="No Contact"
        options={contacts.map((contact) => ({
          label: contact.fullName,
          value: contact.id,
        }))}
      />
      <TextareaField
        name="notes"
        label="Notes"
        defaultValue={interaction.notes}
      />
      <TextareaField
        name="content"
        label={interaction.source === "Meeting" ? "Outcome" : "Content"}
        defaultValue={interaction.content}
      />
    </EditPanel>
  )
}

function EditPanel({
  title,
  state,
  error,
  onSubmit,
  onChange,
  onCancel,
  children,
}: {
  title: string
  state: SaveState
  error: string | null
  onSubmit: React.FormEventHandler<HTMLFormElement>
  onChange: React.FormEventHandler<HTMLFormElement>
  onCancel: () => void
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-border p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase text-muted-foreground">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {statusLabel(state)}
        </p>
      </div>
      <form onSubmit={onSubmit} onChange={onChange} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {children}
        </div>
        {error ? (
          <p className="text-sm text-destructive" aria-live="polite">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Cancel
          </button>
          <button
            type="submit"
            disabled={state === "saving"}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {state === "saving" ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </section>
  )
}

function optionsWithCurrent(options: string[], current: string | null) {
  const values =
    current && !options.includes(current) ? [current, ...options] : options
  return values.map((value) => ({ label: value, value }))
}

function TextField({
  name,
  label,
  defaultValue,
  required,
  type = "text",
}: {
  name: string
  label: string
  defaultValue?: string | null
  required?: boolean
  type?: string
}) {
  return (
    <label className="space-y-1 text-sm font-medium">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        autoComplete="off"
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  )
}

function SelectField({
  name,
  label,
  defaultValue,
  emptyLabel,
  options,
}: {
  name: string
  label: string
  defaultValue?: string | null
  emptyLabel: string
  options: Array<{ label: string; value: string }>
}) {
  return (
    <label className="space-y-1 text-sm font-medium">
      <span>{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function TextareaField({
  name,
  label,
  defaultValue,
}: {
  name: string
  label: string
  defaultValue?: string | null
}) {
  return (
    <label className="space-y-1 text-sm font-medium md:col-span-2 xl:col-span-3">
      <span>{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        rows={4}
        autoComplete="off"
        className="min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  )
}

function field(form: FormData, name: string) {
  return String(form.get(name) ?? "")
}

function messageFor(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Could not save changes. Review the fields and try again."
}

function statusLabel(state: SaveState) {
  if (state === "dirty") return "Unsaved changes"
  if (state === "saving") return "Saving…"
  if (state === "saved") return "Saved"
  if (state === "error") return "Save failed"
  return "Ready to edit"
}

function useUnsavedChanges(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [enabled])
}

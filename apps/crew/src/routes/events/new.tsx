import type { FormEvent, ReactNode } from "react"
import { useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { createCrewEventFn } from "@/server-fns/crew-event-settings-fns"
import { generateSlug } from "@/utils/slugify"

export const Route = createFileRoute("/events/new")({
  component: NewEventPage,
})

function getLocalDateInputValue() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function NewEventPage() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [name, setName] = useState("Pilot Weekend")
  const [slug, setSlug] = useState("pilot-weekend")
  const [organizingTeamId, setOrganizingTeamId] = useState("")
  const [startDate, setStartDate] = useState(getLocalDateInputValue)
  const [endDate, setEndDate] = useState(getLocalDateInputValue)
  const [description, setDescription] = useState("")
  const [sourcePlatform, setSourcePlatform] = useState("")
  const [sourceEventUrl, setSourceEventUrl] = useState("")
  const [externalRegistrationUrl, setExternalRegistrationUrl] = useState("")
  const [acquisitionSource, setAcquisitionSource] = useState("")
  const [crewPlan, setCrewPlan] = useState<
    "self_serve" | "concierge" | "full_platform"
  >("self_serve")
  const [settings, setSettings] = useState('{\n  "assumptions": []\n}')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const result = await createCrewEventFn({
        data: {
          organizingTeamId,
          name,
          slug,
          startDate,
          endDate,
          description,
          sourcePlatform,
          sourceEventUrl,
          externalRegistrationUrl,
          acquisitionSource,
          crewPlan,
          settings,
        },
      })

      toast.success("Crew event created")
      await navigate({
        to: "/events/$eventId",
        params: { eventId: result.event.competition.id },
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create Crew event",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleNameChange(value: string) {
    setName(value)
    setSlug(generateSlug(value))
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-3xl font-semibold">New Crew event</h1>
        <p className="text-muted-foreground">
          Create a normal competition and attach its Crew settings row.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-md border bg-card p-5 shadow-sm"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Event name" htmlFor="crew-event-name">
            <input
              id="crew-event-name"
              value={name}
              onChange={(event) => handleNameChange(event.target.value)}
              required
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </Field>
          <Field label="Slug" htmlFor="crew-event-slug">
            <input
              id="crew-event-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              required
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </Field>
          <Field label="Organizing team ID" htmlFor="crew-organizing-team-id">
            <input
              id="crew-organizing-team-id"
              value={organizingTeamId}
              onChange={(event) => setOrganizingTeamId(event.target.value)}
              required
              placeholder="team_..."
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </Field>
          <Field label="Crew plan" htmlFor="crew-event-plan">
            <select
              id="crew-event-plan"
              value={crewPlan}
              onChange={(event) =>
                setCrewPlan(
                  event.target.value as
                    | "self_serve"
                    | "concierge"
                    | "full_platform",
                )
              }
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="self_serve">Self serve</option>
              <option value="concierge">Concierge</option>
              <option value="full_platform">Full platform</option>
            </select>
          </Field>
          <Field label="Start date" htmlFor="crew-event-start-date">
            <input
              id="crew-event-start-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              required
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </Field>
          <Field label="End date" htmlFor="crew-event-end-date">
            <input
              id="crew-event-end-date"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              required
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </Field>
          <Field label="Source platform" htmlFor="crew-source-platform">
            <input
              id="crew-source-platform"
              value={sourcePlatform}
              onChange={(event) => setSourcePlatform(event.target.value)}
              placeholder="Competition Corner"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </Field>
          <Field label="Acquisition source" htmlFor="crew-acquisition-source">
            <input
              id="crew-acquisition-source"
              value={acquisitionSource}
              onChange={(event) => setAcquisitionSource(event.target.value)}
              placeholder="Concierge import"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </Field>
          <Field label="Source event URL" htmlFor="crew-source-event-url" wide>
            <input
              id="crew-source-event-url"
              value={sourceEventUrl}
              onChange={(event) => setSourceEventUrl(event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </Field>
          <Field
            label="External registration URL"
            htmlFor="crew-external-registration-url"
            wide
          >
            <input
              id="crew-external-registration-url"
              value={externalRegistrationUrl}
              onChange={(event) =>
                setExternalRegistrationUrl(event.target.value)
              }
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </Field>
          <Field label="Description" htmlFor="crew-event-description" wide>
            <textarea
              id="crew-event-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Crew assumptions" htmlFor="crew-assumptions" wide>
            <textarea
              id="crew-assumptions"
              value={settings}
              onChange={(event) => setSettings(event.target.value)}
              className="min-h-32 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
            />
          </Field>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {isSubmitting ? "Creating..." : "Create Crew event"}
          </button>
          <Link
            to="/events"
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  )
}

function Field({
  label,
  htmlFor,
  wide = false,
  children,
}: {
  label: string
  htmlFor: string
  wide?: boolean
  children: ReactNode
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={wide ? "space-y-2 sm:col-span-2" : "space-y-2"}
    >
      <span className="text-sm font-medium" id={`${htmlFor}-label`}>
        {label}
      </span>
      {children}
    </label>
  )
}

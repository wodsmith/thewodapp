import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router"
import { Save } from "lucide-react"
import type { FormEvent, ReactNode } from "react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  type CrewOrganizerSetupState,
  type CrewSetupChecklistKey,
  crewSetupChecklistItems,
  mergeOrganizerCrewSetupState,
  parseCrewSettings,
  serializeCrewSettings,
  toOrganizerCrewSetupState,
} from "@/lib/crew-event-setup"
import { updateCrewEventSettingsFn } from "@/server-fns/crew-event-settings-fns"

export const Route = createFileRoute("/events/$eventId/setup")({
  component: EventSetupPage,
})

const parentRoute = getRouteApi("/events/$eventId")

// @lat: [[crew#Event Setup Dashboard]]
function EventSetupPage() {
  const router = useRouter()
  const { event } = parentRoute.useLoaderData()
  const parsedSettings = parseCrewSettings(event.settings.settings)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sourcePlatform, setSourcePlatform] = useState(
    event.settings.sourcePlatform ?? "",
  )
  const [externalRegistrationUrl, setExternalRegistrationUrl] = useState(
    event.settings.externalRegistrationUrl ?? "",
  )
  const [setup, setSetup] = useState<CrewOrganizerSetupState>(
    toOrganizerCrewSetupState(parsedSettings.setup),
  )
  const checklistProgress = calculateOrganizerChecklistProgress(setup)

  useEffect(() => {
    const nextSettings = parseCrewSettings(event.settings.settings)
    setSourcePlatform(event.settings.sourcePlatform ?? "")
    setExternalRegistrationUrl(event.settings.externalRegistrationUrl ?? "")
    setSetup(toOrganizerCrewSetupState(nextSettings.setup))
  }, [event])

  async function handleSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault()
    setIsSubmitting(true)

    try {
      const currentSettings = parseCrewSettings(event.settings.settings)

      await updateCrewEventSettingsFn({
        data: {
          competitionId: event.competition.id,
          sourcePlatform,
          externalRegistrationUrl,
          settings: serializeCrewSettings(
            event.settings.settings,
            mergeOrganizerCrewSetupState(currentSettings.setup, setup),
          ),
        },
      })

      toast.success("Crew setup saved")
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save setup",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function updateChecklist(key: CrewSetupChecklistKey, checked: boolean) {
    setSetup((current) => ({
      ...current,
      checklist: {
        ...current.checklist,
        [key]: checked,
      },
    }))
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-6 lg:grid-cols-[1fr_20rem]"
    >
      <section className="space-y-6">
        <section className="rounded-md border bg-card p-5 shadow-sm">
          <div>
            <h2 className="text-xl font-semibold">Event basics</h2>
            <p className="text-sm text-muted-foreground">
              Confirm the details volunteers and staff will use for planning.
            </p>
          </div>

          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <Fact label="Event name" value={event.competition.name} />
            <Fact
              label="Dates"
              value={`${event.competition.startDate} to ${event.competition.endDate}`}
            />
            <Fact
              label="Timezone"
              value={event.competition.timezone ?? "Not set"}
            />
          </dl>
        </section>

        <section className="rounded-md border bg-card p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Volunteer setup</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field
              label="Registration platform"
              htmlFor="crew-settings-source-platform"
            >
              <input
                id="crew-settings-source-platform"
                value={sourcePlatform}
                onChange={(changeEvent) =>
                  setSourcePlatform(changeEvent.target.value)
                }
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </Field>
            <Field
              label="Public volunteer signup link"
              htmlFor="crew-settings-external-registration-url"
            >
              <input
                id="crew-settings-external-registration-url"
                value={externalRegistrationUrl}
                onChange={(changeEvent) =>
                  setExternalRegistrationUrl(changeEvent.target.value)
                }
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </Field>
            <Field
              label="Expected volunteer target"
              htmlFor="crew-setup-volunteer-target"
            >
              <input
                id="crew-setup-volunteer-target"
                value={setup.volunteerTarget}
                onChange={(changeEvent) =>
                  setSetup((current) => ({
                    ...current,
                    volunteerTarget: changeEvent.target.value,
                  }))
                }
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </Field>
            <Field label="Staffing lead" htmlFor="crew-setup-staffing-lead">
              <input
                id="crew-setup-staffing-lead"
                value={setup.staffingLead}
                onChange={(changeEvent) =>
                  setSetup((current) => ({
                    ...current,
                    staffingLead: changeEvent.target.value,
                  }))
                }
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </Field>
            <Field
              label="Role assumptions"
              htmlFor="crew-setup-assumptions"
              wide
            >
              <textarea
                id="crew-setup-assumptions"
                value={setup.assumptions}
                onChange={(changeEvent) =>
                  setSetup((current) => ({
                    ...current,
                    assumptions: changeEvent.target.value,
                  }))
                }
                className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </Field>
          </div>
        </section>
      </section>

      <aside className="h-fit rounded-md border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Setup checklist
        </h2>
        <p className="mt-2 text-2xl font-semibold">
          {checklistProgress.completed}/{checklistProgress.total}
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${checklistProgress.percent}%` }}
          />
        </div>

        <div className="mt-5 space-y-3">
          {crewSetupChecklistItems.map((item) => (
            <label
              key={item.key}
              className="flex items-start gap-3 rounded-md border bg-background px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={setup.checklist[item.key]}
                onChange={(changeEvent) =>
                  updateChecklist(item.key, changeEvent.target.checked)
                }
                className="mt-0.5 size-4"
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>

        {parsedSettings.parseError ? (
          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Existing setup data needs review before it can be saved.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          <Save className="size-4" aria-hidden="true" />
          {isSubmitting ? "Saving..." : "Save setup"}
        </button>
      </aside>
    </form>
  )
}

function calculateOrganizerChecklistProgress(setup: CrewOrganizerSetupState) {
  const completed = crewSetupChecklistItems.filter(
    (item) => setup.checklist[item.key],
  ).length
  const total = crewSetupChecklistItems.length

  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  }
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-medium">{value}</dd>
    </div>
  )
}

interface FieldProps {
  label: string
  htmlFor: string
  wide?: boolean
  children: ReactNode
}

function Field({ label, htmlFor, wide = false, children }: FieldProps) {
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

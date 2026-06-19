import type { FormEvent, ReactNode } from "react"
import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { toast } from "sonner"
import {
  getCrewEventFn,
  updateCrewEventSettingsFn,
} from "@/server-fns/crew-event-settings-fns"

export const Route = createFileRoute("/events/$eventId/")({
  loader: async ({ params }) => {
    const result = await getCrewEventFn({ data: { eventId: params.eventId } })
    if (!result.event) {
      throw new Error("Crew event not found")
    }
    return { event: result.event }
  },
  component: EventOverviewPage,
})

function EventOverviewPage() {
  const router = useRouter()
  const { event } = Route.useLoaderData()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [crewOnly, setCrewOnly] = useState(event.settings.crewOnly)
  const [sourcePlatform, setSourcePlatform] = useState(
    event.settings.sourcePlatform ?? "",
  )
  const [sourceEventUrl, setSourceEventUrl] = useState(
    event.settings.sourceEventUrl ?? "",
  )
  const [externalRegistrationUrl, setExternalRegistrationUrl] = useState(
    event.settings.externalRegistrationUrl ?? "",
  )
  const [lifecycle, setLifecycle] = useState(event.settings.lifecycle)
  const [conciergeStatus, setConciergeStatus] = useState(
    event.settings.conciergeStatus,
  )
  const [crewPlan, setCrewPlan] = useState(event.settings.crewPlan)
  const [fullPlatformCreditCents, setFullPlatformCreditCents] = useState(
    String(event.settings.fullPlatformCreditCents),
  )
  const [acquisitionSource, setAcquisitionSource] = useState(
    event.settings.acquisitionSource ?? "",
  )
  const [settings, setSettings] = useState(event.settings.settings ?? "")

  async function handleSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault()
    setIsSubmitting(true)

    try {
      await updateCrewEventSettingsFn({
        data: {
          competitionId: event.competition.id,
          crewOnly,
          sourcePlatform,
          sourceEventUrl,
          externalRegistrationUrl,
          lifecycle,
          conciergeStatus,
          crewPlan,
          fullPlatformCreditCents: Number(fullPlatformCreditCents || 0),
          acquisitionSource,
          settings,
        },
      })

      toast.success("Crew settings saved")
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save settings",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <form
        onSubmit={handleSubmit}
        className="rounded-md border bg-card p-5 shadow-sm"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Crew settings</h2>
            <p className="text-sm text-muted-foreground">
              One Crew settings row attached to this competition.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={crewOnly}
              onChange={(changeEvent) =>
                setCrewOnly(changeEvent.target.checked)
              }
              className="size-4"
            />
            Crew-only
          </label>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Lifecycle" htmlFor="crew-settings-lifecycle">
            <select
              id="crew-settings-lifecycle"
              value={lifecycle}
              onChange={(changeEvent) =>
                setLifecycle(
                  changeEvent.target.value as
                    | "draft"
                    | "setup"
                    | "importing"
                    | "ready"
                    | "archived",
                )
              }
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="draft">Draft</option>
              <option value="setup">Setup</option>
              <option value="importing">Importing</option>
              <option value="ready">Ready</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
          <Field
            label="Concierge status"
            htmlFor="crew-settings-concierge-status"
          >
            <select
              id="crew-settings-concierge-status"
              value={conciergeStatus}
              onChange={(changeEvent) =>
                setConciergeStatus(
                  changeEvent.target.value as
                    | "not_started"
                    | "in_progress"
                    | "ready"
                    | "blocked",
                )
              }
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="ready">Ready</option>
              <option value="blocked">Blocked</option>
            </select>
          </Field>
          <Field label="Crew plan" htmlFor="crew-settings-plan">
            <select
              id="crew-settings-plan"
              value={crewPlan}
              onChange={(changeEvent) =>
                setCrewPlan(
                  changeEvent.target.value as
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
          <Field
            label="Full platform credit cents"
            htmlFor="crew-settings-credit-cents"
          >
            <input
              id="crew-settings-credit-cents"
              type="number"
              min="0"
              value={fullPlatformCreditCents}
              onChange={(changeEvent) =>
                setFullPlatformCreditCents(changeEvent.target.value)
              }
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </Field>
          <Field
            label="Source platform"
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
            label="Acquisition source"
            htmlFor="crew-settings-acquisition-source"
          >
            <input
              id="crew-settings-acquisition-source"
              value={acquisitionSource}
              onChange={(changeEvent) =>
                setAcquisitionSource(changeEvent.target.value)
              }
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </Field>
          <Field
            label="Source event URL"
            htmlFor="crew-settings-source-event-url"
            wide
          >
            <input
              id="crew-settings-source-event-url"
              value={sourceEventUrl}
              onChange={(changeEvent) =>
                setSourceEventUrl(changeEvent.target.value)
              }
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </Field>
          <Field
            label="External registration URL"
            htmlFor="crew-settings-external-registration-url"
            wide
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
            label="Crew assumptions"
            htmlFor="crew-settings-assumptions"
            wide
          >
            <textarea
              id="crew-settings-assumptions"
              value={settings}
              onChange={(changeEvent) => setSettings(changeEvent.target.value)}
              className="min-h-36 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
            />
          </Field>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {isSubmitting ? "Saving..." : "Save settings"}
        </button>
      </form>

      <aside className="rounded-md border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Competition
        </h2>
        <dl className="mt-4 space-y-4 text-sm">
          <div>
            <dt className="text-muted-foreground">ID</dt>
            <dd className="break-all font-mono">{event.competition.id}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Slug</dt>
            <dd className="font-medium">{event.competition.slug}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Team</dt>
            <dd className="break-all font-mono">
              {event.competition.organizingTeamId}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium">{event.competition.status}</dd>
          </div>
        </dl>
      </aside>
    </section>
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

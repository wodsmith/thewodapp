import type { FormEvent, ReactNode } from "react"
import { useEffect, useState } from "react"
import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router"
import { Save } from "lucide-react"
import { toast } from "sonner"
import { GuidedSetupShell } from "@/components/crew-guided-setup/guided-setup-shell"
import { CrewTemplatePanel } from "@/components/crew-templates/crew-template-panel"
import type {
  CrewGuidedSetupOperatorStatus,
  CrewGuidedSetupStepKey,
} from "@/lib/crew/guided-setup"
import type { CrewRoleShiftTemplateRef } from "@/lib/crew/templates"
import {
  crewSetupChecklistItems,
  parseCrewSettings,
  serializeCrewSettings,
  type CrewSetupChecklistKey,
} from "@/lib/crew-event-setup"
import { updateCrewEventSettingsFn } from "@/server-fns/crew-event-settings-fns"
import {
  getCrewGuidedSetupPageFn,
  updateCrewGuidedSetupStepFn,
} from "@/server-fns/crew-guided-setup-fns"
import {
  applyCrewTemplateFn,
  getCrewTemplatePageFn,
  saveCrewTemplatePresetFn,
} from "@/server-fns/crew-template-fns"

export const Route = createFileRoute("/events/$eventId/setup")({
  loader: async ({ params }) => {
    const [guidedSetupPage, templatePage] = await Promise.all([
      getCrewGuidedSetupPageFn({ data: { eventId: params.eventId } }),
      getCrewTemplatePageFn({ data: { eventId: params.eventId } }),
    ])

    return {
      ...guidedSetupPage,
      templatePage,
    }
  },
  component: EventSetupPage,
})

const parentRoute = getRouteApi("/events/$eventId")

// @lat: [[crew#Event Setup Dashboard]]
// @lat: [[crew#Guided Setup State]]
function EventSetupPage() {
  const router = useRouter()
  const { event } = parentRoute.useLoaderData()
  const { guidedSetup, templatePage } = Route.useLoaderData()
  const parsedSettings = parseCrewSettings(event.settings.settings)
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
  const [setup, setSetup] = useState(parsedSettings.setup)

  useEffect(() => {
    const nextSettings = parseCrewSettings(event.settings.settings)
    setCrewOnly(event.settings.crewOnly)
    setSourcePlatform(event.settings.sourcePlatform ?? "")
    setSourceEventUrl(event.settings.sourceEventUrl ?? "")
    setExternalRegistrationUrl(event.settings.externalRegistrationUrl ?? "")
    setLifecycle(event.settings.lifecycle)
    setConciergeStatus(event.settings.conciergeStatus)
    setCrewPlan(event.settings.crewPlan)
    setFullPlatformCreditCents(String(event.settings.fullPlatformCreditCents))
    setAcquisitionSource(event.settings.acquisitionSource ?? "")
    setSetup(nextSettings.setup)
  }, [event])

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
          settings: serializeCrewSettings(event.settings.settings, setup),
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

  async function handleGuidedSetupUpdate(data: {
    eventId: string
    stepKey: CrewGuidedSetupStepKey
    status: CrewGuidedSetupOperatorStatus | null
    note: string
  }) {
    try {
      await updateCrewGuidedSetupStepFn({ data })
      toast.success("Guided setup step saved")
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save setup step",
      )
    }
  }

  async function handleApplyTemplate(data: {
    templateRef: CrewRoleShiftTemplateRef
    fillEmptyAssumptions: boolean
  }) {
    try {
      const result = await applyCrewTemplateFn({
        data: {
          eventId: event.competition.id,
          templateRef: data.templateRef,
          mode: "append_missing",
          fillEmptyAssumptions: data.fillEmptyAssumptions,
        },
      })
      toast.success(
        `Template applied: ${result.createdShiftCount} shifts added${result.assumptionsUpdated ? ", assumptions filled" : ""}`,
      )
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to apply template",
      )
    }
  }

  async function handleSaveTemplatePreset(data: {
    templateRef: CrewRoleShiftTemplateRef
    name: string
  }) {
    try {
      await saveCrewTemplatePresetFn({
        data: {
          eventId: event.competition.id,
          templateRef: data.templateRef,
          name: data.name,
        },
      })
      toast.success("Template preset saved")
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save preset",
      )
    }
  }

  return (
    <section className="space-y-6">
      <GuidedSetupShell
        eventId={event.competition.id}
        guidedSetup={guidedSetup}
        onUpdate={(data) =>
          handleGuidedSetupUpdate({
            eventId: event.competition.id,
            ...data,
          })
        }
      />

      <CrewTemplatePanel
        templatePage={templatePage}
        onApply={handleApplyTemplate}
        onSavePreset={handleSaveTemplatePreset}
      />

      <form
        onSubmit={handleSubmit}
        className="grid gap-6 lg:grid-cols-[1fr_20rem]"
      >
        <section className="space-y-6">
          <section className="rounded-md border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Setup</h2>
                <p className="text-sm text-muted-foreground">
                  Manage lifecycle, concierge status, source details, and
                  operator assumptions.
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
            </div>
          </section>

          <section className="rounded-md border bg-card p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Source</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
            </div>
          </section>

          <section className="rounded-md border bg-card p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Concierge notes</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field
                label="Desired go-live date"
                htmlFor="crew-setup-go-live-date"
              >
                <input
                  id="crew-setup-go-live-date"
                  type="date"
                  value={setup.desiredGoLiveDate}
                  onChange={(changeEvent) =>
                    setSetup((current) => ({
                      ...current,
                      desiredGoLiveDate: changeEvent.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                />
              </Field>
              <Field
                label="Volunteer target"
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
                label="Source contact name"
                htmlFor="crew-setup-source-contact-name"
              >
                <input
                  id="crew-setup-source-contact-name"
                  value={setup.sourceContactName}
                  onChange={(changeEvent) =>
                    setSetup((current) => ({
                      ...current,
                      sourceContactName: changeEvent.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                />
              </Field>
              <Field
                label="Source contact email"
                htmlFor="crew-setup-source-contact-email"
                wide
              >
                <input
                  id="crew-setup-source-contact-email"
                  type="email"
                  value={setup.sourceContactEmail}
                  onChange={(changeEvent) =>
                    setSetup((current) => ({
                      ...current,
                      sourceContactEmail: changeEvent.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                />
              </Field>
              <Field label="Assumptions" htmlFor="crew-setup-assumptions" wide>
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
              <Field label="Internal notes" htmlFor="crew-setup-notes" wide>
                <textarea
                  id="crew-setup-notes"
                  value={setup.internalNotes}
                  onChange={(changeEvent) =>
                    setSetup((current) => ({
                      ...current,
                      internalNotes: changeEvent.target.value,
                    }))
                  }
                  className="min-h-32 w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </Field>
            </div>
          </section>
        </section>

        <aside className="h-fit rounded-md border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            Setup checklist
          </h2>
          <div className="mt-4 space-y-3">
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
              Existing settings JSON is invalid. Saving will preserve the raw
              text as legacySettingsText.
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
    </section>
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

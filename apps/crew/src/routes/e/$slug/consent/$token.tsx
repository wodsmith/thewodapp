import { createFileRoute, notFound, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import type {
  CrewVolunteerConsentCenterAction,
  CrewVolunteerConsentCenterScope,
  CrewVolunteerConsentCenterScopeView,
} from "@/lib/crew/volunteer-consent-center"
import {
  getCrewVolunteerConsentCenterTokenFn,
  updateCrewVolunteerConsentCenterTokenFn,
} from "@/server-fns/crew-volunteer-consent-fns"

export const Route = createFileRoute("/e/$slug/consent/$token")({
  loader: async ({ params }) => {
    const result = await getCrewVolunteerConsentCenterTokenFn({
      data: { slug: params.slug, token: params.token },
    })
    if (result.status !== "valid") {
      throw notFound()
    }
    return result
  },
  component: CrewVolunteerConsentCenterPage,
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.view
          ? `${loaderData.view.eventName} Consent Center | WODsmith Crew`
          : "Volunteer Consent Center | WODsmith Crew",
      },
    ],
  }),
})

function CrewVolunteerConsentCenterPage() {
  const { slug, token } = Route.useParams()
  const { view } = Route.useLoaderData()
  const router = useRouter()
  const updateConsent = useServerFn(updateCrewVolunteerConsentCenterTokenFn)
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  async function handleConsentAction(
    scope: CrewVolunteerConsentCenterScope,
    action: CrewVolunteerConsentCenterAction,
  ) {
    const pendingKey = `${scope}:${action}`
    setPendingAction(pendingKey)
    try {
      const result = await updateConsent({
        data: { slug, token, scope, action },
      })
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Consent update failed",
      )
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <section className="rounded-md border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">
          Volunteer consent center
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{view.eventName}</h1>
        <p className="mt-2 text-muted-foreground">{view.volunteerLabel}</p>
      </section>

      <section className="grid gap-4">
        {view.scopes.map((scope) => (
          <ConsentScopeCard
            key={scope.scope}
            scope={scope}
            pendingAction={pendingAction}
            onAction={handleConsentAction}
          />
        ))}
      </section>

      <section className="rounded-md border bg-card p-5 text-sm text-muted-foreground shadow-sm">
        <ul className="grid gap-2">
          {view.notices.map((notice) => (
            <li key={notice}>{notice}</li>
          ))}
        </ul>
      </section>
    </main>
  )
}

function ConsentScopeCard({
  scope,
  pendingAction,
  onAction,
}: {
  scope: CrewVolunteerConsentCenterScopeView
  pendingAction: string | null
  onAction: (
    scope: CrewVolunteerConsentCenterScope,
    action: CrewVolunteerConsentCenterAction,
  ) => Promise<void>
}) {
  const grantPending = pendingAction === `${scope.scope}:grant`
  const revokePending = pendingAction === `${scope.scope}:revoke`

  return (
    <article className="rounded-md border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            {scope.granted ? (
              <ShieldCheck className="size-5 text-emerald-600" />
            ) : (
              <ShieldOff className="size-5 text-muted-foreground" />
            )}
            <h2 className="text-lg font-semibold">{scope.label}</h2>
          </div>
          <p className="text-sm text-muted-foreground">{scope.description}</p>
        </div>
        <span
          className={`inline-flex w-fit rounded-md border px-2 py-1 text-xs font-medium ${
            scope.granted
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-muted bg-muted/40 text-muted-foreground"
          }`}
        >
          {scope.statusLabel}
        </span>
      </div>

      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <InfoRow
          label="Last updated"
          value={formatConsentDate(scope.lastUpdatedAt)}
        />
        <InfoRow
          label="Consent text"
          value={scope.consentTextVersion ?? "Not recorded"}
        />
      </dl>

      {scope.disabledReason ? (
        <p className="mt-4 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {scope.disabledReason}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!scope.canGrant || !!pendingAction}
          onClick={() => onAction(scope.scope, "grant")}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {grantPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Grant
        </button>
        <button
          type="button"
          disabled={!scope.canRevoke || !!pendingAction}
          onClick={() => onAction(scope.scope, "revoke")}
          className="inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          {revokePending ? <Loader2 className="size-4 animate-spin" /> : null}
          Revoke
        </button>
      </div>
    </article>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  )
}

function formatConsentDate(value: string | null) {
  if (!value) return "Not recorded"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not recorded"
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

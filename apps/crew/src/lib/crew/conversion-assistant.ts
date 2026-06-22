// @lat: [[crew#Full WODsmith Conversion Assistant]]
import type { CrewEventConversionStatus } from "../../db/schemas/crew-volunteer-intelligence"
import type { CrewBillingState } from "../../db/schemas/crew-event-settings"
import type { CrewReadinessPageData } from "../../server/crew-readiness.server"

export type CrewConversionChecklistStatus =
  | "ready"
  | "needs_attention"
  | "blocked"

export type CrewConversionFullSetupKey =
  | "divisions"
  | "registration_window"
  | "pricing"
  | "scoring"
  | "public_page"
  | "waivers"
  | "payouts"
  | "athlete_registration"

export type CrewConversionPreservationKey =
  | "competition"
  | "volunteers"
  | "shifts"
  | "heat_schedule"
  | "judge_assignments"
  | "confirmations"
  | "imports"
  | "credits"

export type CrewConversionActionKind =
  | "crew_route"
  | "wodsmith_route"
  | "public_route"
  | "deferred"

export interface CrewConversionAction {
  label: string
  href: string | null
  kind: CrewConversionActionKind
}

export interface CrewConversionChecklistItem<
  TKey extends string = string,
> {
  key: TKey
  label: string
  status: CrewConversionChecklistStatus
  summary: string
  details: string[]
  action: CrewConversionAction
}

export interface CrewConversionSummary {
  total: number
  ready: number
  needsAttention: number
  blocked: number
  progressPercent: number
  highestStatus: CrewConversionChecklistStatus
}

export interface CrewConversionAssistantViewModel {
  event: {
    id: string
    name: string
    slug: string
    crewOnly: boolean
    status: "draft" | "published"
    visibility: "public" | "private"
  }
  conversion: {
    status: CrewEventConversionStatus | null
    label: string
    readOnly: true
    duplicateCompetition: false
  }
  fullSetup: {
    items: CrewConversionChecklistItem<CrewConversionFullSetupKey>[]
    summary: CrewConversionSummary
  }
  preservation: {
    items: CrewConversionChecklistItem<CrewConversionPreservationKey>[]
    summary: CrewConversionSummary
  }
}

export interface BuildCrewConversionAssistantInput {
  event: {
    id: string
    name: string
    slug: string
    crewOnly: boolean
    status: "draft" | "published"
    visibility: "public" | "private"
    registrationOpensAt: string | null
    registrationClosesAt: string | null
    defaultRegistrationFeeCents: number
    settings: string | null
  }
  team: {
    slug: string
    stripeAccountStatus: string | null
  }
  counts: {
    divisionCount: number
    divisionFeeCount: number
    paidDivisionCount: number
    athleteWaiverCount: number
    activeRegistrationCount: number
  }
  readiness: CrewReadinessPageData
  billing: {
    state: CrewBillingState
    planId: string | null
    creditCents: number
    fullPlatformCreditCents: number
  }
  conversionStatus: CrewEventConversionStatus | null
  links: {
    crewEvent: string
    crewSetup: string
    crewImports: string
    crewVolunteers: string
    crewShifts: string
    crewJudges: string
    crewBilling: string
    wodsmithOverview: string
    wodsmithDivisions: string
    wodsmithEdit: string
    wodsmithPricing: string
    wodsmithScoring: string
    wodsmithWaivers: string
    wodsmithRevenue: string
    wodsmithPayouts: string
    publicPage: string
    athleteRegistration: string
  }
}

const conversionStatusLabels: Record<CrewEventConversionStatus, string> = {
  requested: "Requested",
  privacy_reviewed: "Privacy reviewed",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
}

export const crewConversionChecklistStatusLabels: Record<
  CrewConversionChecklistStatus,
  string
> = {
  ready: "Ready",
  needs_attention: "Needs attention",
  blocked: "Blocked",
}

export function buildCrewConversionAssistantViewModel(
  input: BuildCrewConversionAssistantInput,
): CrewConversionAssistantViewModel {
  const fullSetupItems = buildFullSetupItems(input)
  const preservationItems = buildPreservationItems(input)

  return {
    event: {
      id: input.event.id,
      name: input.event.name,
      slug: input.event.slug,
      crewOnly: input.event.crewOnly,
      status: input.event.status,
      visibility: input.event.visibility,
    },
    conversion: {
      status: input.conversionStatus,
      label: input.conversionStatus
        ? conversionStatusLabels[input.conversionStatus]
        : "Not requested",
      readOnly: true,
      duplicateCompetition: false,
    },
    fullSetup: {
      items: fullSetupItems,
      summary: summarizeConversionChecklist(fullSetupItems),
    },
    preservation: {
      items: preservationItems,
      summary: summarizeConversionChecklist(preservationItems),
    },
  }
}

export function summarizeConversionChecklist(
  items: CrewConversionChecklistItem[],
): CrewConversionSummary {
  const ready = items.filter((item) => item.status === "ready").length
  const needsAttention = items.filter(
    (item) => item.status === "needs_attention",
  ).length
  const blocked = items.filter((item) => item.status === "blocked").length
  const total = items.length

  return {
    total,
    ready,
    needsAttention,
    blocked,
    progressPercent: total === 0 ? 0 : Math.round((ready / total) * 100),
    highestStatus:
      blocked > 0
        ? "blocked"
        : needsAttention > 0
          ? "needs_attention"
          : "ready",
  }
}

function buildFullSetupItems(
  input: BuildCrewConversionAssistantInput,
): CrewConversionChecklistItem<CrewConversionFullSetupKey>[] {
  const hasRegistrationWindow = Boolean(
    input.event.registrationOpensAt && input.event.registrationClosesAt,
  )
  const hasScoringConfig = hasJsonObjectKey(input.event.settings, "scoringConfig")
  const hasPaidPricing =
    input.event.defaultRegistrationFeeCents > 0 ||
    input.counts.paidDivisionCount > 0
  const hasPayouts = input.team.stripeAccountStatus === "VERIFIED"
  const publicPageReady = input.event.status === "published"
  const registrationSetupReady =
    publicPageReady &&
    hasRegistrationWindow &&
    input.counts.divisionCount > 0 &&
    input.counts.athleteWaiverCount > 0 &&
    (!hasPaidPricing || hasPayouts)

  return [
    {
      key: "divisions",
      label: "Divisions",
      status: input.counts.divisionCount > 0 ? "ready" : "blocked",
      summary:
        input.counts.divisionCount > 0
          ? `${input.counts.divisionCount} division${plural(input.counts.divisionCount)} configured`
          : "No athlete divisions are configured.",
      details: [
        "Uses the existing competition division model.",
        "No duplicate competition is required.",
      ],
      action: wodsmithAction("Open divisions", input.links.wodsmithDivisions),
    },
    {
      key: "registration_window",
      label: "Registration window",
      status: hasRegistrationWindow ? "ready" : "blocked",
      summary: hasRegistrationWindow
        ? `${input.event.registrationOpensAt} to ${input.event.registrationClosesAt}`
        : "Athlete registration dates are missing.",
      details: [
        input.event.registrationOpensAt
          ? `Opens: ${input.event.registrationOpensAt}`
          : "Registration open date is not set.",
        input.event.registrationClosesAt
          ? `Closes: ${input.event.registrationClosesAt}`
          : "Registration close date is not set.",
      ],
      action: wodsmithAction("Open event settings", input.links.wodsmithEdit),
    },
    {
      key: "pricing",
      label: "Pricing",
      status:
        input.counts.divisionCount === 0
          ? "blocked"
          : hasPaidPricing
            ? "ready"
            : "needs_attention",
      summary: hasPaidPricing
        ? "Paid registration pricing is configured."
        : "Pricing is currently free or unconfirmed.",
      details: [
        `Default fee: ${formatMoney(input.event.defaultRegistrationFeeCents)}.`,
        `${input.counts.divisionFeeCount}/${input.counts.divisionCount} divisions have explicit fee rows.`,
      ],
      action: wodsmithAction("Open pricing", input.links.wodsmithPricing),
    },
    {
      key: "scoring",
      label: "Scoring",
      status: hasScoringConfig ? "ready" : "needs_attention",
      summary: hasScoringConfig
        ? "Scoring configuration is saved."
        : "Scoring should be confirmed before launch.",
      details: [
        "The assistant checks for saved competition scoring configuration.",
      ],
      action: wodsmithAction("Open scoring", input.links.wodsmithScoring),
    },
    {
      key: "public_page",
      label: "Public page",
      status: publicPageReady ? "ready" : "blocked",
      summary: publicPageReady
        ? `Competition page is ${input.event.visibility}.`
        : "Competition is still in draft.",
      details: [
        `Status: ${input.event.status}.`,
        `Visibility: ${input.event.visibility}.`,
      ],
      action: publicAction("Open public page", input.links.publicPage),
    },
    {
      key: "waivers",
      label: "Waivers",
      status: input.counts.athleteWaiverCount > 0 ? "ready" : "blocked",
      summary:
        input.counts.athleteWaiverCount > 0
          ? `${input.counts.athleteWaiverCount} athlete waiver${plural(input.counts.athleteWaiverCount)} required`
          : "No required athlete waivers are configured.",
      details: ["Volunteer waivers stay separate from athlete waivers."],
      action: wodsmithAction("Open waivers", input.links.wodsmithWaivers),
    },
    {
      key: "payouts",
      label: "Payouts",
      status: hasPayouts ? "ready" : hasPaidPricing ? "blocked" : "needs_attention",
      summary: hasPayouts
        ? "Organizer payouts are connected."
        : hasPaidPricing
          ? "Paid registration needs a verified payout account."
          : "Payout setup can wait while registration remains free.",
      details: [
        `Stripe account status: ${input.team.stripeAccountStatus ?? "not connected"}.`,
      ],
      action: wodsmithAction("Open payouts", input.links.wodsmithPayouts),
    },
    {
      key: "athlete_registration",
      label: "Athlete registration",
      status:
        input.counts.activeRegistrationCount > 0 || registrationSetupReady
          ? "ready"
          : "blocked",
      summary:
        input.counts.activeRegistrationCount > 0
          ? `${input.counts.activeRegistrationCount} active athlete registration${plural(input.counts.activeRegistrationCount)}`
          : registrationSetupReady
            ? "Registration prerequisites are ready."
            : "Registration cannot open until blocked setup items are resolved.",
      details: [
        "Uses the existing WODsmith athlete registration flow.",
        `${input.counts.activeRegistrationCount} active registration${plural(input.counts.activeRegistrationCount)} on this competition.`,
      ],
      action: publicAction(
        "Open registration",
        input.links.athleteRegistration,
      ),
    },
  ]
}

function buildPreservationItems(
  input: BuildCrewConversionAssistantInput,
): CrewConversionChecklistItem<CrewConversionPreservationKey>[] {
  const facts = input.readiness.facts

  return [
    {
      key: "competition",
      label: "Competition record",
      status: "ready",
      summary: `Reuses ${input.event.id}.`,
      details: [
        "Conversion is modeled on the existing competition row.",
        "No second competition is created by this assistant.",
      ],
      action: crewAction("Open Crew overview", input.links.crewEvent),
    },
    {
      key: "volunteers",
      label: "Volunteers",
      status: facts.roster.total > 0 ? "ready" : "needs_attention",
      summary: `${facts.roster.total} volunteer${plural(facts.roster.total)}, ${facts.roster.assignable} assignable`,
      details: [
        `${facts.roster.active} active, ${facts.roster.pending} pending.`,
        "Contact fields remain server-side and are not included here.",
      ],
      action: crewAction("Open volunteers", input.links.crewVolunteers),
    },
    {
      key: "shifts",
      label: "Shifts",
      status: facts.shifts.totalShifts > 0 ? "ready" : "needs_attention",
      summary: `${facts.shifts.assignedSlots}/${facts.shifts.capacity} shift slots assigned`,
      details: [
        `${facts.shifts.totalShifts} shift${plural(facts.shifts.totalShifts)} stay on the same event.`,
      ],
      action: crewAction("Open shifts", input.links.crewShifts),
    },
    {
      key: "heat_schedule",
      label: "Heat schedule",
      status: facts.schedule.heatCount > 0 ? "ready" : "needs_attention",
      summary: `${facts.schedule.scheduledHeatCount}/${facts.schedule.heatCount} heats scheduled`,
      details: [
        `${facts.schedule.publishedHeatCount}/${facts.schedule.heatCount} heat schedules published.`,
        `${facts.schedule.workoutCount} workout${plural(facts.schedule.workoutCount)} on this competition.`,
      ],
      action: crewAction("Open schedule", input.links.crewSetup),
    },
    {
      key: "judge_assignments",
      label: "Judge assignments",
      status: facts.judge.assignmentCount > 0 ? "ready" : "needs_attention",
      summary: `${facts.judge.assignmentCount} judge heat assignment${plural(facts.judge.assignmentCount)}`,
      details: [
        `${facts.judge.activeVersionCount} active published version${plural(facts.judge.activeVersionCount)}.`,
        "Published assignment rows are preserved, not rewritten.",
      ],
      action: crewAction("Open judges", input.links.crewJudges),
    },
    {
      key: "confirmations",
      label: "Confirmations",
      status:
        facts.shifts.confirmationSummary.confirmed > 0
          ? "ready"
          : "needs_attention",
      summary: `${facts.shifts.confirmationSummary.confirmed}/${facts.shifts.assignedSlots} assignments confirmed`,
      details: [
        `${facts.shifts.confirmationSummary.pending} pending responses.`,
        `${facts.shifts.confirmationSummary.changeRequested} change requests.`,
      ],
      action: crewAction("Open shifts", input.links.crewShifts),
    },
    {
      key: "imports",
      label: "Imports",
      status:
        facts.imports.appliedVolunteerImportCount > 0 ||
        facts.imports.appliedHeatScheduleImportCount > 0
          ? "ready"
          : "needs_attention",
      summary: `${facts.imports.appliedVolunteerImportCount + facts.imports.appliedHeatScheduleImportCount} applied Crew import${plural(facts.imports.appliedVolunteerImportCount + facts.imports.appliedHeatScheduleImportCount)}`,
      details: [
        `${facts.imports.appliedVolunteerImportCount}/${facts.imports.volunteerImportCount} volunteer imports applied.`,
        `${facts.imports.appliedHeatScheduleImportCount}/${facts.imports.heatScheduleImportCount} heat imports applied.`,
      ],
      action: crewAction("Open imports", input.links.crewImports),
    },
    {
      key: "credits",
      label: "Credits",
      status:
        input.billing.fullPlatformCreditCents > 0 || input.billing.creditCents > 0
          ? "ready"
          : "needs_attention",
      summary:
        input.billing.fullPlatformCreditCents > 0
          ? "Full-platform credit is recorded."
          : input.billing.creditCents > 0
            ? "Crew credit is recorded."
            : "No conversion credit is recorded.",
      details: [
        `Crew billing state: ${input.billing.state}.`,
        input.billing.planId
          ? "Crew event plan is recorded on event settings."
          : "No Crew event plan is recorded.",
      ],
      action: crewAction("Open billing", input.links.crewBilling),
    },
  ]
}

function crewAction(label: string, href: string): CrewConversionAction {
  return { label, href, kind: "crew_route" }
}

function wodsmithAction(label: string, href: string): CrewConversionAction {
  return { label, href, kind: "wodsmith_route" }
}

function publicAction(label: string, href: string): CrewConversionAction {
  return { label, href, kind: "public_route" }
}

function hasJsonObjectKey(settingsText: string | null, key: string) {
  if (!settingsText) return false

  try {
    const parsed = JSON.parse(settingsText) as Record<string, unknown>
    return Boolean(parsed && typeof parsed === "object" && parsed[key])
  } catch {
    return false
  }
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100)
}

function plural(count: number) {
  return count === 1 ? "" : "s"
}

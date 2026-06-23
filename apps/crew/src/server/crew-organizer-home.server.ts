// @lat: [[crew#Organizer Home Next Action]]
import { eq } from "drizzle-orm"
import { getDb } from "../db"
import { competitionHeatsTable } from "../db/schemas/competitions"
import {
  CREW_IMPORT_KIND,
  CREW_IMPORT_STATUS,
  crewImportsTable,
} from "../db/schemas/crew-imports"
import {
  type CrewOrganizerNextAction,
  deriveCrewOrganizerNextAction,
} from "../lib/crew/organizer-next-action"
import {
  calculateSetupProgress,
  parseCrewSettings,
} from "../lib/crew-event-setup"
import { getCrewEvent } from "./crew-event-settings.server"
import { getCrewEventRosterShiftSummary } from "./crew-roster-shift.server"

export interface CrewOrganizerHomeFact {
  label: string
  value: string
}

export interface CrewOrganizerHomeActionView {
  key: CrewOrganizerNextAction["key"]
  ctaTo: CrewOrganizerNextAction["ctaTo"]
  title: string
  description: string
  ctaLabel: string
}

export interface CrewOrganizerHomeView {
  nextAction: CrewOrganizerHomeActionView
  supportingFacts: CrewOrganizerHomeFact[]
  secondaryActions: CrewOrganizerHomeActionView[]
  setupParseError: boolean
}

export async function getCrewOrganizerHome(data: {
  eventId: string
}): Promise<{ view: CrewOrganizerHomeView }> {
  const { event } = await getCrewEvent({ eventId: data.eventId })

  if (!event) {
    throw new Error("Crew event not found")
  }

  const [rosterShiftSummary, imports, heatSchedule] = await Promise.all([
    getCrewEventRosterShiftSummary(data),
    loadOrganizerImportSummary(data.eventId),
    loadOrganizerHeatScheduleSummary(data.eventId),
  ])

  const parsedSettings = parseCrewSettings(event.settings.settings)
  const setup = calculateSetupProgress(parsedSettings.setup)
  const confirmations =
    rosterShiftSummary.shiftSummary.confirmationOperationalSummary
  const nextAction = deriveCrewOrganizerNextAction({
    setup,
    imports,
    roster: {
      total: rosterShiftSummary.rosterSummary.total,
      assignable: rosterShiftSummary.rosterSummary.assignable,
    },
    heatSchedule,
    shifts: rosterShiftSummary.shiftSummary,
    confirmations: {
      missing: confirmations.missing,
      pending: confirmations.pending,
      sent: confirmations.sent,
      confirmed: confirmations.confirmed,
      declined: confirmations.declined,
      changeRequested: confirmations.changeRequested,
      noShow: confirmations.noShow,
      replaced: confirmations.replaced,
    },
    dayOfState: {
      hasActiveDayOfData: rosterShiftSummary.shiftSummary.assignedSlots > 0,
      isComplete: false,
    },
  })

  const actionView = toActionView(nextAction)

  return {
    view: {
      nextAction: actionView,
      supportingFacts: buildSupportingFacts({
        rosterTotal: rosterShiftSummary.rosterSummary.total,
        totalShifts: rosterShiftSummary.shiftSummary.totalShifts,
        assignedSlots: rosterShiftSummary.shiftSummary.assignedSlots,
        sentAssignments: countSentAssignments({
          assignedSlots: rosterShiftSummary.shiftSummary.assignedSlots,
          missing: confirmations.missing,
          pending: confirmations.pending,
        }),
        confirmedAssignments:
          rosterShiftSummary.shiftSummary.confirmationSummary.confirmed,
        setup,
      }),
      secondaryActions: buildSecondaryActions(nextAction.key),
      setupParseError: Boolean(parsedSettings.parseError),
    },
  }
}

async function loadOrganizerImportSummary(competitionId: string) {
  const db = getDb()
  const imports = await db
    .select({
      kind: crewImportsTable.kind,
      status: crewImportsTable.status,
    })
    .from(crewImportsTable)
    .where(eq(crewImportsTable.competitionId, competitionId))

  return imports.reduce(
    (summary, row) => {
      if (row.kind === CREW_IMPORT_KIND.VOLUNTEERS) {
        if (row.status === CREW_IMPORT_STATUS.APPLIED) {
          summary.appliedVolunteerImportCount += 1
        }
      } else if (
        row.kind === CREW_IMPORT_KIND.HEAT_SCHEDULE &&
        row.status === CREW_IMPORT_STATUS.APPLIED
      ) {
        summary.appliedHeatScheduleImportCount += 1
      }
      return summary
    },
    {
      appliedVolunteerImportCount: 0,
      appliedHeatScheduleImportCount: 0,
    },
  )
}

async function loadOrganizerHeatScheduleSummary(competitionId: string) {
  const db = getDb()
  const heats = await db
    .select({
      id: competitionHeatsTable.id,
      scheduledTime: competitionHeatsTable.scheduledTime,
    })
    .from(competitionHeatsTable)
    .where(eq(competitionHeatsTable.competitionId, competitionId))

  return {
    heatCount: heats.length,
    scheduledHeatCount: heats.filter((heat) => Boolean(heat.scheduledTime))
      .length,
  }
}

function buildSupportingFacts(input: {
  rosterTotal: number
  totalShifts: number
  assignedSlots: number
  sentAssignments: number
  confirmedAssignments: number
  setup: {
    completed: number
    total: number
  }
}): CrewOrganizerHomeFact[] {
  if (input.assignedSlots > 0) {
    return [
      { label: "Assigned", value: input.assignedSlots.toString() },
      { label: "Sent", value: input.sentAssignments.toString() },
      { label: "Confirmed", value: input.confirmedAssignments.toString() },
    ]
  }

  if (input.setup.completed < input.setup.total) {
    return [
      {
        label: "Setup",
        value: `${input.setup.completed}/${input.setup.total}`,
      },
      { label: "Volunteers imported", value: input.rosterTotal.toString() },
      { label: "Shifts created", value: input.totalShifts.toString() },
    ]
  }

  return [
    { label: "Volunteers imported", value: input.rosterTotal.toString() },
    { label: "Shifts created", value: input.totalShifts.toString() },
    { label: "Assignments sent", value: input.sentAssignments.toString() },
  ]
}

function buildSecondaryActions(
  primaryKey: CrewOrganizerNextAction["key"],
): CrewOrganizerHomeActionView[] {
  if (primaryKey !== "finish_setup") return []

  return (["import_volunteers", "import_heat_schedule"] as const).map((key) =>
    toActionView({ key, ctaTo: actionCtaByKey[key] }),
  )
}

function countSentAssignments(input: {
  assignedSlots: number
  missing: number
  pending: number
}) {
  return Math.max(input.assignedSlots - input.missing - input.pending, 0)
}

const actionCtaByKey: Record<
  CrewOrganizerNextAction["key"],
  CrewOrganizerNextAction["ctaTo"]
> = {
  finish_setup: "/setup",
  import_volunteers: "/imports?tab=volunteers",
  import_heat_schedule: "/imports?tab=heat_schedule",
  build_staffing_plan: "/staffing",
  create_assignments: "/assignments",
  send_confirmations: "/messages",
  run_day_of: "/day-of",
  print_packet: "/exports",
}

const actionCopy: Record<
  CrewOrganizerNextAction["key"],
  Omit<CrewOrganizerHomeActionView, "key" | "ctaTo">
> = {
  finish_setup: {
    title: "Finish event setup",
    description:
      "Confirm the event basics, floor layout, and staffing assumptions.",
    ctaLabel: "Finish setup",
  },
  import_volunteers: {
    title: "Import volunteers",
    description: "Bring in the volunteer list so Crew can build assignments.",
    ctaLabel: "Import volunteers",
  },
  import_heat_schedule: {
    title: "Import heat schedule",
    description: "Add the heat schedule so staffing can follow the event flow.",
    ctaLabel: "Import heat schedule",
  },
  build_staffing_plan: {
    title: "Create your first staffing plan",
    description: "Set up shifts and coverage before assigning volunteers.",
    ctaLabel: "Open staffing plan",
  },
  create_assignments: {
    title: "Assign volunteers",
    description:
      "Fill the staffing plan with the volunteers who are ready to help.",
    ctaLabel: "Open assignments",
  },
  send_confirmations: {
    title: "Send confirmations",
    description:
      "Email assignments so volunteers can confirm, decline, or request changes.",
    ctaLabel: "Open confirmations",
  },
  run_day_of: {
    title: "Run event day",
    description:
      "Track responses and keep staffing coverage moving during the event.",
    ctaLabel: "Open event day",
  },
  print_packet: {
    title: "Print packet",
    description: "Prepare the event-day staffing packet for leads and judges.",
    ctaLabel: "Open exports",
  },
}

function toActionView(
  action: Pick<CrewOrganizerHomeActionView, "key" | "ctaTo">,
): CrewOrganizerHomeActionView {
  return {
    key: action.key,
    ctaTo: action.ctaTo,
    ...actionCopy[action.key],
  }
}

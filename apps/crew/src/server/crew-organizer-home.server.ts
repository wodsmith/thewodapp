// @lat: [[crew#Organizer Home Next Action]]
import {
  type CrewOrganizerNextAction,
  deriveCrewOrganizerNextAction,
} from "../lib/crew/organizer-next-action"
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
}

export async function getCrewOrganizerHome(data: {
  eventId: string
}): Promise<{ view: CrewOrganizerHomeView }> {
  const { event } = await getCrewEvent({ eventId: data.eventId })

  if (!event) {
    throw new Error("Crew event not found")
  }

  const rosterShiftSummary = await getCrewEventRosterShiftSummary(data)
  const basics = [
    event.competition.name,
    event.competition.startDate,
    event.competition.endDate,
    event.competition.timezone,
  ]
  const setup = {
    completed: basics.filter(Boolean).length,
    total: basics.length,
  }
  const nextAction = deriveCrewOrganizerNextAction({
    setup,
    roster: {
      total: rosterShiftSummary.rosterSummary.total,
      assignable: rosterShiftSummary.rosterSummary.assignable,
    },
    shifts: rosterShiftSummary.shiftSummary,
  })

  const actionView = toActionView(nextAction)

  return {
    view: {
      nextAction: actionView,
      supportingFacts: buildSupportingFacts({
        rosterTotal: rosterShiftSummary.rosterSummary.total,
        totalShifts: rosterShiftSummary.shiftSummary.totalShifts,
        assignedSlots: rosterShiftSummary.shiftSummary.assignedSlots,
        setup,
      }),
      secondaryActions: buildSecondaryActions(nextAction.key),
    },
  }
}

function buildSupportingFacts(input: {
  rosterTotal: number
  totalShifts: number
  assignedSlots: number
  setup: { completed: number; total: number }
}): CrewOrganizerHomeFact[] {
  return [
    { label: "Volunteers", value: input.rosterTotal.toString() },
    { label: "Shifts", value: input.totalShifts.toString() },
    { label: "Assignments", value: input.assignedSlots.toString() },
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

const actionCtaByKey: Record<
  CrewOrganizerNextAction["key"],
  CrewOrganizerNextAction["ctaTo"]
> = {
  finish_setup: "/setup",
  import_volunteers: "/volunteers",
  import_heat_schedule: "/heats",
  build_staffing_plan: "/staffing",
  create_assignments: "/shifts",
  print_packet: "/exports",
}

const actionCopy: Record<
  CrewOrganizerNextAction["key"],
  Omit<CrewOrganizerHomeActionView, "key" | "ctaTo">
> = {
  finish_setup: {
    title: "Finish event setup",
    description: "Set the event name, dates, and timezone.",
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
  print_packet: {
    title: "Export your schedule",
    description: "Prepare the event-day staffing packet for leads and judges.",
    ctaLabel: "Export schedule",
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

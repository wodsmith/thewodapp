// @lat: [[crew#Guided Setup State]]
import {
  buildCrewGuidedSetupState,
  parseCrewGuidedSetupSettings,
  serializeCrewGuidedSetupSettings,
  updateCrewGuidedSetupStepState,
  type CrewGuidedSetupOperatorStatus,
  type CrewGuidedSetupState,
  type CrewGuidedSetupStepKey,
} from "../lib/crew/guided-setup"
import { parseCrewSettings } from "../lib/crew-event-setup"
import {
  getCrewEvent,
  updateCrewEventSettings,
} from "./crew-event-settings.server"
import { getCrewReadinessPage } from "./crew-readiness.server"

export interface CrewGuidedSetupPageData {
  guidedSetup: CrewGuidedSetupState
}

interface GetCrewGuidedSetupPageInput {
  eventId: string
}

interface UpdateCrewGuidedSetupStepInput {
  eventId: string
  stepKey: CrewGuidedSetupStepKey
  status: CrewGuidedSetupOperatorStatus | null
  note?: string
}

export async function getCrewGuidedSetupPage(
  data: GetCrewGuidedSetupPageInput,
): Promise<CrewGuidedSetupPageData> {
  const [{ event }, readinessPage] = await Promise.all([
    getCrewEvent({ eventId: data.eventId }),
    getCrewReadinessPage({ eventId: data.eventId }),
  ])

  if (!event) {
    throw new Error("Crew event not found")
  }

  const parsedSettings = parseCrewSettings(event.settings.settings)
  const persisted = parseCrewGuidedSetupSettings(event.settings.settings)

  return {
    guidedSetup: buildCrewGuidedSetupState({
      event: {
        startDate: event.competition.startDate,
        endDate: event.competition.endDate,
        timezone: event.competition.timezone,
      },
      setup: parsedSettings.setup,
      facts: readinessPage.facts,
      readiness: readinessPage.readiness,
      persisted,
    }),
  }
}

export async function updateCrewGuidedSetupStep(
  data: UpdateCrewGuidedSetupStepInput,
): Promise<CrewGuidedSetupPageData> {
  const { event } = await getCrewEvent({ eventId: data.eventId })

  if (!event) {
    throw new Error("Crew event not found")
  }

  const current = parseCrewGuidedSetupSettings(event.settings.settings)
  const next = updateCrewGuidedSetupStepState(current, {
    stepKey: data.stepKey,
    status: data.status,
    note: data.note,
    updatedAt: new Date().toISOString(),
  })

  await updateCrewEventSettings({
    competitionId: data.eventId,
    settings: serializeCrewGuidedSetupSettings(event.settings.settings, next),
  })

  return getCrewGuidedSetupPage(data)
}

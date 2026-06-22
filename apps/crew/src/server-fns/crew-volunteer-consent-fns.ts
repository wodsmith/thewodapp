import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { CREW_VOLUNTEER_CONSENT_SCOPE } from "../db/schemas/crew-volunteer-intelligence"
import {
  CREW_VOLUNTEER_CONSENT_CENTER_SCOPES,
  type CrewVolunteerConsentCenterAction,
} from "../lib/crew/volunteer-consent-center"

export type {
  CrewVolunteerConsentCenterTokenData,
  CrewVolunteerConsentCenterTokenInput,
  UpdateCrewVolunteerConsentCenterTokenInput,
  UpdateCrewVolunteerConsentCenterTokenResult,
} from "../server/crew-volunteer-consent.server"

const publicTokenInputSchema = z.object({
  slug: z.string().trim().min(1, "Event slug is required").max(255),
  token: z.string().trim().min(1, "Token is required").max(255),
})

const updateConsentInputSchema = publicTokenInputSchema.extend({
  scope: z.enum(CREW_VOLUNTEER_CONSENT_CENTER_SCOPES),
  action: z.enum(["grant", "revoke"] satisfies [
    CrewVolunteerConsentCenterAction,
    CrewVolunteerConsentCenterAction,
  ]),
})

export const getCrewVolunteerConsentCenterTokenFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) => publicTokenInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { getCrewVolunteerConsentCenterToken } = await import(
      "../server/crew-volunteer-consent.server"
    )
    return getCrewVolunteerConsentCenterToken(data)
  })

export const updateCrewVolunteerConsentCenterTokenFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) => updateConsentInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { updateCrewVolunteerConsentCenterToken } = await import(
      "../server/crew-volunteer-consent.server"
    )
    return updateCrewVolunteerConsentCenterToken(data)
  })

export const CREW_VOLUNTEER_CONSENT_CENTER_SCOPE_OPTIONS = {
  COMMUNICATION_HISTORY: CREW_VOLUNTEER_CONSENT_SCOPE.COMMUNICATION_HISTORY,
  REGIONAL_DISCOVERY: CREW_VOLUNTEER_CONSENT_SCOPE.REGIONAL_DISCOVERY,
} as const

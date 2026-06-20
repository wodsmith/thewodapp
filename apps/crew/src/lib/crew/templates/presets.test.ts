// @lat: [[crew#Role And Shift Templates]]
import { describe, expect, it } from "vitest"
import { VOLUNTEER_ROLE_TYPES } from "../../../db/schemas/volunteers"
import {
  buildTemplateFromPreset,
  parseCrewTemplatePresetPayload,
  serializeCrewTemplatePresetPayload,
} from "./presets"
import type { CrewRoleShiftTemplate } from "./types"

describe("Crew role and shift template presets", () => {
  it("serializes and parses a bounded role/shift preset payload", () => {
    const payload = serializeCrewTemplatePresetPayload(template)
    const parsed = parseCrewTemplatePresetPayload({
      ...payload,
      roles: [
        ...payload.roles,
        { roleType: "not_real", targetCount: 20 },
        { roleType: VOLUNTEER_ROLE_TYPES.JUDGE, targetCount: 99 },
      ],
      shifts: [
        ...payload.shifts,
        { key: "bad", name: "Bad", roleType: "judge", startTime: "25:00" },
      ],
    })

    expect(parsed).toMatchObject({
      schemaVersion: 1,
      sourceTemplateId: "built-in",
      staffingAssumptions: "Use one judge per lane.",
    })
    expect(parsed?.roles).toHaveLength(1)
    expect(parsed?.shifts).toHaveLength(1)
  })

  it("builds a selectable team preset template from persisted data", () => {
    const payload = serializeCrewTemplatePresetPayload(template)
    const presetTemplate = buildTemplateFromPreset({
      presetId: "ctpres_123",
      name: "Gym default",
      description: null,
      payload,
    })

    expect(presetTemplate).toMatchObject({
      id: "preset:ctpres_123",
      presetId: "ctpres_123",
      source: "team_preset",
      name: "Gym default",
    })
  })
})

const template: CrewRoleShiftTemplate = {
  id: "built-in",
  name: "Built in",
  description: "Built in",
  source: "built_in",
  roles: [
    {
      roleType: VOLUNTEER_ROLE_TYPES.JUDGE,
      targetCount: 8,
      notes: "Lane-sized judge crew.",
    },
  ],
  shifts: [
    {
      key: "judges",
      name: "Judges",
      roleType: VOLUNTEER_ROLE_TYPES.JUDGE,
      dayOffset: 0,
      startTime: "08:00",
      endTime: "12:00",
      capacity: 8,
      location: "Floor",
      notes: "Tune to lanes.",
    },
  ],
  staffingAssumptions: "Use one judge per lane.",
}

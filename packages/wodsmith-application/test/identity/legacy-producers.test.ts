import { describe, expect, it } from "vitest"
import { resolveLegacyCompetitionTopology } from "../../src/identity"
import {
  createdCompetition,
  demoSquad,
  openRegistration,
  runtimeSquad,
  seededEvents,
  transferredSquad,
} from "./producer-fixtures"

describe("persisted legacy producer shapes", () => {
  // @lat: [[identity#Legacy producer compatibility#Loads competitions before division selection]]
  it("loads newly created competitions without selecting unrelated divisions", () => {
    const result = resolveLegacyCompetitionTopology(createdCompetition)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.divisions.size).toBe(0)
    expect(result.value.registrations.size).toBe(0)
    expect(result.value.events.size).toBe(0)
    expect(result.value.competition.id).toBe("comp_fixture")
    expect([...result.value.access.participantIds]).toEqual([])
  })

  // @lat: [[identity#Legacy producer compatibility#Preserves open registration scope]]
  it.each([null, "sgrp_fixture"])(
    "preserves null division scope with selection %s",
    (selectedScalingGroupId) => {
      const result = resolveLegacyCompetitionTopology({
        ...openRegistration,
        selectedScalingGroupId,
      })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect([...result.value.registrations.values()]).toEqual([
        {
          id: "creg_open",
          competitionId: "comp_fixture",
          division: { kind: "open" },
          participation: { kind: "individual", athleteId: "usr_captain" },
          state: { kind: "active" },
        },
      ])
      expect([...result.value.access.participantIds]).toEqual(["usr_captain"])
      expect(result.value.divisions.size).toBe(0)
    },
  )

  it("still rejects named registrations without a selected division set", () => {
    expect(
      resolveLegacyCompetitionTopology({
        ...openRegistration,
        registrations: openRegistration.registrations.map((row) => ({
          ...row,
          divisionId: "slvl_unselected",
        })),
      }),
    ).toMatchObject({
      ok: false,
      error: { code: "DIVISION_OUTSIDE_COMPETITION" },
    })
  })

  it("keeps open and named entries for one athlete distinct", () => {
    const result = resolveLegacyCompetitionTopology({
      ...openRegistration,
      selectedScalingGroupId: "sgrp_fixture",
      scalingLevels: [
        {
          id: "slvl_rx",
          scalingGroupId: "sgrp_fixture",
          label: "RX",
          position: 0,
          teamSize: 1,
        },
      ],
      registrations: [
        ...openRegistration.registrations,
        {
          ...openRegistration.registrations[0]!,
          id: "creg_named",
          divisionId: "slvl_rx",
        },
      ],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(
      [...result.value.registrations.values()].map((row) => row.division),
    ).toEqual([{ kind: "open" }, { kind: "named", divisionId: "slvl_rx" }])
    expect([...result.value.access.participantIds]).toEqual(["usr_captain"])
  })

  it("preserves a squad's open scope without inventing a division", () => {
    const result = resolveLegacyCompetitionTopology({
      ...runtimeSquad,
      registrations: runtimeSquad.registrations.map((row) => ({
        ...row,
        divisionId: null,
      })),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect([...result.value.squads.values()][0]!.division).toEqual({
      kind: "open",
    })
    expect([...result.value.registrations.values()][0]!.division).toEqual({
      kind: "open",
    })
  })

  // @lat: [[identity#Legacy producer compatibility#Loads active runtime squads]]
  it("loads the registration producer's active squad and derives roster access", () => {
    const result = resolveLegacyCompetitionTopology(runtimeSquad)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect([...result.value.squads.values()]).toEqual([
      {
        id: "team_squad",
        competitionId: "comp_fixture",
        name: "Pair",
        division: { kind: "named", divisionId: "slvl_pairs" },
        captainId: "usr_captain",
        members: [
          { userId: "usr_captain", role: "captain" },
          { userId: "usr_member", role: "member" },
        ],
      },
    ])
    expect([...result.value.registrations.values()]).toMatchObject([
      {
        id: "creg_captain",
        participation: { kind: "squad", squadId: "team_squad" },
      },
    ])
    expect([...result.value.access.participantIds]).toEqual([
      "usr_captain",
      "usr_member",
    ])
  })

  // @lat: [[identity#Legacy producer compatibility#Reconciles transferred squad divisions]]
  it("takes the transferred division from the registration while retaining stored metadata", () => {
    const metadataBefore = transferredSquad.teams[2]!.competitionMetadata
    const result = resolveLegacyCompetitionTopology(transferredSquad)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const division = { kind: "named", divisionId: "slvl_scaled_pairs" }
    expect([...result.value.registrations.values()][0]!.division).toEqual(
      division,
    )
    expect([...result.value.squads.values()][0]!.division).toEqual(division)
    expect(transferredSquad.teams[2]!.competitionMetadata).toBe(metadataBefore)
  })

  // @lat: [[identity#Legacy producer compatibility#Normalizes demo squad registrations]]
  it.each([false, true])(
    "resolves all demo member registrations to one squad independent of row order: %s",
    (reverse) => {
      const result = resolveLegacyCompetitionTopology({
        ...demoSquad,
        registrations: reverse
          ? [...demoSquad.registrations].reverse()
          : demoSquad.registrations,
      })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.squads.size).toBe(1)
      expect([...result.value.squads.values()][0]).toMatchObject({
        captainId: "usr_captain",
        division: { kind: "named", divisionId: "slvl_pairs" },
        members: [
          { userId: "usr_captain", role: "captain" },
          { userId: "usr_member", role: "member" },
        ],
      })
      expect(
        [...result.value.registrations.values()].map((row) => row.id).sort(),
      ).toEqual(["creg_captain", "creg_member"])
      expect(
        [...result.value.registrations.values()].every(
          (row) =>
            row.participation.kind === "squad" &&
            row.participation.squadId === "team_squad",
        ),
      ).toBe(true)
      expect([...result.value.access.participantIds]).toEqual([
        "usr_captain",
        "usr_member",
      ])
    },
  )

  // @lat: [[identity#Legacy producer compatibility#Rejects conflicting squad authority]]
  it.each([
    {
      field: "divisionId",
      value: "slvl_scaled_pairs",
      code: "CROSS_DIVISION_SQUAD",
    },
    {
      field: "captainUserId",
      value: "usr_member",
      code: "CONFLICTING_SQUAD_CAPTAIN",
    },
  ])(
    "rejects disagreement between squad registration $field values",
    ({ field, value, code }) => {
      expect(
        resolveLegacyCompetitionTopology({
          ...demoSquad,
          registrations: demoSquad.registrations.map((row, i) =>
            i === 0 ? { ...row, [field]: value } : row,
          ),
        }),
      ).toMatchObject({ ok: false, error: { code } })
    },
  )

  it("does not invent an active captain missing from the roster", () => {
    expect(
      resolveLegacyCompetitionTopology({
        ...demoSquad,
        memberships: demoSquad.memberships!.filter(
          (row) => row.userId !== "usr_captain",
        ),
      }),
    ).toMatchObject({ ok: false, error: { code: "MISSING_SQUAD_CAPTAIN" } })
  })

  it.each([
    { metadata: "{invalid", code: "INVALID_SQUAD" },
    {
      metadata: '{"competitionId":"comp_foreign","divisionId":"slvl_pairs"}',
      code: "CROSS_COMPETITION_SQUAD",
    },
  ])("rejects invalid supplied squad metadata: $code", ({ metadata, code }) => {
    expect(
      resolveLegacyCompetitionTopology({
        ...runtimeSquad,
        teams: runtimeSquad.teams.map((row) =>
          row.id === "team_squad"
            ? { ...row, competitionMetadata: metadata }
            : row,
        ),
      }),
    ).toMatchObject({ ok: false, error: { code } })
  })

  // @lat: [[identity#Legacy producer compatibility#Accepts persisted seed identifier aliases]]
  it("retains seeded event identities across windows and parent links", () => {
    const result = resolveLegacyCompetitionTopology(seededEvents)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect([...result.value.events.values()]).toMatchObject([
      {
        id: "tw_online_event1",
        submissionWindow: {
          opensAt: "2026-09-01 00:00:00",
          closesAt: "2026-09-08 00:00:00",
        },
      },
      { id: "tw_online_event4_parent", parentEventId: null },
      {
        id: "tw_online_event4_sprint",
        parentEventId: "tw_online_event4_parent",
      },
    ])
  })

  it.each(["cevt_wrong", "tw_"])("rejects an invalid event alias %s", (id) => {
    expect(
      resolveLegacyCompetitionTopology({
        ...seededEvents,
        events: [{ ...seededEvents.events[0]!, id }],
        eventConfigurations: [],
      }),
    ).toMatchObject({ ok: false, error: { code: "INVALID_IDENTIFIER" } })
  })

  it("does not collapse generated and seeded event IDs with the same suffix", () => {
    const result = resolveLegacyCompetitionTopology({
      ...seededEvents,
      events: [
        ...seededEvents.events,
        { ...seededEvents.events[0]!, id: "trwk_online_event1" },
      ],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.events.size).toBe(4)
    expect(
      [...result.value.events.values()].find(
        (event) => event.id === "trwk_online_event1",
      )!.submissionWindow,
    ).toBeNull()
  })
})

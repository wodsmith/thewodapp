import { describe, expect, it } from "vitest"
import type { EventProposal, VolunteerProposal } from "@/lib/organizer-file-import/schemas"
import {
  classifyVolunteer,
  type ExistingEvent,
  type ExistingVolunteer,
  isBlockedVolunteer,
  planEventApply,
  planVolunteerApply,
  reconcileVolunteerProposal,
  validateEventProposal,
} from "@/lib/organizer-file-import/validate"

const existing: ExistingVolunteer[] = [
  { membershipId: "tmem_1", email: "judge@x.com", name: "Judge One", isInvite: false },
  { membershipId: "tinv_1", email: "pending@x.com", name: "Pending Pat", isInvite: true },
]

function makeVolunteer(
  overrides: Partial<VolunteerProposal> = {},
): VolunteerProposal {
  return {
    proposalId: "p1",
    rowKey: "row-1",
    action: "create",
    name: "New Person",
    email: "new@x.com",
    phone: null,
    roleTypes: ["judge"],
    credentials: null,
    shirtSize: null,
    availability: null,
    matchKind: "new",
    matchedMembershipId: null,
    confidence: "high",
    rationale: "From the roster.",
    warnings: [],
    status: "pending",
    ...overrides,
  }
}

describe("classifyVolunteer", () => {
  it("flags a missing email as a blocking warning", () => {
    const result = classifyVolunteer({ email: null, name: "X" }, existing)
    expect(result.matchKind).toBe("new")
    expect(result.warnings.join(" ")).toMatch(/No email/)
  })

  it("matches an existing member by email (case-insensitive)", () => {
    const result = classifyVolunteer(
      { email: "JUDGE@x.com", name: "Judge One" },
      existing,
    )
    expect(result.matchKind).toBe("existing_member")
    expect(result.matchedMembershipId).toBe("tmem_1")
  })

  it("distinguishes a pending invite from a member", () => {
    const result = classifyVolunteer(
      { email: "pending@x.com", name: null },
      existing,
    )
    expect(result.matchKind).toBe("existing_invite")
    expect(result.matchedMembershipId).toBe("tinv_1")
  })

  it("warns on a name collision without an email match", () => {
    const result = classifyVolunteer(
      { email: "other@x.com", name: "Judge One" },
      existing,
    )
    expect(result.matchKind).toBe("new")
    expect(result.warnings.join(" ")).toMatch(/already exists/)
  })
})

describe("reconcileVolunteerProposal", () => {
  it("downgrades a duplicate create to an update", () => {
    const reconciled = reconcileVolunteerProposal(
      makeVolunteer({ email: "judge@x.com" }),
      existing,
    )
    expect(reconciled.matchKind).toBe("existing_member")
    expect(reconciled.action).toBe("update")
  })

  it("marks a no-email create as needs_input", () => {
    const reconciled = reconcileVolunteerProposal(
      makeVolunteer({ email: null }),
      existing,
    )
    expect(reconciled.action).toBe("needs_input")
  })

  it("keeps a genuinely new volunteer as a create", () => {
    const reconciled = reconcileVolunteerProposal(makeVolunteer(), existing)
    expect(reconciled.matchKind).toBe("new")
    expect(reconciled.action).toBe("create")
  })
})

describe("isBlockedVolunteer", () => {
  it("blocks a create without an email", () => {
    expect(isBlockedVolunteer(makeVolunteer({ email: null }))).toBe(true)
  })
  it("does not block a create with an email", () => {
    expect(isBlockedVolunteer(makeVolunteer())).toBe(false)
  })
})

describe("planVolunteerApply", () => {
  const opts = {
    alreadyAppliedRowKeys: new Set<string>(),
    hasCompetitionTeam: true,
    defaultRoleTypes: ["general"] as VolunteerProposal["roleTypes"],
  }

  it("plans an invite for a new create with an email", () => {
    const [decision] = planVolunteerApply([makeVolunteer()], opts)
    expect(decision.outcome).toBe("invite")
    if (decision.outcome === "invite") {
      expect(decision.email).toBe("new@x.com")
      expect(decision.roleTypes).toEqual(["judge"])
    }
  })

  it("uses defaultRoleTypes when the proposal carries none", () => {
    const [decision] = planVolunteerApply(
      [makeVolunteer({ roleTypes: [] })],
      opts,
    )
    expect(decision.outcome).toBe("invite")
    if (decision.outcome === "invite") {
      expect(decision.roleTypes).toEqual(["general"])
    }
  })

  it("skips a row already written by a prior apply (idempotent)", () => {
    const [decision] = planVolunteerApply([makeVolunteer({ rowKey: "row-x" })], {
      ...opts,
      alreadyAppliedRowKeys: new Set(["row-x"]),
    })
    expect(decision).toMatchObject({ outcome: "skip", reason: "Already imported" })
  })

  it("skips a non-create (existing volunteer) proposal", () => {
    const [decision] = planVolunteerApply(
      [makeVolunteer({ action: "update", matchKind: "existing_member" })],
      opts,
    )
    expect(decision.outcome).toBe("skip")
    if (decision.outcome === "skip") {
      expect(decision.reason).toMatch(/Already a volunteer/)
    }
  })

  it("fails a create with no email", () => {
    const [decision] = planVolunteerApply([makeVolunteer({ email: null })], opts)
    expect(decision).toMatchObject({ outcome: "fail" })
  })

  it("fails when the competition has no volunteer team", () => {
    const [decision] = planVolunteerApply([makeVolunteer()], {
      ...opts,
      hasCompetitionTeam: false,
    })
    expect(decision).toMatchObject({
      outcome: "fail",
      reason: "Competition has no volunteer team",
    })
  })
})

describe("planEventApply", () => {
  const existingEvents: ExistingEvent[] = [
    { trackWorkoutId: "trwk_1", name: "Event 1" },
  ]
  const schemes = ["time", "reps", "load"]
  const baseOpts = {
    alreadyAppliedRowKeys: new Set<string>(),
    existingEvents,
    allowedSchemes: schemes,
  }

  function makeEventProposal(
    overrides: Partial<EventProposal> = {},
  ): EventProposal {
    return {
      proposalId: "e1",
      rowKey: "erow-1",
      action: "create",
      targetTrackWorkoutId: null,
      name: "Fran",
      description: "21-15-9 thrusters and pull-ups",
      scheme: "time",
      scoreType: null,
      timeCap: null,
      changedFields: {},
      confidence: "high",
      rationale: "From the packet.",
      warnings: [],
      status: "pending",
      ...overrides,
    }
  }

  it("plans a create for a valid new event", () => {
    const [decision] = planEventApply([makeEventProposal()], baseOpts)
    expect(decision.outcome).toBe("create")
    if (decision.outcome === "create") {
      expect(decision.name).toBe("Fran")
      expect(decision.scheme).toBe("time")
    }
  })

  it("skips a row already applied", () => {
    const [decision] = planEventApply([makeEventProposal({ rowKey: "e-x" })], {
      ...baseOpts,
      alreadyAppliedRowKeys: new Set(["e-x"]),
    })
    expect(decision).toMatchObject({ outcome: "skip", reason: "Already imported" })
  })

  it("skips an update proposal (deferred)", () => {
    const [decision] = planEventApply(
      [makeEventProposal({ action: "update", targetTrackWorkoutId: "trwk_1" })],
      baseOpts,
    )
    expect(decision.outcome).toBe("skip")
    if (decision.outcome === "skip") {
      expect(decision.reason).toMatch(/updates aren't enabled/)
    }
  })

  it("fails a create with an unknown scheme", () => {
    const [decision] = planEventApply(
      [makeEventProposal({ scheme: "bogus" })],
      baseOpts,
    )
    expect(decision.outcome).toBe("fail")
  })

  it("fails a create with no scheme", () => {
    const [decision] = planEventApply(
      [makeEventProposal({ scheme: null })],
      baseOpts,
    )
    expect(decision).toMatchObject({ outcome: "fail" })
  })
})

describe("validateEventProposal", () => {
  const events: ExistingEvent[] = [{ trackWorkoutId: "trwk_1", name: "Event 1" }]
  const schemes = ["time", "reps", "load"]

  function makeEvent(overrides: Partial<EventProposal> = {}): EventProposal {
    return {
      proposalId: "e1",
      rowKey: "erow-1",
      action: "create",
      targetTrackWorkoutId: null,
      name: "New Event",
      description: null,
      scheme: "time",
      scoreType: null,
      timeCap: null,
      changedFields: {},
      confidence: "high",
      rationale: "From the packet.",
      warnings: [],
      status: "pending",
      ...overrides,
    }
  }

  it("rejects an unknown scheme on create", () => {
    const result = validateEventProposal(
      makeEvent({ scheme: "bogus" }),
      events,
      schemes,
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(" ")).toMatch(/scheme/)
  })

  it("rejects an update with no target", () => {
    const result = validateEventProposal(
      makeEvent({ action: "update", targetTrackWorkoutId: null }),
      events,
      schemes,
    )
    expect(result.ok).toBe(false)
  })

  it("rejects an update targeting an unknown event", () => {
    const result = validateEventProposal(
      makeEvent({ action: "update", targetTrackWorkoutId: "trwk_missing" }),
      events,
      schemes,
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(" ")).toMatch(/does not belong/)
  })

  it("accepts a valid create", () => {
    expect(validateEventProposal(makeEvent(), events, schemes).ok).toBe(true)
  })
})

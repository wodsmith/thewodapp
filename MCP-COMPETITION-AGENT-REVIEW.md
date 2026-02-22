# MCP Competition Agent Design Review

**Reviewer Philosophy:** Expert MCP Server Architect applying Jeremiah Lowin's (FastMCP) principles

**Date:** 2026-01-14

**Scope:** AI-powered competition management agents in `apps/wodsmith-start/src/ai/`

---

## Executive Summary

The competition agent architecture demonstrates **good structural patterns** (router → sub-agents) but suffers from **operation-centric design** rather than **outcome-centric design**. The agent requires extensive orchestration across 25+ low-level CRUD tools to accomplish high-level goals.

**Overall Grade:** C+ (Functional but not optimized for LLM usage)

**Key Issues:**
1. ❌ Too many atomic operations requiring agent orchestration
2. ⚠️ Generic error messages that don't guide retry behavior
3. ✅ Good documentation and domain knowledge
4. ⚠️ Some complex nested arguments (settings, Lexical JSON)
5. ⚠️ Moderate token budget usage (~42 tools across 4 agents)

---

## Analysis by Golden Rule

### Rule 1: Outcomes, Not Operations ❌ FAILING

**Current Anti-Patterns:**

The agent exposes **25+ atomic CRUD operations** that require the LLM to orchestrate:

```typescript
// Current: Agent must orchestrate 8+ tool calls
createCompetition({name, startDate})
  → createDivision({competitionId, ...}) // x4 divisions
  → createEvent({competitionId, ...})    // x3 events
  → createWaiver({competitionId, ...})   // x2 waivers
  → validateCompetition({competitionId})
```

**Agent Limitation:** LLMs are **expensive orchestrators**. Each tool call = tokens + latency + failure points.

**Tool Explosion:**
- Setup Agent: 18 tools (CRUD for divisions, events, waivers, + helpers)
- Operations Agent: 11 tools (heat scheduling, assignments, results)
- Registration Agent: 6 tools (registration queries and updates)
- Finance Agent: ~5 tools (assumed, not reviewed)

**Good Patterns Found:**

These tools DO achieve outcomes:

```typescript
✅ validateCompetition()
   → Returns structured issues + suggestions (not just "invalid")

✅ analyzeEventBalance()
   → Returns gaps + recommendations (not just event list)

✅ suggestDivisions({competitionType, expectedAthletes})
   → Returns division structure suggestions

✅ getUnassignedAthletes({competitionId, eventId})
   → Returns actionable list of who needs scheduling
```

**Recommended Refactor:**

Replace low-level CRUD with high-level outcomes:

```typescript
// BEFORE (requires 10+ tool calls)
createCompetition() → createDivision() × 4 → createEvent() × 3 → validate()

// AFTER (single tool call)
export const setupNewCompetition = createTool({
  id: "setup-new-competition",
  description: `
    Create a complete competition with divisions, events, and waivers in one step.

    Returns competition ready for registration with:
    - Competition record created
    - Divisions auto-configured based on type
    - Event placeholders created (you'll add workouts later)
    - Standard liability waiver added

    Example:
      setupNewCompetition({
        name: "Spring Throwdown 2026",
        startDate: "2026-05-15",
        competitionType: "individual",
        expectedAthletes: 100,
        includeScaled: true,
        eventCount: 4
      })
      // Returns: {competitionId, divisions: 4, events: 4, ready: true}
  `,
  inputSchema: z.object({
    name: z.string().min(1).max(255),
    startDate: z.string().describe("ISO 8601 format (YYYY-MM-DD)"),
    endDate: z.string().optional(),
    competitionType: z.enum(["individual", "team", "pairs"]),
    expectedAthletes: z.number().int().positive(),
    includeScaled: z.boolean().default(true),
    includeMasters: z.boolean().default(false),
    includeTeens: z.boolean().default(false),
    eventCount: z.enum([3, 4, 5]).default(4),
    description: z.string().optional(),
  }),
  execute: async (inputData, context) => {
    // Do ALL the orchestration in code, not in the agent
    const competitionId = await createCompetitionRecord(inputData)
    const divisions = await createDivisionsFromTemplate(competitionId, inputData)
    const events = await createEventPlaceholders(competitionId, inputData.eventCount)
    const waivers = await createStandardWaivers(competitionId)

    return {
      success: true,
      competitionId,
      divisions: divisions.map(d => d.name),
      events: events.map(e => e.name),
      waivers: waivers.map(w => w.type),
      ready: true,
      message: "Competition created! Next: add workout details to events."
    }
  }
})
```

**Impact:**
- **Before:** 10+ tool calls, 30-40 seconds, multiple failure points
- **After:** 1 tool call, 3-5 seconds, single transaction

---

### Rule 2: Flatten Arguments ⚠️ MIXED

**Good Examples:**

Most tools use primitives correctly:

```typescript
✅ createCompetition({
    name: string,              // ✅ primitive
    slug: string,              // ✅ primitive
    startDate: string,         // ✅ ISO 8601 string
    description?: string       // ✅ optional primitive
})

✅ assignAthleteToHeat({
    heatId: string,           // ✅ ID reference
    registrationId: string,   // ✅ ID reference
    laneNumber: number        // ✅ primitive
})
```

**Anti-Patterns Found:**

```typescript
❌ Competition.settings field is complex nested object
   // Agent must construct: {divisions: {scalingGroupId: "..."}}
   // This should be flat: scalingGroupId: string

❌ Waiver content stored as Lexical JSON (nested rich text format)
   // Agent must construct complex editor state
   // Should be: waiverText: string (markdown)

⚠️ Event result encoding requires agent calculation:
   // Time: 5:30 → 330000 milliseconds
   // Rounds+Reps: 4 rounds + 15 reps → 400015
   // Agent must do math: rounds * 100000 + reps
```

**Recommended Refactor:**

```typescript
// BEFORE (agent must construct nested object)
export const createWaiver = createTool({
  inputSchema: z.object({
    competitionId: z.string(),
    content: z.record(z.unknown())  // ❌ Lexical JSON blob
  }),
  // ...
})

// AFTER (flat, agent-friendly)
export const createWaiver = createTool({
  id: "create-waiver",
  description: `
    Add a waiver to the competition.

    Uses standard waiver templates. Add customText for gym-specific clauses.

    Example:
      createWaiver({
        competitionId: "comp_123",
        waiverType: "liability",
        customText: "Additional clause: No refunds after registration closes.",
        isRequired: true
      })
  `,
  inputSchema: z.object({
    competitionId: z.string(),
    waiverType: z.enum(["liability", "photo", "medical", "code_of_conduct"]),
    customText: z.string().default("").describe("Optional additions to template"),
    isRequired: z.boolean().default(true)
  }),
  execute: async (inputData, context) => {
    // Server constructs Lexical JSON from template + custom text
    const templateContent = getWaiverTemplate(inputData.waiverType)
    const lexicalContent = buildLexicalJson(templateContent, inputData.customText)

    return await insertWaiver({...inputData, content: lexicalContent})
  }
})
```

**Result Entry Simplification:**

```typescript
// BEFORE (agent must encode)
enterResult({
  registrationId: "reg_123",
  eventId: "evt_1",
  score: 330000  // Agent calculated 5:30 → 330000ms
})

// AFTER (server handles encoding)
export const enterResult = createTool({
  id: "enter-result",
  description: `
    Enter a competition result. Only fill in fields relevant to the workout scheme.

    Examples:
      // Time workout (5:30)
      enterResult({
        registrationId: "reg_123",
        eventId: "evt_1",
        finishTimeMinutes: 5,
        finishTimeSeconds: 30
      })

      // AMRAP (4 rounds + 15 reps)
      enterResult({
        registrationId: "reg_123",
        eventId: "evt_2",
        roundsCompleted: 4,
        repsCompleted: 15
      })

      // Max lift (225 lbs)
      enterResult({
        registrationId: "reg_123",
        eventId: "evt_3",
        loadPounds: 225
      })
  `,
  inputSchema: z.object({
    registrationId: z.string(),
    eventId: z.string(),
    // Time-based workouts
    finishTimeMinutes: z.number().int().min(0).default(0),
    finishTimeSeconds: z.number().int().min(0).max(59).default(0),
    // AMRAP workouts
    roundsCompleted: z.number().int().min(0).default(0),
    repsCompleted: z.number().int().min(0).default(0),
    // Load workouts
    loadPounds: z.number().min(0).default(0),
    // Status
    status: z.enum(["scored", "capped", "dq", "withdrawn"]).default("scored"),
    // Tiebreak (optional)
    tiebreakMinutes: z.number().int().min(0).optional(),
    tiebreakSeconds: z.number().int().min(0).max(59).optional(),
  }),
  execute: async (inputData, context) => {
    // Get event to determine scheme
    const event = await getEvent(inputData.eventId)

    // Encode based on scheme
    let encodedScore: number
    if (event.scheme === "time" || event.scheme === "time-with-cap") {
      encodedScore = (inputData.finishTimeMinutes * 60 + inputData.finishTimeSeconds) * 1000
    } else if (event.scheme === "rounds-reps") {
      encodedScore = inputData.roundsCompleted * 100000 + inputData.repsCompleted
    } else if (event.scheme === "load") {
      encodedScore = Math.round(inputData.loadPounds * 453.592) // Convert to grams
    }

    return await insertResult({...inputData, score: encodedScore})
  }
})
```

---

### Rule 3: Instructions are Context ✅ GOOD

**Strengths:**

```typescript
✅ All tools have clear descriptions
✅ Router provides examples of when to route to each sub-agent
✅ Domain knowledge embedded in agent instructions
✅ Validation tools return structured suggestions
```

**Example of Good Documentation:**

```typescript
// competition-router.ts lines 48-76
### Setup Agent - Competition Configuration
Use for: divisions, events/workouts, waivers, competition details, validation
Examples:
- "Create divisions for my competition"
- "Add an event called Fran"
```

**Missing Elements:**

```typescript
❌ Tool schemas lack usage examples
❌ No examples of valid input/output formats in many tools
❌ Complex operations (result encoding) not documented in tool schema
```

**Recommended Addition:**

Every tool should include example in description:

```typescript
export const createDivision = createTool({
  id: "create-division",
  description: `
    Add a division to the competition.

    Divisions define athlete categories (Rx, Scaled, Masters, etc.).
    Each division can have a different registration fee.

    Example:
      createDivision({
        competitionId: "comp_abc123",
        divisionName: "Rx Men",
        feeDollars: 75,
        description: "Advanced male athletes - prescribed weights"
      })
      // Returns: {divisionId: "div_xyz", name: "Rx Men", feeCents: 7500}

    Common division names:
    - Individual: "Rx Men", "Rx Women", "Scaled Men", "Scaled Women"
    - Masters: "Masters 35+ Men", "Masters 40+ Women"
    - Teams: "Rx Teams", "Scaled Teams"
  `,
  inputSchema: z.object({
    competitionId: z.string(),
    divisionName: z.string().min(1).max(100),
    feeDollars: z.number().int().min(0).default(0)
      .describe("Registration fee in dollars (will be converted to cents)"),
    description: z.string().max(500).default("")
      .describe("Division description shown to athletes"),
  }),
  execute: async (inputData, context) => {
    // ... implementation
  }
})
```

---

### Rule 4: Errors are Prompts ❌ FAILING

**Current Anti-Patterns:**

Most errors are **descriptive** but not **actionable**:

```typescript
❌ { error: "Team context required" }
   // Agent doesn't know how to get team context

❌ { error: "Competition not found or access denied" }
   // Agent doesn't know which: not found? or no access?

❌ { error: "No team context. Cannot create competition without an organizing team." }
   // Better, but doesn't tell agent what to do next

⚠️ { error: "Invalid startDate format. Use ISO 8601 format (e.g. '2026-03-07')" }
   // Good example, but could suggest using current date
```

**Good Pattern Found:**

```typescript
✅ validateCompetition() returns:
{
    isValid: false,
    issues: [{
        severity: "error",
        category: "Divisions",
        message: "No divisions have been created",
        suggestion: "Create at least one division for athletes to register"
        //           ^^^^^^^^^ This is the retry prompt!
    }]
}
```

**Recommended Pattern:**

Every error should be a **prompt for the next action**:

```typescript
// BEFORE
if (!teamId) {
    return { error: "Team context required" }
}

// AFTER
if (!teamId) {
    return {
        error: "NO_TEAM_CONTEXT",
        message: "This operation requires a team context.",
        suggestion: "Use the listCompetitions tool to see available teams, or ask the user which team to work with.",
        nextActions: ["listCompetitions", "askUserForTeam"]
    }
}

// BEFORE
if (!competition) {
    return { error: "Competition not found or access denied" }
}

// AFTER - Separate the two cases
const competition = await db.query.competitionsTable.findFirst({
    where: eq(competitionsTable.id, competitionId)
})

if (!competition) {
    return {
        error: "COMPETITION_NOT_FOUND",
        message: `Competition '${competitionId}' does not exist.`,
        suggestion: "Use listCompetitions() to see available competitions, or check if the competition ID is correct.",
        nextActions: ["listCompetitions"],
        availableCompetitionIds: await getRecentCompetitionIds(teamId)
    }
}

if (competition.organizingTeamId !== teamId) {
    return {
        error: "ACCESS_DENIED",
        message: `Competition '${competitionId}' belongs to team '${competition.organizingTeamId}'.`,
        suggestion: "You are working with team '${teamId}'. Switch teams or request access from the competition organizer.",
        currentTeamId: teamId,
        competitionTeamId: competition.organizingTeamId,
        nextActions: ["switchTeam", "requestAccess"]
    }
}

// BEFORE
if (Number.isNaN(parsedStartDate.getTime())) {
    return {
        error: "Invalid startDate format. Use ISO 8601 format (e.g. '2026-03-07')"
    }
}

// AFTER
if (Number.isNaN(parsedStartDate.getTime())) {
    const today = new Date().toISOString().split('T')[0]
    return {
        error: "INVALID_DATE_FORMAT",
        message: `Start date '${startDate}' is not a valid ISO 8601 date.`,
        suggestion: `Use format YYYY-MM-DD. Today is ${today}. Did you mean to use today's date?`,
        example: "2026-05-15",
        todayDate: today,
        nextActions: ["retryWithCorrectFormat", "useTodayDate"]
    }
}

// Example for slug conflicts
if (slugExists) {
    return {
        error: "SLUG_CONFLICT",
        message: `Competition slug '${slug}' is already taken.`,
        suggestion: `Try adding a year or location to make it unique.`,
        conflictingSlug: slug,
        suggestions: [
            `${slug}-2026`,
            `${slug}-spring`,
            `${slug}-${new Date().getFullYear()}`
        ],
        nextActions: ["retryWithDifferentSlug", "autoGenerateSlug"]
    }
}
```

**Impact:**
- Agent retry rate improves (fewer failed workflows)
- User experience improves (agent knows what to do next)
- Debugging easier (structured error codes vs. string matching)

---

### Rule 5: Respect the Token Budget ⚠️ MODERATE

**Current Tool Count:**

- **competitionRouter:** 2 direct tools
- **setupAgent:** 18 tools
- **operationsAgent:** 11 tools
- **registrationAgent:** 6 tools
- **financeAgent:** ~5 tools (not reviewed)
- **TOTAL:** ~42 tools

**Assessment:**
- ⚠️ Approaching the 50-tool ceiling
- ⚠️ Many overlapping CRUD operations (list/get/create/update/delete for each entity)
- ⚠️ Agent must discover + iterate through many tools for simple outcomes

**Token Budget Impact:**

Every API call sends ALL tool schemas to the LLM:

```
User: "Create a new competition"

Context sent to LLM:
- Router instructions (96 lines)
- Router tools (2 tools)
- Setup agent instructions (83 lines)
- Setup agent tools (18 tools with full schemas)
= ~5000 tokens of context BEFORE user message
```

**Consolidation Opportunities:**

```typescript
// BEFORE (6 tools)
listDivisions()
getDivision()
createDivision()
updateDivision()
deleteDivision()
suggestDivisions()

// AFTER (2 tools)
export const manageDivisions = createTool({
  id: "manage-divisions",
  description: `
    Manage competition divisions (list, create, update, delete).

    Examples:
      // List all divisions
      manageDivisions({competitionId: "comp_123", action: "list"})

      // Create a division
      manageDivisions({
        competitionId: "comp_123",
        action: "create",
        divisionName: "Rx Men",
        feeDollars: 75
      })

      // Update a division
      manageDivisions({
        competitionId: "comp_123",
        action: "update",
        divisionId: "div_456",
        feeDollars: 80
      })

      // Delete a division
      manageDivisions({
        competitionId: "comp_123",
        action: "delete",
        divisionId: "div_456"
      })
  `,
  inputSchema: z.object({
    competitionId: z.string(),
    action: z.enum(["list", "create", "update", "delete"]),
    divisionId: z.string().optional().describe("Required for update/delete"),
    divisionName: z.string().optional().describe("Required for create, optional for update"),
    feeDollars: z.number().int().min(0).optional(),
    description: z.string().optional(),
  }),
  execute: async (inputData, context) => {
    const { action } = inputData

    switch (action) {
      case "list":
        return await listDivisionsImpl(inputData, context)
      case "create":
        return await createDivisionImpl(inputData, context)
      case "update":
        return await updateDivisionImpl(inputData, context)
      case "delete":
        return await deleteDivisionImpl(inputData, context)
    }
  }
})

// Keep this separate - it's a high-value outcome tool
export const suggestDivisions = createTool({
  // ... existing implementation
})
```

**Recommended Consolidation:**

1. **Keep high-value outcome tools** (analyze, validate, suggest, schedule)
2. **Merge CRUD operations** into `manage_X` tools with action parameter
3. **Create high-level workflows** (setup, duplicate, publish)

**Target:** 15-20 tools total (well under 50-tool ceiling)

---

## Recommended Refactoring Priority

### Phase 1: High-Impact Outcomes (Week 1)

Add these **outcome-oriented tools** that eliminate multi-step orchestration:

```typescript
// 1. Setup complete competition
export const setupNewCompetition = createTool({...})

// 2. Clone existing competition
export const duplicateCompetition = createTool({
  id: "duplicate-competition",
  description: `
    Clone an existing competition with optional modifications.

    Copies divisions, events, waivers, and venues. Does NOT copy registrations or results.

    Example:
      duplicateCompetition({
        sourceCompetitionId: "comp_spring_2025",
        newName: "Spring Throwdown 2026",
        newStartDate: "2026-05-15",
        copySettings: true,
        copyEvents: true,
        copyDivisions: true
      })
  `,
  inputSchema: z.object({
    sourceCompetitionId: z.string(),
    newName: z.string(),
    newStartDate: z.string(),
    newEndDate: z.string().optional(),
    copySettings: z.boolean().default(true),
    copyEvents: z.boolean().default(true),
    copyDivisions: z.boolean().default(true),
    copyWaivers: z.boolean().default(true),
    copyVenues: z.boolean().default(false),
  }),
  execute: async (inputData, context) => {
    // Single transaction that copies everything
  }
})

// 3. Validate and publish atomically
export const publishCompetition = createTool({
  id: "publish-competition",
  description: `
    Validate and publish a competition atomically.

    Runs full validation and only publishes if all checks pass.
    Returns validation results and publish status.

    Example:
      publishCompetition({
        competitionId: "comp_123",
        visibility: "public",
        forcePublish: false  // Set true to publish even with warnings
      })
  `,
  inputSchema: z.object({
    competitionId: z.string(),
    visibility: z.enum(["public", "private"]).default("public"),
    forcePublish: z.boolean().default(false)
      .describe("Publish even if validation has warnings (not errors)"),
  }),
  execute: async (inputData, context) => {
    const validation = await validateCompetitionImpl(inputData, context)

    if (!validation.isValid && !inputData.forcePublish) {
      return {
        success: false,
        published: false,
        validation,
        message: "Competition has validation errors. Fix them before publishing.",
        nextActions: ["fixValidationErrors", "useForcePublish"]
      }
    }

    await updateCompetitionStatus(inputData.competitionId, "published")
    await updateCompetitionVisibility(inputData.competitionId, inputData.visibility)

    return {
      success: true,
      published: true,
      validation,
      message: "Competition published successfully!"
    }
  }
})

// 4. Auto-schedule all heats
export const scheduleAllHeats = createTool({
  id: "schedule-all-heats",
  description: `
    Automatically generate and schedule heats for all events.

    Creates heats with optimal athlete distribution, considers:
    - Venue capacity (lanes per heat)
    - Time between heats (transition time)
    - Division grouping (keeps divisions together)
    - Athlete recovery time (no back-to-back heats)

    Example:
      scheduleAllHeats({
        competitionId: "comp_123",
        venueId: "venue_main",
        startTime: "2026-05-15T09:00:00",
        athletesPerHeat: 10,
        minutesBetweenHeats: 12
      })
  `,
  inputSchema: z.object({
    competitionId: z.string(),
    venueId: z.string(),
    startTime: z.string().describe("ISO 8601 datetime"),
    athletesPerHeat: z.number().int().min(4).max(12).default(10),
    minutesBetweenHeats: z.number().int().min(5).max(30).default(12),
    groupByDivision: z.boolean().default(true),
  }),
  execute: async (inputData, context) => {
    // Complex scheduling algorithm in code, not agent
    const events = await getCompetitionEvents(inputData.competitionId)
    const registrations = await getCompetitionRegistrations(inputData.competitionId)

    const schedule = await generateOptimalSchedule({
      events,
      registrations,
      ...inputData
    })

    return {
      success: true,
      heatsCreated: schedule.heats.length,
      athletesScheduled: schedule.athletesScheduled,
      unassignedAthletes: schedule.unassignedAthletes,
      schedule: schedule.summary
    }
  }
})

// 5. Holistic readiness check
export const checkCompetitionReadiness = createTool({
  id: "check-competition-readiness",
  description: `
    Comprehensive readiness check before competition day.

    Validates:
    - Setup (divisions, events, waivers)
    - Registrations (payment, waivers signed)
    - Operations (heats scheduled, venues ready)
    - Equipment (based on workout requirements)

    Returns checklist with action items.
  `,
  inputSchema: z.object({
    competitionId: z.string(),
    daysUntilEvent: z.number().int().min(0).default(0),
  }),
  execute: async (inputData, context) => {
    // Runs all validation checks + operational readiness
    return {
      ready: boolean,
      blockers: [...],
      warnings: [...],
      recommendations: [...],
      checklist: {
        setup: { complete: true, issues: [] },
        registrations: { complete: false, issues: ["5 athletes haven't signed waivers"] },
        heats: { complete: true, issues: [] },
        equipment: { complete: true, issues: [] }
      }
    }
  }
})
```

### Phase 2: Error Message Improvements (Week 2)

Refactor all error responses to be **retry prompts**:

1. Add structured error codes (TypeScript enum)
2. Add `suggestion` field to all errors
3. Add `nextActions` array
4. Add contextual examples and alternatives

### Phase 3: Argument Flattening (Week 3)

1. Flatten `settings` object → top-level primitives
2. Replace Lexical JSON waivers with markdown + templates
3. Simplify result encoding (server-side calculation)

### Phase 4: Tool Consolidation (Week 4)

1. Merge CRUD operations into `manage_X` tools
2. Remove redundant list/get operations
3. Target: 15-20 tools total

---

## Example: Before/After Comparison

### Scenario: Create Competition

**BEFORE (Current Implementation):**

```typescript
Agent orchestrates 10 tool calls:

1. createCompetition({name, startDate})
2. createDivision({competitionId, name: "Rx Men", feeCents: 7500})
3. createDivision({competitionId, name: "Rx Women", feeCents: 7500})
4. createDivision({competitionId, name: "Scaled Men", feeCents: 6000})
5. createDivision({competitionId, name: "Scaled Women", feeCents: 6000})
6. createEvent({competitionId, name: "Event 1"})
7. createEvent({competitionId, name: "Event 2"})
8. createEvent({competitionId, name: "Event 3"})
9. createWaiver({competitionId, type: "liability"})
10. validateCompetition({competitionId})

Total: ~40 seconds, 10 API calls, 10 failure points
```

**AFTER (Recommended):**

```typescript
setupNewCompetition({
  name: "Spring Throwdown 2026",
  startDate: "2026-05-15",
  competitionType: "individual",
  expectedAthletes: 100,
  includeScaled: true,
  eventCount: 4
})

Total: ~5 seconds, 1 API call, 1 failure point

Returns:
{
  success: true,
  competitionId: "comp_abc123",
  divisions: ["Rx Men", "Rx Women", "Scaled Men", "Scaled Women"],
  events: ["Event 1", "Event 2", "Event 3", "Event 4"],
  waivers: ["Liability Waiver"],
  ready: true,
  message: "Competition created! Next: add workout details to events.",
  nextActions: ["addWorkoutToEvent", "publishCompetition"]
}
```

---

## Conclusion

The competition agent has **solid architectural patterns** but needs **outcome-centric refactoring**:

**Strengths:**
- ✅ Good router → sub-agent structure
- ✅ Clear domain knowledge in instructions
- ✅ Some high-value outcome tools (validate, analyze, suggest)

**Critical Improvements:**
- ❌ Replace CRUD orchestration with outcome tools
- ❌ Make errors actionable (prompts for retry)
- ⚠️ Flatten complex arguments
- ⚠️ Consolidate tool count

**Philosophy Reminder:**

> "Agents are a distinct type of user with specific limitations: expensive discovery, slow iteration, limited context windows. Your job is to curate the interface for the agent, transforming low-level operations into high-level outcomes."
> — Jeremiah Lowin, FastMCP

**User Experience for Machines:**

The current design treats the agent like a human developer with unlimited patience. The refactored design treats the agent like what it is: **an expensive, slow orchestrator with a limited context window**.

---

## Appendix: Tool Inventory

### Setup Agent (18 tools → Target: 8 tools)

**Current:**
- createCompetition, updateCompetitionDetails
- listDivisions, createDivision, updateDivision, deleteDivision, suggestDivisions
- listEvents, createEvent, updateEvent, deleteEvent, analyzeEventBalance
- listWaivers, getWaiver, createWaiver, updateWaiver, deleteWaiver, getWaiverTemplates
- validateCompetition

**Refactored:**
- ✅ Keep: validateCompetition, analyzeEventBalance, suggestDivisions
- ➕ Add: setupNewCompetition, duplicateCompetition, publishCompetition
- ⚠️ Consolidate: manageDivisions, manageEvents, manageWaivers

### Operations Agent (11 tools → Target: 5 tools)

**Current:**
- listHeats, createHeat, deleteHeat
- assignAthleteToHeat, removeAthleteFromHeat, getUnassignedAthletes
- enterResult, getEventResults, deleteResult

**Refactored:**
- ✅ Keep: getUnassignedAthletes, getEventResults
- ➕ Add: scheduleAllHeats, autoAssignAthletes
- ⚠️ Consolidate: manageHeats, manageResults

### Registration Agent (6 tools → Target: 4 tools)

**Current:**
- getRegistrationOverview, listRegistrations, getRegistrationDetails
- updateRegistration, checkWaiverCompletion

**Refactored:**
- ✅ Keep: getRegistrationOverview, checkWaiverCompletion
- ⚠️ Consolidate: manageRegistrations (list + get + update)

### Shared Tools (2 tools → Keep both)
- ✅ Keep: getCompetitionDetails, listCompetitions

---

**Recommended Target:**
- Setup: 8 tools (down from 18)
- Operations: 5 tools (down from 11)
- Registration: 4 tools (down from 6)
- Shared: 2 tools
- **Total: ~19 tools** (down from 42)

---

**Next Steps:**
1. Review this analysis with team
2. Prioritize Phase 1 high-impact tools
3. Implement `setupNewCompetition()` as proof-of-concept
4. Measure improvement (tool calls, latency, success rate)
5. Create TypeScript error response type for structured errors

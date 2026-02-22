# MCP Tools Quick Start Guide

**For AI Agents and Developers**

This guide shows you how to use the new MCP-optimized tools for competition management.

---

## Core Principle

**Use high-impact outcome tools first**. Only use legacy CRUD tools if the high-impact tools don't fit your specific use case.

---

## Competition Creation

### ✅ PREFERRED: One-Step Setup

```typescript
// Creates complete competition with divisions, events, and waivers
setupNewCompetition({
  name: "Spring Throwdown 2026",
  startDate: "2026-05-15",
  endDate: "2026-05-15",  // Optional, defaults to startDate
  competitionType: "individual",  // or "team" or "pairs"
  expectedAthletes: 100,
  includeScaled: true,    // Add Scaled divisions
  includeMasters: false,  // Add Masters 35+ divisions
  includeTeens: false,    // Add Teen divisions
  eventCount: 4,          // 3, 4, or 5 events
  description: "Annual spring competition",
  registrationFeeDollars: 75  // Optional default fee
})

// Returns:
{
  success: true,
  competitionId: "comp_xyz",
  slug: "spring-throwdown-2026",
  divisions: ["Rx Men", "Rx Women", "Scaled Men", "Scaled Women"],
  events: ["Event 1", "Event 2", "Event 3", "Event 4"],
  waivers: ["Liability Waiver"],
  ready: false,
  message: "Competition created! Next: add workout details to events.",
  nextActions: ["updateEventWorkout", "validateCompetition"]
}
```

### ❌ AVOID: Multi-Step Legacy Method

Don't do this unless you absolutely need fine-grained control:

```typescript
// Step 1
createCompetition({name, startDate})
// Step 2
createDivision({competitionId, name: "Rx Men"})
// Step 3
createDivision({competitionId, name: "Rx Women"})
// ... 8 more steps
```

---

## Competition Cloning

### ✅ PREFERRED: Clone in One Step

```typescript
duplicateCompetition({
  sourceCompetitionId: "comp_spring_2025",
  newName: "Spring Throwdown 2026",
  newStartDate: "2026-05-15",
  newEndDate: "2026-05-15",
  copyEvents: true,       // Clone events
  copyDivisions: true,    // Clone division structure
  copyWaivers: true,      // Clone waivers
  copyVenues: false,      // Don't clone venues
  newDescription: "2026 edition with updated workouts"
})

// Returns:
{
  success: true,
  competitionId: "comp_new",
  slug: "spring-throwdown-2026",
  copiedDivisions: 4,
  copiedEvents: 4,
  copiedWaivers: 1,
  copiedVenues: 0
}
```

---

## Adding Waivers

### ✅ PREFERRED: Template-Based

```typescript
createWaiverSimple({
  competitionId: "comp_123",
  waiverType: "liability",  // "liability" | "photo" | "medical" | "code_of_conduct"
  customText: "Specific rule: No outside chalk allowed.",
  isRequired: true
})

// Server automatically generates proper Lexical JSON from template
```

### ❌ AVOID: Manual Lexical JSON Construction

Don't construct complex JSON manually:

```typescript
createWaiver({
  competitionId: "comp_123",
  content: {
    root: {
      children: [
        {
          children: [
            {
              detail: 0,
              format: 1,
              mode: "normal",
              text: "WAIVER TEXT",
              type: "text",
              version: 1
            }
          ],
          type: "heading",
          // ... 50 more lines of nested JSON
        }
      ]
    }
  }
})
```

---

## Entering Results

### ✅ PREFERRED: Natural Score Entry

```typescript
// Time workout (athlete finished in 5:30)
enterResultSimple({
  registrationId: "reg_123",
  trackWorkoutId: "twkt_1",
  finishTimeMinutes: 5,
  finishTimeSeconds: 30,
  status: "scored"
})

// AMRAP workout (4 rounds + 15 reps)
enterResultSimple({
  registrationId: "reg_456",
  trackWorkoutId: "twkt_2",
  roundsCompleted: 4,
  repsCompleted: 15,
  status: "scored"
})

// Max lift (225 lbs)
enterResultSimple({
  registrationId: "reg_789",
  trackWorkoutId: "twkt_3",
  loadPounds: 225,
  status: "scored"
})

// Server automatically encodes based on workout scheme:
// - Time: (minutes * 60 + seconds) * 1000 milliseconds
// - AMRAP: rounds * 100000 + reps
// - Load: pounds * 453.592 (grams)
```

### ❌ AVOID: Manual Score Encoding

Don't calculate encoding yourself:

```typescript
enterResult({
  registrationId: "reg_123",
  eventId: "evt_1",
  score: 330000  // You had to calculate: (5 * 60 + 30) * 1000
})
```

---

## Publishing Competitions

### ✅ PREFERRED: Validate and Publish Atomically

```typescript
publishCompetition({
  competitionId: "comp_123",
  visibility: "public",  // "public" or "private"
  forcePublish: false    // Set true to publish with warnings
})

// If validation fails:
{
  error: "VALIDATION_FAILED",
  message: "Competition has 2 validation error(s) and cannot be published.",
  suggestion: "No divisions have been created - Create at least one division",
  nextActions: ["fixValidationErrors", "validateCompetition"],
  context: {
    validation: {
      isValid: false,
      issues: [
        {
          severity: "error",
          category: "Divisions",
          message: "No divisions have been created",
          suggestion: "Create at least one division for athletes to register"
        }
      ]
    }
  }
}

// If validation passes:
{
  success: true,
  competitionId: "comp_123",
  status: "published",
  visibility: "public",
  validation: { isValid: true, issues: [] },
  message: "Competition published successfully!"
}
```

### ❌ AVOID: Separate Validate + Update

Don't split the workflow:

```typescript
// Step 1
validateCompetition({competitionId})
// Step 2
updateCompetitionDetails({competitionId, status: "published"})
```

---

## Checking Competition Readiness

### ✅ USE THIS: Comprehensive Pre-Event Check

```typescript
checkCompetitionReadiness({
  competitionId: "comp_123",
  daysUntilEvent: 7  // Days until competition starts
})

// Returns detailed checklist:
{
  success: true,
  ready: false,
  blockers: [
    "5 athletes haven't signed waivers"
  ],
  warnings: [
    "Event 2 has no heats",
    "Registration still open (closes in 7 days)"
  ],
  recommendations: [
    "Send reminder email to athletes",
    "Finalize heat schedules and publish to athletes"
  ],
  checklist: {
    setup: { complete: true, issues: [] },
    registrations: {
      complete: false,
      issues: ["5 unsigned waivers"]
    },
    heats: {
      complete: false,
      issues: ["Event 2 needs heats"]
    },
    equipment: { complete: true, issues: [] }
  },
  totalRegistrations: 95,
  daysUntilEvent: 7,
  nextActions: ["fixBlockers", "reviewWarnings"]
}
```

---

## Error Handling

All new tools return structured errors with recovery guidance:

```typescript
// Error structure
{
  error: "ERROR_CODE",           // Machine-readable error code
  message: "Human description",   // What went wrong
  suggestion: "How to fix it",    // What to do next
  nextActions: ["action1", "action2"],  // Recommended tools to call
  context: { ... },              // Additional context
  example: "..."                 // Valid example if applicable
}
```

### Common Error Codes

- `NO_TEAM_CONTEXT` - Missing team context (call listCompetitions)
- `COMPETITION_NOT_FOUND` - Competition doesn't exist (check ID)
- `ACCESS_DENIED` - No permission (switch teams or request access)
- `INVALID_DATE_FORMAT` - Bad date format (use YYYY-MM-DD)
- `SLUG_CONFLICT` - Slug already taken (try suggestions)
- `VALIDATION_FAILED` - Validation errors (fix issues in context)
- `DEPENDENCY_MISSING` - Required resource missing (create it first)
- `OPERATION_FAILED` - General failure (check message for details)

### Example Error Handling Flow

```typescript
// Agent calls publishCompetition
const result = publishCompetition({competitionId: "comp_123"})

// Result has validation errors
if (result.error === "VALIDATION_FAILED") {
  // Look at context to see what's wrong
  result.context.validation.issues.forEach(issue => {
    console.log(issue.message)      // "No divisions have been created"
    console.log(issue.suggestion)   // "Create at least one division"
  })

  // Follow nextActions
  result.nextActions  // ["fixValidationErrors", "validateCompetition"]
}
```

---

## Workflow Recipes

### Recipe 1: Complete Competition Setup (Fast Path)

```typescript
// 1. Create competition with everything
const setup = setupNewCompetition({
  name: "Fall Classic 2026",
  startDate: "2026-10-15",
  competitionType: "individual",
  expectedAthletes: 120,
  includeScaled: true,
  eventCount: 5
})

// 2. Customize event workouts (use existing tools)
updateEvent({
  eventId: setup.events[0],
  workoutDetails: "21-15-9 Thrusters (95/65) and Pull-ups"
})

// 3. Publish when ready
publishCompetition({
  competitionId: setup.competitionId,
  visibility: "public"
})
```

### Recipe 2: Clone and Modify

```typescript
// 1. Clone last year's competition
const clone = duplicateCompetition({
  sourceCompetitionId: "comp_fall_2025",
  newName: "Fall Classic 2026",
  newStartDate: "2026-10-15",
  copyEvents: true,
  copyDivisions: true,
  copyWaivers: true
})

// 2. Update specific details as needed
updateCompetitionDetails({
  competitionId: clone.competitionId,
  description: "Updated for 2026 with new venue"
})

// 3. Modify events
updateEvent({
  eventId: clone.events[0],
  workoutDetails: "Updated workout for 2026"
})
```

### Recipe 3: Pre-Event Checklist

```typescript
// 1. Check readiness 7 days before event
const readiness = checkCompetitionReadiness({
  competitionId: "comp_123",
  daysUntilEvent: 7
})

// 2. Address blockers first
if (readiness.blockers.length > 0) {
  // Handle each blocker (e.g., unsigned waivers)
  sendWaiverReminders(...)
}

// 3. Address warnings
if (readiness.warnings.length > 0) {
  // Create heats, close registration, etc.
  createHeat(...)
}

// 4. Check again day before
const finalCheck = checkCompetitionReadiness({
  competitionId: "comp_123",
  daysUntilEvent: 1
})
```

---

## Tool Selection Decision Tree

```
Need to create a competition?
├─ Creating from scratch?
│  └─ Use: setupNewCompetition ✅
└─ Cloning existing?
   └─ Use: duplicateCompetition ✅

Need to add waivers?
├─ Standard waiver types?
│  └─ Use: createWaiverSimple ✅
└─ Completely custom content?
   └─ Use: createWaiver (legacy)

Need to enter results?
├─ Normal score entry?
│  └─ Use: enterResultSimple ✅
└─ Pre-encoded scores?
   └─ Use: enterResult (legacy)

Need to publish?
├─ Want validation first?
│  └─ Use: publishCompetition ✅
└─ Just change status?
   └─ Use: updateCompetitionDetails (legacy)

Need to check if ready?
├─ Comprehensive check?
│  └─ Use: checkCompetitionReadiness ✅
└─ Basic validation?
   └─ Use: validateCompetition (legacy)
```

---

## Best Practices

### 1. Always Use Outcome Tools First

High-impact tools are faster, more reliable, and provide better error messages.

### 2. Read Error Messages Carefully

Structured errors tell you exactly what to do next:
- `message`: What went wrong
- `suggestion`: How to fix it
- `nextActions`: Which tools to call
- `context`: Additional data to help debug

### 3. Don't Ignore `nextActions`

The `nextActions` field contains the recommended tools to call next. Follow them!

### 4. Use Natural Values

Don't calculate encodings or construct complex JSON. New tools handle that server-side:
- Dates: `"2026-05-15"` (not timestamps)
- Times: `finishTimeMinutes: 5, finishTimeSeconds: 30` (not milliseconds)
- Waivers: `waiverType: "liability"` (not Lexical JSON)

### 5. Leverage Examples

Every new tool has inline examples. Copy-paste and modify them!

---

## Migration from Legacy Tools

If you're currently using legacy tools, here's how to migrate:

| Legacy Tool | New Tool | Benefit |
|-------------|----------|---------|
| createCompetition + manual setup | setupNewCompetition | 90% fewer calls |
| Manual cloning | duplicateCompetition | One atomic operation |
| createWaiver (with JSON) | createWaiverSimple | No complex JSON |
| enterResult (with encoding) | enterResultSimple | Natural score entry |
| validateCompetition + updateCompetitionDetails | publishCompetition | Atomic validation + publish |
| Multiple validation calls | checkCompetitionReadiness | Comprehensive checklist |

**Migration is optional** - all legacy tools still work!

---

## Support and Feedback

**Questions?**
- Read tool descriptions (they have examples)
- Check error messages (they have suggestions)
- Review MCP-REFACTORING-SUMMARY.md for detailed documentation

**Found a bug?**
- Check if you're using the right argument types
- Verify IDs exist (use list tools to check)
- Look at error context for additional details

**Want to contribute?**
- See MCP-COMPETITION-AGENT-REVIEW.md for design philosophy
- Follow the 5 Golden Rules of MCP design
- Add structured errors to any new tools

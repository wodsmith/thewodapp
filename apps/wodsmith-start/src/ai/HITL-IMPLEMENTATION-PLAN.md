# Human-in-the-Loop (HITL) Implementation Plan

This document outlines the plan for adding human-in-the-loop confirmation to destructive or high-risk operations in the competition management AI agent.

## Overview

HITL ensures that significant actions require explicit user approval before execution. This prevents accidental data loss and gives organizers a chance to review changes before they're applied.

## Mastra HITL Pattern

Mastra supports HITL via `suspend()` and `resume()` in workflow steps, or via tool confirmation in agents. For tools, we can use the confirmation pattern:

```typescript
import { createTool } from "@mastra/core/tools"

export const deleteDivision = createTool({
  id: "delete-division",
  description: "Delete a division from a competition",
  inputSchema: z.object({
    divisionId: z.string(),
    confirmed: z.boolean().optional().describe("Set to true to confirm deletion"),
  }),
  execute: async ({ divisionId, confirmed }, context) => {
    // First call: gather impact data and request confirmation
    if (!confirmed) {
      const impact = await gatherDeletionImpact(divisionId)
      return {
        requiresConfirmation: true,
        action: "delete-division",
        impact: {
          divisionName: impact.name,
          registeredAthletes: impact.athleteCount,
          scheduledHeats: impact.heatCount,
        },
        message: `Deleting "${impact.name}" will affect ${impact.athleteCount} athletes and ${impact.heatCount} heats. Call again with confirmed: true to proceed.`,
      }
    }

    // Second call: execute deletion
    await executeDelete(divisionId)
    return { success: true, deleted: divisionId }
  },
})
```

## Priority 1: High-Risk Delete Operations

### 1.1 Delete Division (`src/ai/tools/setup/divisions.ts`)

**Current behavior:** Deletes division immediately
**Risk:** Orphans registered athletes, breaks heat assignments

**HITL implementation:**
- [ ] Check for registered athletes in the division
- [ ] Check for heats filtered by this division
- [ ] Return impact summary if not confirmed
- [ ] Require `confirmed: true` to proceed
- [ ] Consider: Should we reassign athletes to another division or fail?

**Impact data to show:**
```typescript
{
  divisionName: string,
  registeredAthletes: number,
  athleteNames: string[], // first 5
  scheduledHeats: number,
  warning: "Athletes will be unassigned from this division"
}
```

### 1.2 Delete Event (`src/ai/tools/setup/events.ts`)

**Current behavior:** Deletes track workout immediately
**Risk:** Loses heats, results, and scheduling data

**HITL implementation:**
- [ ] Check for heats scheduled for this event
- [ ] Check for results already entered
- [ ] Check for heat assignments
- [ ] Return impact summary if not confirmed

**Impact data to show:**
```typescript
{
  eventName: string,
  scheduledHeats: number,
  resultsEntered: number,
  athletesScheduled: number,
  warning: "All heats and results for this event will be permanently deleted"
}
```

### 1.3 Delete Waiver (`src/ai/tools/setup/waivers.ts`)

**Current behavior:** Deletes waiver immediately
**Risk:** Legal liability - athletes may have signed this waiver

**HITL implementation:**
- [ ] Check for signatures on this waiver
- [ ] Check if waiver is required for registration
- [ ] Return impact summary if not confirmed

**Impact data to show:**
```typescript
{
  waiverTitle: string,
  signatureCount: number,
  isRequired: boolean,
  warning: "Signature records will be preserved but waiver will be inactive"
}
```

### 1.4 Delete Result (`src/ai/tools/operations/results.ts`)

**Current behavior:** Deletes score immediately
**Risk:** Permanent data loss, affects leaderboards

**HITL implementation:**
- [ ] Show the result being deleted (athlete, score, rank)
- [ ] Return impact summary if not confirmed

**Impact data to show:**
```typescript
{
  athleteName: string,
  eventName: string,
  score: string, // formatted
  currentRank: number,
  warning: "This score will be permanently deleted"
}
```

## Priority 2: Medium-Risk Operations

### 2.1 Delete Heat (`src/ai/tools/operations/heats.ts`)

**HITL implementation:**
- [ ] Check for assigned athletes
- [ ] Check if schedule has been published
- [ ] Return impact if athletes are assigned

**Impact data:**
```typescript
{
  heatNumber: number,
  eventName: string,
  assignedAthletes: number,
  isPublished: boolean,
  warning: "Athletes will need to be reassigned to other heats"
}
```

### 2.2 Update Registration - Division Change (`src/ai/tools/registration/registrations.ts`)

**HITL implementation:**
- [ ] Only require confirmation when changing division
- [ ] Show old vs new division
- [ ] Check if athlete has heat assignments in old division

**Impact data:**
```typescript
{
  athleteName: string,
  oldDivision: string,
  newDivision: string,
  hasHeatAssignments: boolean,
  warning: "Heat assignments may need to be updated"
}
```

### 2.3 Bulk Heat Assignment (future tool)

**HITL implementation:**
- [ ] Show summary of assignments before applying
- [ ] List athletes and their assigned heats
- [ ] Require confirmation for >5 assignments

## Priority 3: Workflow HITL (Already Implemented)

### 3.1 Publish Competition (`src/ai/workflows/publish-competition.ts`)

**Status:** ✅ Implemented

Uses Mastra's `suspend()` pattern to:
1. Validate competition setup
2. Suspend with validation summary
3. Wait for user approval
4. Execute publish if approved

## Implementation Checklist

### Phase 1: Core Delete Operations
- [ ] Create shared HITL helper function
- [ ] Update `deleteDivision` tool
- [ ] Update `deleteEvent` tool
- [ ] Update `deleteWaiver` tool
- [ ] Update `deleteResult` tool

### Phase 2: Heat Operations
- [ ] Update `deleteHeat` tool
- [ ] Add bulk assignment tool with HITL

### Phase 3: Registration Operations
- [ ] Update `updateRegistration` for division changes

### Phase 4: Testing
- [ ] Test confirmation flow in chat UI
- [ ] Verify impact data is accurate
- [ ] Test edge cases (no impact, large impact)

## Shared Helper Pattern

Create a reusable helper for consistent HITL behavior:

```typescript
// src/ai/tools/utils/hitl.ts

export interface HITLImpact {
  action: string
  targetName: string
  affectedItems: Array<{ type: string; count: number; names?: string[] }>
  warnings: string[]
}

export function createHITLResponse(impact: HITLImpact) {
  return {
    requiresConfirmation: true,
    ...impact,
    message: formatImpactMessage(impact),
    hint: "Call this tool again with confirmed: true to proceed",
  }
}

function formatImpactMessage(impact: HITLImpact): string {
  const lines = [`Action: ${impact.action} "${impact.targetName}"`]

  for (const item of impact.affectedItems) {
    if (item.count > 0) {
      lines.push(`- ${item.count} ${item.type} will be affected`)
    }
  }

  for (const warning of impact.warnings) {
    lines.push(`⚠️ ${warning}`)
  }

  return lines.join("\n")
}
```

## UI Considerations

The chat UI should:
1. Recognize `requiresConfirmation: true` responses
2. Display the impact summary prominently
3. Provide "Confirm" and "Cancel" buttons
4. On confirm, re-call the tool with `confirmed: true`

## References

- Mastra HITL docs: https://mastra.ai/docs/workflows/human-in-the-loop
- Current workflow implementation: `src/ai/workflows/publish-competition.ts`
- Agent tools: `src/ai/tools/`

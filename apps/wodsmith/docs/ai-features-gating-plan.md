# AI Features Gating Plan

This document outlines all AI-powered features in the application that need entitlement gating.

## Feature Gates Required

### 1. AI Chat Assistant

**Location:** `/src/app/(main)/chat/page.tsx`
**API Route:** `/src/app/api/chat/route.ts`
**Model:** OpenAI GPT-4o via Vercel AI SDK
**Description:** Generic chat assistant for workout and training questions

**Entitlements Required:**
- **Feature:** `FEATURES.AI_WORKOUT_GENERATION`
- **Limit:** `LIMITS.AI_MESSAGES_PER_MONTH`

**Gating Points:**

#### Server-Side (Priority 1)
1. **API Route** (`src/app/api/chat/route.ts:22`):
   - Add feature check: `requireFeature(teamId, FEATURES.AI_WORKOUT_GENERATION)`
   - Add usage tracking and limit check before processing message
   - Increment `AI_MESSAGES_PER_MONTH` counter after successful response
   - Return appropriate error responses when blocked

#### UI-Side (Priority 2)
2. **Chat Page** (`src/app/(main)/chat/page.tsx`):
   - Check feature access on page load
   - Show upgrade prompt if feature not available
   - Display usage indicator (e.g., "15/100 messages this month")
   - Disable input and show limit reached message when at limit
   - Show "Upgrade to Pro" CTA for free users

**Implementation Notes:**
- Need to associate chat messages with a teamId (currently only checks user session)
- May need to add team context selection if user belongs to multiple teams
- Usage tracking requires incrementing `team_usage` table after each message

---

### 2. AI Schedule Generation

**Location:** `/src/server/ai/scheduler.ts`
**Action:** `/src/actions/generate-schedule-actions.ts`
**Model:** LLM for coach optimization (currently mocked, line 14-20)
**Description:** AI-powered coach scheduling considering skills, availability, and preferences

**Entitlements Required:**
- **Feature:** `FEATURES.AI_WORKOUT_GENERATION` (or consider creating `FEATURES.AI_SCHEDULING`)
- **Limit:** Optional - could use `LIMITS.AI_MESSAGES_PER_MONTH` if LLM is enabled

**Gating Points:**

#### Server-Side (Priority 1)
1. **Generate Schedule Action** (`src/actions/generate-schedule-actions.ts:44`):
   - Add feature check at beginning of handler: `requireFeature(teamId, FEATURES.AI_WORKOUT_GENERATION)`
   - Currently the LLM is mocked (scheduler.ts:14-20), so gating can wait until LLM is actually implemented
   - When LLM is enabled, increment usage counter

**Implementation Notes:**
- Current implementation has mocked LLM (`callLLMForSchedulingOptimization` at scheduler.ts:14)
- Feature gate should be added now, but usage tracking can wait until LLM is actually integrated
- Consider separate feature flag like `FEATURES.AI_SCHEDULING` for future flexibility

---

## Implementation Priority

### Phase 1: Server-Side Enforcement (High Priority)
✅ Team creation - COMPLETED
✅ Member invites - COMPLETED
✅ Programming tracks - COMPLETED
⏳ AI chat API route - PENDING
⏳ AI schedule generation - PENDING (low priority until LLM is enabled)

### Phase 2: UI Feedback (Medium Priority)
✅ Team creation page - COMPLETED
✅ Invite member modal - COMPLETED
✅ Programming track dialog - COMPLETED
⏳ Chat page - PENDING
⏳ Schedule generation UI - PENDING (low priority)

### Phase 3: Usage Tracking (Medium Priority)
⏳ AI message counting in `team_usage` table
⏳ Monthly reset logic for AI message limits
⏳ Usage display in UI components
⏳ Upgrade prompts when approaching limits

---

## Technical Implementation Details

### Team Context for AI Features

**Current Issue:** Chat API only validates user session, doesn't track which team is using the AI.

**Solution Required:**
1. Add team context to chat requests (either via URL param, body, or separate team selector)
2. Update `POST /api/chat/route.ts` to:
   - Extract teamId from request
   - Check team's entitlements before processing
   - Track usage against the team's limit

**Example Implementation:**
```typescript
// In src/app/api/chat/route.ts
export async function POST(req: NextRequest) {
  const session = await getSessionFromCookie();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const teamId = body.teamId; // Add to request body

  // Check feature access
  await requireFeature(teamId, FEATURES.AI_WORKOUT_GENERATION);

  // Check usage limit
  await requireLimit(teamId, LIMITS.AI_MESSAGES_PER_MONTH);

  // Process chat...
  const result = streamText({...});

  // Increment usage counter (consider doing this after streaming completes)
  await incrementUsage(teamId, LIMITS.AI_MESSAGES_PER_MONTH, 1);

  return result.toUIMessageStreamResponse();
}
```

### Usage Tracking Schema

The `team_usage` table tracks consumption:
```sql
CREATE TABLE team_usage (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  limit_key TEXT NOT NULL,
  usage_count INTEGER NOT NULL,
  period_start DATETIME NOT NULL,
  period_end DATETIME NOT NULL
);
```

**Usage Flow:**
1. Before AI call: Check current usage vs limit
2. After AI call: Increment usage count
3. Reset: Automatically resets when `period_end` is passed

---

## Future Enhancements

1. **Usage Analytics Dashboard**
   - Show team's AI usage over time
   - Provide usage forecasting
   - Upgrade recommendations

2. **Separate Feature Flags**
   - `FEATURES.AI_CHAT` - Chat assistant
   - `FEATURES.AI_SCHEDULING` - Schedule optimization
   - `FEATURES.AI_WORKOUT_BUILDER` - Future workout generation

3. **Separate Limits**
   - `LIMITS.AI_CHAT_MESSAGES` - Chat-specific limit
   - `LIMITS.AI_SCHEDULE_GENERATIONS` - Scheduling-specific limit
   - More granular tracking and upsell opportunities

4. **Rate Limiting**
   - Per-minute/hour rate limits in addition to monthly
   - Prevent abuse while staying within plan limits

---

## Testing Checklist

- [ ] Free plan user cannot access chat page
- [ ] Free plan user sees upgrade prompt on chat page
- [ ] Pro plan user can access chat
- [ ] Chat API blocks requests without feature access
- [ ] Chat API blocks requests when at monthly limit
- [ ] Usage counter increments after each message
- [ ] Usage resets at period boundary
- [ ] Schedule generation blocks without feature access
- [ ] Error messages are user-friendly
- [ ] Upgrade CTAs link to billing page

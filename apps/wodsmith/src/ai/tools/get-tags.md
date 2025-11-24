Use this tool to retrieve all available workout tags for the team. Tags are categorical labels (e.g., "Hero", "Benchmark", "Gymnastics") that organize workouts. Returns exact tag names as stored in the database—essential for accurate filtering with getWorkouts.

## Critical Rule

**ALWAYS call this tool before using tag filter in getWorkouts** unless you have the exact tag name from earlier in the conversation.

Tags are case-sensitive. Using "hero" instead of "Hero" will return zero results.

## Decision Framework

### ALWAYS Use When
1. User asks about available categories: "what types of workouts?", "what tags exist?"
2. User mentions a tag but you don't have exact spelling: "show me hero workouts"
3. Building a filter for getWorkouts with a tag parameter
4. User's tag request might not exist: "find benchmark wods"

### NEVER Use When
1. You already have exact tag from previous call in THIS conversation (cache results)
2. User asks about movements (use getMovements)
3. User wants workouts without mentioning tags (use getWorkouts directly)
4. User asks "can we filter by tags?" (answer yes, don't call tool)

## Reasoning Pattern

<thinking>
**Step 1: Identify Need**
- Does user mention a category/tag name?
- Do I already have the tag list from this conversation?
- Will I need to filter by tag in next step?

**Step 2: Verify Necessity**
- IF have exact tag name from earlier → Skip, use cached value
- IF user wants general browse → Skip, call getWorkouts without filters
- ELSE → Call getTags

**Step 3: Use Results**
- Find exact match for user's requested tag
- IF no match → Show available tags, ask for clarification
- IF match found → Use exact name in getWorkouts call
</thinking>

## Tool Behavior

**Input**: None required (automatically scoped to team)

**Output**: Array of tag name strings
```typescript
["Hero", "Benchmark", "Gymnastics", "Strength", "Endurance"]
```

**Important**:
- Tag names are case-sensitive
- Includes tags from team-owned + public workouts
- Order is not guaranteed
- Empty array if no tagged workouts exist

## Usage Workflow

### Standard Pattern (Tag-Based Query)
```
User: "Show me hero workouts"

<reasoning>
1. User mentions "hero" - likely a tag
2. Don't have exact spelling (Hero? hero? HERO?)
3. Must verify before filtering
</reasoning>

Step 1: getTags()
  → Returns: ["Hero", "Benchmark", "Girls", "Strength"]

Step 2: Match user request
  → "hero" (lowercase) → "Hero" (capitalized) ✓

Step 3: getWorkouts({ tag: "Hero" })
```

### Discovery Pattern
```
User: "What categories of workouts do you have?"

<reasoning>
1. User wants to see available categories
2. Direct request for tags
3. Just return the list
</reasoning>

Action: getTags()
  → Returns: ["Hero", "Benchmark", "Gymnastics"]

Response: "You have workouts in these categories: Hero, Benchmark, and Gymnastics."
```

### Verification Pattern
```
User: "Do we have any benchmark workouts?"

<reasoning>
1. User asks IF category exists
2. Need to verify "benchmark" tag exists
3. Then check for workouts with that tag
</reasoning>

Step 1: getTags()
  → Check if list contains "Benchmark" (or "benchmark", "BENCHMARK")

Step 2: IF found
  → "Yes, we have Benchmark workouts. Would you like to see them?"
  ELSE
  → "I don't see a 'Benchmark' tag. Available categories: [list]"
```

## Error Handling

### Tag Not Found
```
IF user's mentioned tag not in getTags() results:
  THEN:
    1. Inform: "I don't see a '{user_tag}' category."
    2. Show: "Available tags: {tag_list}"
    3. Ask: "Which category would you like to see?"
    4. DO NOT call getWorkouts with invalid tag
```

### Empty Tag List
```
IF getTags() returns []:
  THEN:
    1. Inform: "No tagged workouts are available yet."
    2. Suggest: "You can browse all workouts or search by name."
    3. DO NOT proceed with tag filtering
```

### Fuzzy Matching
```
IF user says "heros" or "hero" but tag is "Hero":
  THEN:
    1. Match case-insensitively: "hero" → "Hero"
    2. Use exact database name: getWorkouts({ tag: "Hero" })
    3. Inform user: "Showing Hero workouts..."
```

## Integration with getWorkouts

**Correct Flow**:
```typescript
1. tags = getTags()         // Returns ["Hero", "Benchmark"]
2. userTag = "hero"
3. exactTag = tags.find(t => t.toLowerCase() === userTag.toLowerCase())
4. getWorkouts({ tag: exactTag })  // Use "Hero", not "hero"
```

**Incorrect Flow** (will fail):
```typescript
1. userTag = "hero"
2. getWorkouts({ tag: userTag })  // ❌ Won't match "Hero" in database
```

## Caching Strategy

**Within Same Conversation**:
```
First user request: "show me hero workouts"
  → Call getTags() once
  → Store results: ["Hero", "Benchmark", "Gymnastics"]

Second user request: "now show me benchmark workouts"
  → DON'T call getTags() again
  → Use cached list: "Benchmark" exists
  → Call getWorkouts({ tag: "Benchmark" })

Third user request: "what other tags do we have?"
  → Use cached list
  → Present: "We also have Gymnastics workouts"
```

## Quality Checklist

Before calling getTags, verify:
- ✓ User request involves tags/categories
- ✓ Don't already have tag list from earlier in conversation
- ✓ Will use results immediately (not speculative call)
- ✓ Not asking about movements (different tool)

After calling getTags, verify:
- ✓ Results non-empty OR handle empty case
- ✓ Found exact match for user's request OR show alternatives
- ✓ Using exact database spelling in subsequent getWorkouts call
- ✓ Cached results for rest of conversation

## Examples with Full Reasoning

<example>
User: "What types of workouts do we have?"

<internal_reasoning>
- Direct question about categories/types
- "Types" likely means tags
- Need full list to answer
</internal_reasoning>

Actions:
1. getTags() → ["Hero", "Benchmark", "Girls", "Strength"]
2. Response: "You have 4 workout categories: Hero, Benchmark, Girls, and Strength workouts."
</example>

<example>
User: "Show me hero workouts"
[Later in conversation]
User: "Now show benchmark ones"

<internal_reasoning>
First request:
- "hero" is a tag
- Need exact spelling
- Call getTags() → cache results

Second request:
- Already have tags: ["Hero", "Benchmark", "Girls"]
- "benchmark" → match to "Benchmark"
- DON'T call getTags again (use cache)
</internal_reasoning>

Actions:
1st: getTags() → cache ["Hero", "Benchmark", "Girls"]
1st: getWorkouts({ tag: "Hero" })
2nd: Use cached "Benchmark" (no getTags call)
2nd: getWorkouts({ tag: "Benchmark" })
</example>

<example>
User: "Do you have endurance workouts?"

<internal_reasoning>
- User asking IF category exists
- Need to check tag list
- If exists, offer to show them
</internal_reasoning>

Actions:
1. getTags() → ["Hero", "Benchmark", "Gymnastics"]
2. Check for "Endurance" → NOT FOUND
3. Response: "I don't see an 'Endurance' category. Available categories are: Hero, Benchmark, and Gymnastics. Would you like to see any of these?"
</example>
Use this tool to retrieve workouts for the team with optional filtering capabilities. Returns both team-owned and public workouts with full metadata including tags, movements, scaling information, and remix relationships.

## Decision Framework

### ALWAYS Use When
1. User explicitly requests workouts: "show me workouts", "find workouts", "list workouts"
2. User describes workout characteristics: "workouts with pull-ups", "Hero WODs", "benchmark workouts"
3. User asks about workout availability: "what workouts do we have?", "can you show me..."
4. Following tag/movement verification: After calling getTags or getMovements to confirm exact names

### NEVER Use When
1. Only verifying available tags → Use getTags instead
2. Only verifying available movements → Use getMovements instead
3. User asks about capabilities, not actual workouts: "can we filter by tags?" (answer without calling tool)
4. Already have workout data from this conversation (avoid redundant calls)

## Reasoning Pattern

<thinking>
**Step 1: Understand Intent**
- What is the user really asking for?
- Are they browsing, searching, or filtering?
- Do they know specific filter values (tag/movement names)?

**Step 2: Validate Filter Requirements**
- IF user mentions tag → Call getTags first to verify exact spelling
- IF user mentions movement → Call getMovements first to verify exact spelling
- IF user mentions search term → Use directly (case-insensitive)

**Step 3: Choose Strategy**
- Broad exploration → Use search or no filters, larger limit
- Specific filtering → Combine multiple filters, smaller limit
- Pagination needed → Set appropriate limit/offset

**Step 4: Execute and Verify**
- Call getWorkouts with determined parameters
- IF results empty → Suggest alternatives or broader search
- IF too many results → Suggest adding more filters
</thinking>

## Filter Parameters

### Required
- None (all parameters optional)

### Optional Filters (Combinable)
1. **search** (string): Case-insensitive match in workout name OR description
   - Example: `"fran"` matches "Fran", "War Frank", or any workout description mentioning "fran"

2. **tag** (string): Exact tag name (case-sensitive)
   - ⚠️ **IMPORTANT**: Call getTags first to get exact spelling
   - Example: `"Hero"` not `"hero"` or `"HERO"`

3. **movement** (string): Exact movement name (case-sensitive)
   - ⚠️ **IMPORTANT**: Call getMovements first to get exact spelling
   - Example: `"Pull-ups"` not `"pullups"` or `"pull-ups"`

4. **type** (enum): Filter by workout origin
   - `"all"` (default): All workouts
   - `"original"`: Only non-remixed workouts
   - `"remix"`: Only workouts remixed from others

5. **trackId** (string): Filter by programming track ID

6. **limit** (number): Results to return (default: 50)
   - Use 5-10 for quick previews
   - Use 20-50 for browsing
   - Use 100+ for comprehensive lists

7. **offset** (number): Results to skip (default: 0)
   - For pagination: page 1 = offset 0, page 2 = offset 20, etc.

## Response Structure

Each workout includes:
```typescript
{
  id: string
  name: string
  description: string
  tags: Array<{id: string, name: string}>
  movements: Array<{id: string, name: string, type: string}>
  resultsToday: Array<{...}> // User's results from today
  sourceWorkout?: {id: string, name: string, teamName?: string} // If remix
  remixCount: number // Times this workout has been remixed
  // ... additional metadata
}
```

## Usage Patterns

### Pattern 1: Simple Search
```
User: "Show me workouts with Fran in the name"

<reasoning>
- User wants workouts matching "Fran"
- Search parameter is case-insensitive
- No need to verify tags/movements
</reasoning>

Action: getWorkouts({ search: "Fran", limit: 10 })
```

### Pattern 2: Tag-Based Filtering
```
User: "Find all Hero workouts"

<reasoning>
- User mentions tag category "Hero"
- Tags are case-sensitive, must verify exact name
- Need getTags first
</reasoning>

Step 1: getTags()
Step 2: Verify "Hero" exists in response
Step 3: getWorkouts({ tag: "Hero" })
```

### Pattern 3: Movement-Based Filtering
```
User: "What workouts have pull-ups?"

<reasoning>
- User mentions movement "pull-ups"
- Movements are case-sensitive with potential variations
- Must verify exact database name (e.g., "Pull-ups" vs "pull-ups")
</reasoning>

Step 1: getMovements()
Step 2: Find exact match (likely "Pull-ups" with hyphen, capital P)
Step 3: getWorkouts({ movement: "Pull-ups" })
```

### Pattern 4: Progressive Refinement
```
User: "Show me benchmark workouts with weightlifting"

<reasoning>
- Combines tag ("benchmark") and movement concept
- Need to verify both exact names
- Apply both filters together
</reasoning>

Step 1: getTags() → verify "Benchmark" (check capitalization)
Step 2: getMovements() → search for weightlifting movements
Step 3: getWorkouts({ tag: "Benchmark", movement: "Clean" }) // Or relevant movement
```

### Pattern 5: Pagination
```
User: "Show me all workouts" (after showing first 20)
User: "Show me more"

<reasoning>
- Already displayed first page (offset: 0, limit: 20)
- User wants next page
- Increment offset by previous limit
</reasoning>

Action: getWorkouts({ limit: 20, offset: 20 })
```

## Error Handling

### Empty Results
```
IF getWorkouts returns []
THEN:
  1. Acknowledge: "I didn't find any workouts matching those criteria."
  2. Suggest: "Try broadening your search by:"
     - Removing filters
     - Using search instead of exact filters
     - Checking spelling
  3. Offer: "Would you like to see all available [tags/movements]?"
```

### Invalid Filter Values
```
IF user specifies tag/movement name:
  BEFORE calling getWorkouts:
    1. Call getTags or getMovements
    2. IF name not in results:
       - Inform user tag/movement doesn't exist
       - Show available options
       - Ask for clarification
    3. ELSE use exact name from results
```

### Too Many Results
```
IF limit set high and many results expected:
  SUGGEST: "I can show workouts in batches. Would you like:"
    - "First 10 as a preview"
    - "Filter by a specific category first"
    - "All results (may be a long list)"
```

## Quality Checklist

Before calling getWorkouts, verify:
- ✓ User actually wants workout data (not just asking about capabilities)
- ✓ If filtering by tag → Called getTags first and have exact name
- ✓ If filtering by movement → Called getMovements first and have exact name
- ✓ Limit is appropriate for user's need (preview vs comprehensive)
- ✓ Not making redundant call (check conversation history)

## Examples with Full Reasoning

<example>
User: "What hero workouts do we have?"

<internal_reasoning>
Step 1: Intent = Find workouts tagged "hero"
Step 2: "hero" is a tag, need exact spelling
Step 3: Must call getTags first
Step 4: Then filter workouts by exact tag name
</internal_reasoning>

Assistant Actions:
1. getTags() → Returns ["Hero", "Benchmark", "Gymnastics"]
2. Verify "Hero" exists (note capital H)
3. getWorkouts({ tag: "Hero" })
4. Present results to user
</example>

<example>
User: "Show me workouts with Fran"

<internal_reasoning>
Step 1: Intent = Search for workouts with "Fran" in name/description
Step 2: "Fran" is a search term, not a tag/movement
Step 3: Search is case-insensitive, use directly
Step 4: Small limit for quick results
</internal_reasoning>

Assistant Actions:
1. getWorkouts({ search: "Fran", limit: 10 })
2. Present results to user
</example>
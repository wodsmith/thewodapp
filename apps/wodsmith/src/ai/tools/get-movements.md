Use this tool to retrieve all available workout movements for the team. Movements are specific exercises (e.g., "Pull-ups", "Deadlift", "Box Jump") that appear in workouts. Returns exact movement names as stored in the database—essential for accurate filtering with getWorkouts.

## Critical Rule

**ALWAYS call this tool before using movement filter in getWorkouts** unless you have the exact movement name from earlier in the conversation.

Movements are case-sensitive with spelling variations. Using "pullups" instead of "Pull-ups" will return zero results.

## Decision Framework

### ALWAYS Use When
1. User asks about available exercises: "what movements?", "what exercises do we have?"
2. User mentions a movement but you don't have exact spelling: "show workouts with pull-ups"
3. Building a filter for getWorkouts with a movement parameter
4. User's movement might not exist or has unclear spelling: "find workouts with pullups"

### NEVER Use When
1. You already have exact movement from previous call in THIS conversation (cache results)
2. User asks about tags/categories (use getTags)
3. User wants workouts without mentioning movements (use getWorkouts directly)
4. User asks "can we filter by movements?" (answer yes, don't call tool)

## Reasoning Pattern

<thinking>
**Step 1: Identify Need**
- Does user mention a specific exercise/movement?
- Do I already have the movement list from this conversation?
- Will I need to filter by movement in next step?

**Step 2: Verify Necessity**
- IF have exact movement name from earlier → Skip, use cached value
- IF user wants general browse → Skip, call getWorkouts without filters
- ELSE → Call getMovements

**Step 3: Use Results**
- Find exact match for user's requested movement
- Consider spelling variations: "pullups" vs "Pull-ups", "deadlift" vs "Deadlift"
- IF no match → Show available movements, ask for clarification
- IF match found → Use exact database name in getWorkouts call
</thinking>

## Tool Behavior

**Input**: None required (automatically scoped to team)

**Output**: Array of movement name strings
```typescript
["Pull-ups", "Deadlift", "Box Jump", "Thruster", "Row", "Run"]
```

**Important**:
- Movement names are case-sensitive
- Includes movements from team-owned + public workouts
- May have spelling variations: "Pull-ups" (hyphen), "Back Squat" (two words)
- Order is not guaranteed
- Empty array if no workouts have movements tagged

## Usage Workflow

### Standard Pattern (Movement-Based Query)
```
User: "Show me workouts with pull-ups"

<reasoning>
1. User mentions "pull-ups" - an exercise/movement
2. Don't know exact spelling: Pull-ups? Pullups? pull ups?
3. Must verify before filtering
</reasoning>

Step 1: getMovements()
  → Returns: ["Pull-ups", "Deadlift", "Box Jump", "Thruster"]

Step 2: Match user request
  → "pull-ups" → "Pull-ups" (hyphen, capital P) ✓

Step 3: getWorkouts({ movement: "Pull-ups" })
```

### Discovery Pattern
```
User: "What movements are in our workouts?"

<reasoning>
1. User wants to see available exercises
2. Direct request for movement list
3. Just return the list
</reasoning>

Action: getMovements()
  → Returns: ["Pull-ups", "Deadlift", "Thruster", "Row"]

Response: "Your workouts include these movements: Pull-ups, Deadlift, Thruster, and Row."
```

### Fuzzy Matching Pattern
```
User: "Find workouts with deadlifts"

<reasoning>
1. User says "deadlifts" (plural, lowercase)
2. Database might have "Deadlift" (singular, capitalized)
3. Need exact spelling
</reasoning>

Step 1: getMovements()
  → Returns: [..., "Deadlift", ...]

Step 2: Match case-insensitively
  → "deadlifts" → "Deadlift" ✓

Step 3: getWorkouts({ movement: "Deadlift" })
```

## Error Handling

### Movement Not Found
```
IF user's mentioned movement not in getMovements() results:
  THEN:
    1. Inform: "I don't see '{user_movement}' in our movement list."
    2. Suggest similar: "Did you mean: {similar_movements}?"
    3. Show all: "Available movements: {movement_list}"
    4. Ask: "Which movement would you like to search for?"
    5. DO NOT call getWorkouts with invalid movement
```

### Empty Movement List
```
IF getMovements() returns []:
  THEN:
    1. Inform: "No movements are tagged in workouts yet."
    2. Suggest: "You can browse all workouts or search by name."
    3. DO NOT proceed with movement filtering
```

### Spelling Variations
```
Common variations to check:
- Hyphenation: "Pull-ups" vs "Pullups"
- Capitalization: "Deadlift" vs "deadlift" vs "DEADLIFT"
- Pluralization: "Squat" vs "Squats"
- Spacing: "Box Jump" vs "BoxJump"

Algorithm:
1. Try exact match first
2. Try case-insensitive match
3. Try removing hyphens/spaces
4. Suggest closest matches if no exact match
```

### Multiple Movements Requested
```
User: "Show me workouts with pull-ups and thrusters"

<reasoning>
- User wants workouts containing BOTH movements
- getWorkouts can only filter by ONE movement at a time
- Must clarify limitation
</reasoning>

Response Strategy:
1. Explain: "I can search for one movement at a time."
2. Options:
   a) "Show pull-ups workouts first, then thrusters"
   b) "Use search to find workouts mentioning both"
3. Proceed with user's choice
```

## Integration with getWorkouts

**Correct Flow**:
```typescript
1. movements = getMovements()  // Returns ["Pull-ups", "Deadlift"]
2. userMovement = "pullups"
3. exactMovement = movements.find(m =>
     m.toLowerCase().replace(/[-\s]/g, '') ===
     userMovement.toLowerCase().replace(/[-\s]/g, '')
   )
4. getWorkouts({ movement: exactMovement })  // Use "Pull-ups"
```

**Incorrect Flow** (will fail):
```typescript
1. userMovement = "pullups"
2. getWorkouts({ movement: userMovement })  // ❌ Won't match "Pull-ups"
```

## Caching Strategy

**Within Same Conversation**:
```
First user request: "show me workouts with pull-ups"
  → Call getMovements() once
  → Store results: ["Pull-ups", "Deadlift", "Thruster"]

Second user request: "now show me deadlift workouts"
  → DON'T call getMovements() again
  → Use cached list: "Deadlift" exists
  → Call getWorkouts({ movement: "Deadlift" })

Third user request: "what other movements do we have?"
  → Use cached list
  → Present: "We also have Thruster workouts"
```

## Quality Checklist

Before calling getMovements, verify:
- ✓ User request involves specific exercises/movements
- ✓ Don't already have movement list from earlier in conversation
- ✓ Will use results immediately (not speculative call)
- ✓ Not asking about tags/categories (different tool)

After calling getMovements, verify:
- ✓ Results non-empty OR handle empty case
- ✓ Found exact match for user's request OR show alternatives
- ✓ Handled spelling variations (case, hyphen, plural)
- ✓ Using exact database spelling in subsequent getWorkouts call
- ✓ Cached results for rest of conversation

## Common Movement Naming Patterns

Be aware of these common patterns in movement names:
- **Hyphenated**: Pull-ups, Push-ups, Sit-ups
- **Two Words**: Box Jump, Wall Ball, Double Under
- **Capitalized**: Deadlift, Thruster, Row, Run
- **Equipment-Specific**: Barbell Snatch, Dumbbell Press
- **Variations**: Front Squat vs Back Squat, Power Clean vs Squat Clean

## Examples with Full Reasoning

<example>
User: "What exercises are in our workouts?"

<internal_reasoning>
- Direct question about exercises/movements
- "Exercises" is synonym for movements
- Need full list to answer
</internal_reasoning>

Actions:
1. getMovements() → ["Pull-ups", "Deadlift", "Box Jump", "Thruster", "Row"]
2. Response: "Your workouts include these exercises: Pull-ups, Deadlift, Box Jump, Thruster, and Row."
</example>

<example>
User: "Show me workouts with pullups"

<internal_reasoning>
- "pullups" is a movement (no hyphen, lowercase)
- Database likely has "Pull-ups" (hyphen, capitalized)
- Need exact spelling
</internal_reasoning>

Actions:
1. getMovements() → [..., "Pull-ups", ...]
2. Match "pullups" → "Pull-ups" (fuzzy match)
3. getWorkouts({ movement: "Pull-ups" })
4. Response: "Here are workouts with Pull-ups..."
</example>

<example>
User: "Find workouts with pull-ups and thrusters"

<internal_reasoning>
- User wants workouts with BOTH movements
- getWorkouts only supports ONE movement filter
- Must explain limitation
</internal_reasoning>

Actions:
1. getMovements() → verify both exist
2. Explain: "I can search for one movement at a time. Would you like to see:"
   - "Workouts with Pull-ups"
   - "Workouts with Thrusters"
   - "Or I can search for 'pull-ups thrusters' in workout descriptions?"
3. Wait for user choice, then proceed
</example>

<example>
User: "Show me pull-up workouts"
[Later in conversation]
User: "Now show me deadlift ones"

<internal_reasoning>
First request:
- "pull-up" is a movement
- Need exact spelling
- Call getMovements() → cache results

Second request:
- Already have movements: ["Pull-ups", "Deadlift", "Thruster"]
- "deadlift" → match to "Deadlift"
- DON'T call getMovements again (use cache)
</internal_reasoning>

Actions:
1st: getMovements() → cache ["Pull-ups", "Deadlift", "Thruster"]
1st: getWorkouts({ movement: "Pull-ups" })
2nd: Use cached "Deadlift" (no getMovements call)
2nd: getWorkouts({ movement: "Deadlift" })
</example>

<example>
User: "Do we have any olympic lifting workouts?"

<internal_reasoning>
- "Olympic lifting" is a movement category, not specific movement
- Need to check if movements like "Snatch", "Clean", "Jerk" exist
- Multiple movements involved
</internal_reasoning>

Actions:
1. getMovements() → check for: "Snatch", "Clean", "Clean and Jerk", "Jerk"
2. IF found → "Yes, we have workouts with {movements}. Which would you like to see?"
3. ELSE → "I don't see Olympic lifting movements. Available: {list}"
</example>
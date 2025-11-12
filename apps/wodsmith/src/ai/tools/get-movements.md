Use this tool to retrieve all available workout movements for the team. Movements are specific exercises that appear in workouts (e.g., "Pull-ups", "Deadlift", "Box Jump") and serve as important filters for workout discovery. This tool returns the exact movement names as they exist in the database, which is essential for accurate filtering when using the Get Workouts tool.

The returned movement list includes movements from both team-owned workouts and public workouts accessible to the team.

## When to Use This Tool

Use Get Movements when:

1. The user asks what movements or exercises are available in their workouts
2. You need to verify the exact spelling or existence of a movement before filtering workouts
3. The user wants to find workouts containing a specific exercise but you need to confirm the movement name
4. You're building a filter query for Get Workouts and need to confirm valid movement names
5. The user asks questions like "What exercises do our workouts include?" or "What movements can I filter by?"

## Tool Behavior

- Returns an array of movement name strings (e.g., `["Pull-ups", "Deadlift", "Box Jump", "Thruster"]`)
- Includes movements from all workouts accessible to the team (team-owned + public)
- Movement names are returned as they are stored in the database (case-sensitive)
- No parameters required — automatically scoped to the team context

## Best Practices

- **Always call this tool before filtering by movement** if the user's request doesn't specify an exact movement name
- Use the returned movement names exactly as provided when calling Get Workouts with a movement filter
- Cache movement results in your conversation context to avoid repeated calls
- If a user mentions a movement name that doesn't appear in results, inform them it doesn't exist or suggest alternatives
- Be aware of naming variations (e.g., "Pull-up" vs "Pull-ups", "Box Jump" vs "Box Jumps")

## Examples of When to Use This Tool

<example>
User: What movements are in our workouts?
Assistant: Let me check what movements are available in your workouts.
*Calls Get Movements*
→ Returns: ["Pull-ups", "Deadlift", "Box Jump", "Thruster", "Row", "Run"]
Assistant: Your workouts include these movements: Pull-ups, Deadlift, Box Jump, Thruster, Row, and Run.
</example>

<example>
User: Show me all workouts with pull-ups
Assistant: Let me verify the exact movement name first.
*Calls Get Movements*
→ Confirms "Pull-ups" exists in the movement list (with hyphen and plural)
*Calls Get Workouts with movement: "Pull-ups"*
</example>

<example>
User: Find workouts that include deadlifts
Assistant: Let me check the exact movement name.
*Calls Get Movements*
→ Returns movements including "Deadlift" (singular, capital D)
*Calls Get Workouts with movement: "Deadlift"*
</example>

<example>
User: What workouts have both thrusters and pull-ups?
Assistant: Let me first verify these movement names.
*Calls Get Movements*
→ Confirms "Thruster" and "Pull-ups" exist
Assistant: I can search for workouts with each movement, but note that I can only filter by one movement at a time. Let me find workouts with thrusters first.
*Calls Get Workouts with movement: "Thruster"*
*Then mentions user can also search for Pull-ups workouts separately*
</example>

## When NOT to Use This Tool

Avoid using this tool when:

1. You already have the exact movement name from a previous call in the same conversation
2. The user is asking about workout tags/categories (use Get Tags instead)
3. The user is directly searching for workouts by name and doesn't mention specific movements
4. You're fetching detailed workout information (use Get Workouts instead)

## Common Workflow Pattern

The typical flow when a user asks for movement-based workouts:

1. **User mentions an exercise**: "Show me workouts with deadlifts"
2. **Verify movement exists**: Call Get Movements to confirm "Deadlift" is valid
3. **Note the exact spelling**: Use "Deadlift" (singular, capitalized) not "deadlifts"
4. **Filter workouts**: Call Get Workouts with `movement: "Deadlift"`
5. **Present results**: Display the filtered workouts to the user

If the movement doesn't exist:
1. Show available movements to the user
2. Suggest similar or related movements
3. Ask for clarification

## Integration with Get Workouts

Movement names returned by this tool should be used directly in the Get Workouts `movement` parameter:

```typescript
// Example flow
const movements = await getMovements(); // Returns ["Pull-ups", "Deadlift", "Thruster"]
const pullUpWorkouts = await getWorkouts({ movement: "Pull-ups" }); // Use exact name
```

## Limitations

- The Get Workouts tool can only filter by **one movement at a time**
- If a user wants workouts with multiple movements, you'll need to either:
  - Make multiple separate queries
  - Explain that you can search for one movement and they can manually check for the other
  - Use the search parameter if both movement names might appear in workout descriptions

## Summary

Use Get Movements to discover and verify workout movement names before filtering workouts. This ensures accurate filtering by providing the exact movement spellings as they exist in the database. Always use the returned movement names exactly when passing them to the Get Workouts tool, and be mindful of naming variations (singular vs plural, capitalization).

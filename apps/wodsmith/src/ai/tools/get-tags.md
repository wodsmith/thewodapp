Use this tool to retrieve all available workout tags for the team. Tags are categorical labels applied to workouts (e.g., "Hero", "Benchmark", "Gymnastics") that help organize and filter workout collections. This tool returns the exact tag names as they exist in the database, which is essential for accurate filtering when using the Get Workouts tool.

The returned tag list includes tags from both team-owned workouts and public workouts accessible to the team.

## When to Use This Tool

Use Get Tags when:

1. The user asks what tags are available or what categories of workouts exist
2. You need to verify the exact spelling or existence of a tag before filtering workouts
3. The user wants to browse workouts by category but hasn't specified a tag name
4. You're building a filter query for Get Workouts and need to confirm valid tag names
5. The user asks questions like "What types of workouts do we have?" or "What workout categories exist?"

## Tool Behavior

- Returns an array of tag name strings (e.g., `["Hero", "Benchmark", "Gymnastics", "Strength"]`)
- Includes tags from all workouts accessible to the team (team-owned + public)
- Tags are returned as they are stored in the database (case-sensitive)
- No parameters required — automatically scoped to the team context

## Best Practices

- **Always call this tool before filtering by tag** if the user's request doesn't specify an exact tag name
- Use the returned tag names exactly as provided when calling Get Workouts with a tag filter
- Cache tag results in your conversation context to avoid repeated calls
- If a user mentions a tag name that doesn't appear in results, inform them it doesn't exist

## Examples of When to Use This Tool

<example>
User: What types of workouts do we have?
Assistant: Let me check what workout categories are available.
*Calls Get Tags*
→ Returns: ["Hero", "Benchmark", "Gymnastics", "Strength", "Endurance"]
Assistant: You have workouts in these categories: Hero, Benchmark, Gymnastics, Strength, and Endurance.
</example>

<example>
User: Show me Hero workouts
Assistant: Let me verify the tag name first.
*Calls Get Tags*
→ Confirms "Hero" exists in the tag list
*Calls Get Workouts with tag: "Hero"*
</example>

<example>
User: Find workouts with the benchmark tag
Assistant: Let me check the exact tag name.
*Calls Get Tags*
→ Returns tags including "Benchmark" (note the capital B)
*Calls Get Workouts with tag: "Benchmark"*
</example>

## When NOT to Use This Tool

Avoid using this tool when:

1. You already have the exact tag name from a previous call in the same conversation
2. The user is asking about movements (use Get Movements instead)
3. The user is directly searching for workouts and doesn't mention tags/categories
4. You're fetching detailed workout information (use Get Workouts instead)

## Common Workflow Pattern

The typical flow when a user asks for tagged workouts:

1. **User mentions a category**: "Show me Hero workouts"
2. **Verify tag exists**: Call Get Tags to confirm "Hero" is valid
3. **Filter workouts**: Call Get Workouts with `tag: "Hero"`
4. **Present results**: Display the filtered workouts to the user

If the tag doesn't exist:
1. Show available tags to the user
2. Ask for clarification or suggest similar tags

## Integration with Get Workouts

Tag names returned by this tool should be used directly in the Get Workouts `tag` parameter:

```typescript
// Example flow
const tags = await getTags(); // Returns ["Hero", "Benchmark", "Gymnastics"]
const heroWorkouts = await getWorkouts({ tag: "Hero" }); // Use exact name
```

## Summary

Use Get Tags to discover and verify workout tag names before filtering workouts. This ensures accurate filtering by providing the exact tag spellings as they exist in the database. Always use the returned tag names exactly when passing them to the Get Workouts tool.

Use this tool to retrieve workouts for the team with optional filtering capabilities. This tool returns both team-owned workouts and public workouts that are available to the team. It supports comprehensive filtering by programming track, search terms, tags, movements, and workout type (original vs remixed).

The tool is designed for efficient workout discovery and supports pagination for large result sets. Each workout returned includes full metadata such as tags, movements, scaling information, and remix relationships.

## When to Use This Tool

Use Get Workouts when:

1. The user asks to find or search for workouts
2. The user requests workouts with specific characteristics (e.g., "show me all workouts with pull-ups")
3. The user wants to browse available workouts
4. The user asks about workouts in a specific programming track
5. The user wants to filter by workout type (original workouts vs remixed versions)
6. The user needs to see what workouts are available before performing other operations

## Filtering Capabilities

The tool supports multiple filter parameters that can be combined:

- **trackId**: Filter workouts that belong to a specific programming track
- **search**: Search by workout name or description (case-insensitive)
- **tag**: Filter by an exact tag name (use Get Tags tool first to verify tag names)
- **movement**: Filter by an exact movement name (use Get Movements tool first to verify movement names)
- **type**: Filter by workout type:
  - `"all"` (default): Returns all workouts
  - `"original"`: Only returns workouts that are not remixes
  - `"remix"`: Only returns workouts that are remixes of other workouts
- **limit**: Number of results to return (default: 50, max: positive integer)
- **offset**: Number of results to skip for pagination (default: 0)

## Returned Data Structure

Each workout includes:

- Basic workout information (name, description, scheme, score type, scope)
- Associated tags (array of tag objects)
- Associated movements (array of movement objects)
- Results from today for the current user
- Remix information (source workout details if this is a remix)
- Remix count (number of times this workout has been remixed)

## Best Practices

- Use Get Tags or Get Movements tools first when filtering by tag/movement names to ensure exact name matches
- Start with broader searches (search parameter) before applying specific filters
- Use pagination (limit and offset) when dealing with large result sets
- Combine filters to narrow down results (e.g., search + tag + movement)
- Remember that search is case-insensitive and matches both name and description

## Examples of When to Use This Tool

<example>
User: Show me all workouts with "Fran" in the name
Assistant: I'll search for workouts containing "Fran".
*Calls Get Workouts with search: "Fran"*
</example>

<example>
User: Find workouts that include pull-ups
Assistant: Let me first verify the exact movement name, then search for workouts with that movement.
*Calls Get Movements to find "Pull-ups"*
*Calls Get Workouts with movement: "Pull-ups"*
</example>

<example>
User: What workouts are in the competition track?
Assistant: I'll get the workouts for that programming track.
*Calls Get Workouts with trackId: "track_competition_xyz"*
</example>

<example>
User: Show me the first 10 workouts we have
Assistant: I'll retrieve the first 10 workouts.
*Calls Get Workouts with limit: 10, offset: 0*
</example>

## When NOT to Use This Tool

Avoid using this tool when:

1. You only need to verify available tags (use Get Tags instead)
2. You only need to verify available movements (use Get Movements instead)
3. The user is asking about workout details but already has a specific workout ID (use a different tool for fetching a single workout)
4. The user is asking about team capabilities rather than actual workouts

## Common Patterns

### Progressive Search
1. Start with broad search: `search: "deadlift"`
2. If too many results, add tag filter: `search: "deadlift", tag: "Hero"`
3. If still too many, add type filter: `search: "deadlift", tag: "Hero", type: "original"`

### Pagination
1. First page: `limit: 20, offset: 0`
2. Second page: `limit: 20, offset: 20`
3. Third page: `limit: 20, offset: 40`

### Movement-Based Discovery
1. Verify movement exists: Call Get Movements
2. Find exact name match from results
3. Search workouts: `movement: "Exact Movement Name"`

## Summary

Use Get Workouts to retrieve and filter the team's available workouts. Always verify tag and movement names using their respective tools before filtering by those parameters. Combine multiple filters and use pagination to efficiently discover workouts that match user requirements.

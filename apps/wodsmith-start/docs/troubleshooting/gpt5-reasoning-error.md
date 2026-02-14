# GPT-5 Reasoning Model Error: "Item of type 'reasoning' was provided without its required following item"

## Error Message

```
APICallError: Item 'rs_064c922648716790...' of type 'reasoning' was provided without its required following item.
```

Status code: 400 (Invalid Request Error)

## When This Happens

This error occurs when using GPT-5 models (gpt-5, gpt-5-mini, gpt-5-nano, gpt-5.1, gpt-5.2) with Mastra agents in multi-turn conversations. It typically appears on the **second or subsequent** API call, not the first.

## Root Cause

GPT-5 models are **reasoning models** that return reasoning tokens (similar to o1/o3 models). When Mastra stores conversation history and replays it for follow-up requests:

1. The reasoning items are stored with `providerMetadata.openai.itemId`
2. On follow-up requests, Mastra sends `item_reference` pointers instead of the full content
3. OpenAI's API requires that reasoning items have their corresponding output items following them
4. If the reasoning content isn't properly reconstructed, OpenAI rejects the request

## The Fix

Add `providerOptions` to your agent's `instructions` to disable server-side storage:

```typescript
import { Agent } from "@mastra/core/agent"

export const myAgent = new Agent({
  id: "my-agent",
  name: "My Agent",
  model: () => getOpenAIModel("medium"), // gpt-5-mini

  // Fix for GPT-5 reasoning models
  instructions: {
    role: "system",
    content: `Your agent instructions here...`,
    providerOptions: {
      openai: {
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  },

  tools: { /* ... */ },
})
```

### Why This Works

- `store: false` - Disables OpenAI's server-side storage, preventing the `item_reference` mechanism from being used. Each request sends the full conversation content.
- `include: ["reasoning.encrypted_content"]` - Requests encrypted reasoning content so it can be properly included in follow-up requests.

## Important Notes

### Instructions Must Be an Object

In Mastra 1.0 beta, `providerOptions` must be nested inside the `instructions` object - you cannot set it at the top level of the Agent config:

```typescript
// WRONG - providerOptions at top level doesn't exist
new Agent({
  providerOptions: { /* ... */ }, // TypeScript error!
  instructions: "...",
})

// CORRECT - providerOptions inside instructions object
new Agent({
  instructions: {
    role: "system",
    content: "...",
    providerOptions: { /* ... */ },
  },
})
```

### Apply to All Agents Using GPT-5

If you have multiple agents (router + sub-agents), apply this fix to ALL of them since any agent using a GPT-5 model variant can trigger this error.

### Alternative: Per-Call Configuration

You can also set `providerOptions` per-call if you prefer:

```typescript
const result = await agent.generate("user message", {
  providerOptions: {
    openai: {
      store: false,
      include: ["reasoning.encrypted_content"],
    },
  },
})
```

## Affected Versions

- `@mastra/core`: 1.0.0-beta.x (and 0.24.x)
- `@ai-sdk/openai`: 2.x
- OpenAI models: gpt-5, gpt-5-mini, gpt-5-nano, gpt-5.1, gpt-5.2, o1, o3, o4-mini

## Related Issues

- [mastra-ai/mastra#10981](https://github.com/mastra-ai/mastra/issues/10981) - Main bug report
- [mastra-ai/mastra#10713](https://github.com/mastra-ai/mastra/issues/10713) - Related issue for function calls
- [mastra-ai/mastra#11492](https://github.com/mastra-ai/mastra/pull/11492) - Fix for memory replay
- [mastra-ai/mastra#11380](https://github.com/mastra-ai/mastra/pull/11380) - Fix for providerMetadata leaking

## Additional Fix: Filter Reasoning from Messages

Even with `store: false`, the client may send back messages containing reasoning parts from previous responses. These must be filtered on the server side:

```typescript
// In your chat API route
function filterReasoningFromMessages(messages: unknown[]): unknown[] {
  return messages.map((msg) => {
    if (typeof msg === "object" && msg !== null && "parts" in msg) {
      const typedMsg = msg as { parts?: unknown[] }
      if (Array.isArray(typedMsg.parts)) {
        return {
          ...msg,
          parts: typedMsg.parts.filter((part) => {
            if (typeof part === "object" && part !== null && "type" in part) {
              return (part as { type: string }).type !== "reasoning"
            }
            return true
          }),
        }
      }
    }
    return msg
  })
}

// Use before passing to agent.stream()
const filteredMessages = filterReasoningFromMessages(messages)
const agentStream = await agent.stream(filteredMessages, { ... })
```

## Debugging Tips

1. **Check the request body** - Look for `store: false` and `include: [Array]` in the error logs
2. **Same reasoning ID across requests?** - Means old conversation state is being replayed; refresh the browser
3. **New reasoning IDs each time?** - The filtering isn't working; check your server-side filter

## Future Resolution

Once Mastra releases a version with proper reasoning item reconstruction (expected in stable 1.0), this workaround may no longer be needed. Check the Mastra changelog for updates.

/**
 * @fileoverview Mastra AI agent configuration for WODsmith.
 *
 * This module configures the Mastra agent framework with:
 * - D1 storage for conversation threads and messages
 * - Cloudflare Vectorize for semantic memory recall
 * - OpenAI embeddings for vector generation
 *
 * @see {@link https://mastra.ai/docs Mastra Documentation}
 */

import {createServerOnlyFn} from '@tanstack/react-start'
import {env} from 'cloudflare:workers'

import {Memory} from '@mastra/memory'
import {D1Store} from '@mastra/cloudflare-d1'
import {CloudflareVector} from '@mastra/vectorize'
import {RequestContext} from '@mastra/core/request-context'
import {openai} from '@ai-sdk/openai'
import {getOpenAIModel} from '@/lib/ai'

/**
 * Creates a Memory instance for AI agent conversations.
 *
 * Uses D1 for thread/message storage and Cloudflare Vectorize for semantic recall.
 * This function must be called within a request context to access the D1 binding.
 *
 * Note: D1Store automatically initializes tables before first storage operation.
 *
 * @returns Memory instance configured for Cloudflare Workers
 */
export const createMemory = createServerOnlyFn(() => {
  // Create D1 store using the Worker binding (faster than REST API)
  // D1Store handles table initialization automatically
  const storage = new D1Store({
    id: 'wodsmith-memory',
    binding: env.DB,
    tablePrefix: 'mastra_',
  })

  // Create Vectorize store using REST API
  // Note: Requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_VECTORIZE_API_TOKEN env vars
  const hasVectorConfig =
    env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_VECTORIZE_API_TOKEN

  const vector = hasVectorConfig
    ? new CloudflareVector({
        id: 'ai-memory',
        accountId: env.CLOUDFLARE_ACCOUNT_ID,
        apiToken: env.CLOUDFLARE_VECTORIZE_API_TOKEN,
      })
    : undefined

  return new Memory({
    storage,
    vector,
    // OpenAI embeddings for vector generation
    embedder: env.OPENAI_API_KEY
      ? openai.embedding('text-embedding-3-small')
      : undefined,

    options: {
      // Include last 20 messages from current thread for context
      lastMessages: 20,

      // Auto-generate thread titles from first user message
      generateTitle: {
        model: getOpenAIModel('small'),
        instructions: `Generate a short, descriptive title (max 50 chars) for this competition planning conversation.
Focus on the main topic: competition name, task type (setup, scheduling, etc.), or question being asked.
Do not use quotes or colons. Return only the title text.`,
      },

      // Enable semantic recall across all user's threads
      semanticRecall: hasVectorConfig
        ? {
            topK: 5,
            messageRange: {before: 2, after: 1},
            scope: 'resource', // Search across all user's threads
          }
        : false,

      // Working memory for persistent organizer context
      workingMemory: {
        enabled: true,
        scope: 'resource',
        template: `
# Competition Organizer Profile
- Name:
- Organization:
- Typical competition size:
- Preferred division structure:
- Equipment availability:
- Past competitions created:
`,
      },
    },
  })
})

/**
 * Request context type for multi-tenant AI operations.
 */
interface RequestContextValues {
  'team-id': string
  'user-id': string
  'user-permissions': string[]
  'resource-id': string
}

/**
 * Creates request context for multi-tenant AI operations.
 *
 * This context is passed to agents to scope operations to the correct
 * user and team, respecting permissions.
 *
 * @param session - User session with team context
 * @returns RequestContext for agent execution
 */
export function createRequestContext(session: {
  user: {id: string}
  currentTeam: {id: string; permissions?: string[]}
}): RequestContext<RequestContextValues> {
  return new RequestContext<RequestContextValues>([
    ['team-id', session.currentTeam.id],
    ['user-id', session.user.id],
    ['user-permissions', session.currentTeam.permissions ?? []],
    ['resource-id', session.user.id], // For memory scoping
  ])
}

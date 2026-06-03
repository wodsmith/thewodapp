import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type {
  AuthenticatedMcpSession,
  CompetitionOperationSpec,
} from "../types"
import {
  createCodeExecutor,
  createSearchExecutor,
  toExecutorError,
} from "./executor"
import { stringifyMcpResult, truncateMcpText } from "./truncate"

const SERVER_INFO = {
  name: "wodsmith-competition-code-mode",
  version: "0.1.0",
} as const

const SEARCH_TYPES = `
interface CompetitionOperation {
  id: string;              // Pass this to wodsmith.call(operationId, input)
  exportName: string;      // TanStack server function export
  category: string;        // Functional area, e.g. "events", "schedule", "cohosts"
  categoryTitle: string;
  mode: "read" | "write";
  source: string;          // Source file containing the server function
  description: string;
  input: string;
}

declare const operations: CompetitionOperation[];
declare const categories: string[];
declare const spec: { operations: CompetitionOperation[]; categories: string[] };
declare function findOperations(query: string): CompetitionOperation[];
`

const EXECUTE_TYPES = `
interface CompetitionOperation {
  id: string;
  exportName: string;
  category: string;
  categoryTitle: string;
  mode: "read" | "write";
  source: string;
  description: string;
  input: string;
}

declare const wodsmith: {
  operations: CompetitionOperation[];
  categories: string[];
  findOperations(query: string): CompetitionOperation[];
  call<T = unknown>(operationId: string, input?: unknown): Promise<T>;
};
`

export function createWodsmithMcpServer(
  env: Env,
  ctx: ExecutionContext,
  session: AuthenticatedMcpSession,
  operationSpecs: CompetitionOperationSpec[],
): McpServer {
  const operationCount = operationSpecs.length
  const categoryList = [
    ...new Set(operationSpecs.map((operation) => operation.category)),
  ]

  const server = new McpServer(SERVER_INFO, {
    instructions:
      "Use Code Mode to manage WODsmith competitions. First call search to find operation ids, then call execute with JavaScript that uses wodsmith.call(operationId, input). Every call runs as the authenticated WODsmith user and is still gated by the app's organizer/cohost permissions.",
  })

  const executeSearch = createSearchExecutor(env, operationSpecs)
  const executeCode = createCodeExecutor(
    env,
    ctx,
    session.credential,
    operationSpecs,
  )

  server.registerTool(
    "search",
    {
      title: "Search WODsmith Competition Operations",
      description: `Search the WODsmith competition operation catalog with JavaScript.

The catalog currently exposes ${operationCount} operations across ${categoryList.length} categories:
${categoryList.join(", ")}

Available in your code:
${SEARCH_TYPES}

Your code must be an async arrow function that returns JSON-serializable data.

Examples:

// Find all heat scheduling operations
async () => findOperations("heat schedule").map(({ id, mode, description }) => ({ id, mode, description }))

// List write operations in the sponsors category
async () => operations.filter((operation) => operation.category === "sponsors" && operation.mode === "write")

// Inspect the source file for registration management operations
async () => findOperations("manual registration transfer refund").map(({ id, source, exportName }) => ({ id, source, exportName }))`,
      inputSchema: {
        code: z
          .string()
          .min(1)
          .describe("JavaScript async arrow function to search the catalog"),
      },
    },
    async ({ code }) => {
      try {
        const result = await executeSearch(code)
        return {
          content: [
            {
              type: "text",
              text: truncateMcpText(stringifyMcpResult(result)),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${toExecutorError(error)}` }],
          isError: true,
        }
      }
    },
  )

  server.registerTool(
    "execute",
    {
      title: "Execute WODsmith Competition Code",
      description: `Execute JavaScript against WODsmith competition management operations. Use search first to find operation ids and expected source modules.

Available in your code:
${EXECUTE_TYPES}

Your code must be an async arrow function that returns JSON-serializable data.

Examples:

// Read the core competition setup context
async () => {
  const competition = await wodsmith.call("competitionDetails.getCompetitionById", {
    competitionId: "comp_123"
  });
  const divisions = await wodsmith.call("divisions.getCompetitionDivisionsWithCounts", {
    competitionId: "comp_123",
    teamId: competition.competition.organizingTeamId
  });
  const events = await wodsmith.call("events.getCompetitionWorkouts", {
    competitionId: "comp_123",
    teamId: competition.competition.organizingTeamId
  });
  return { competition, divisions, events };
}

// Create a sponsor group, then list sponsors
async () => {
  await wodsmith.call("sponsors.createSponsorGroup", {
    competitionId: "comp_123",
    name: "Gold Sponsors",
    sortOrder: 0
  });
  return wodsmith.call("sponsors.getCompetitionSponsors", {
    competitionId: "comp_123"
  });
}`,
      inputSchema: {
        code: z
          .string()
          .min(1)
          .describe("JavaScript async arrow function to execute"),
      },
    },
    async ({ code }) => {
      try {
        const result = await executeCode(code)
        return {
          content: [
            {
              type: "text",
              text: truncateMcpText(stringifyMcpResult(result)),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${toExecutorError(error)}` }],
          isError: true,
        }
      }
    },
  )

  return server
}

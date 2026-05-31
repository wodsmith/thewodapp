import type { CompetitionOperationSpec, SessionCredential } from "../types"

interface ExecutorEntrypoint {
  evaluate(): Promise<{ result: unknown; err?: string; stack?: string }>
}

type ExecutionContextWithMcpExports = ExecutionContext & {
  exports?: {
    WodsmithCodeModeOutbound?: (options: {
      props: { credential: SessionCredential }
    }) => Fetcher
  }
}

const COMPATIBILITY_DATE = "2025-12-17"
const INTERNAL_OPERATION_URL = "https://wodsmith-mcp.internal/operation"

function getLoader(env: Env): WorkerLoader {
  const loader = env.MCP_CODE_LOADER
  if (!loader) {
    throw new Error("MCP_CODE_LOADER binding is not configured")
  }
  return loader
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const findOperationsSource = `
function findOperations(query) {
  const terms = String(query || "").toLowerCase().split(/\\s+/).filter(Boolean);
  if (terms.length === 0) return operations;

  return operations.filter((operation) => {
    const haystack = [
      operation.id,
      operation.exportName,
      operation.category,
      operation.categoryTitle,
      operation.mode,
      operation.description,
      operation.source,
    ].join(" ").toLowerCase();

    return terms.every((term) => haystack.includes(term));
  });
}
`

export function createSearchExecutor(
  env: Env,
  operationSpecs: CompetitionOperationSpec[],
) {
  return async (code: string): Promise<unknown> => {
    const loader = getLoader(env)
    const workerId = `wodsmith-mcp-search-${crypto.randomUUID()}`
    const operationSpecJson = JSON.stringify(operationSpecs)

    const worker = loader.get(workerId, () => ({
      compatibilityDate: COMPATIBILITY_DATE,
      globalOutbound: null,
      mainModule: "worker.js",
      modules: {
        "worker.js": `
import { WorkerEntrypoint } from "cloudflare:workers";

const operations = ${operationSpecJson};
const categories = [...new Set(operations.map((operation) => operation.category))];
const spec = { operations, categories };

${findOperationsSource}

export default class SearchExecutor extends WorkerEntrypoint {
  async evaluate() {
    try {
      const result = await (${code})();
      return { result, err: undefined };
    } catch (err) {
      return {
        result: undefined,
        err: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      };
    }
  }
}
        `,
      },
    }))

    const entrypoint = worker.getEntrypoint() as unknown as ExecutorEntrypoint
    const response = await entrypoint.evaluate()

    if (response.err) {
      throw new Error(response.err)
    }

    return response.result
  }
}

export function createCodeExecutor(
  env: Env,
  ctx: ExecutionContext,
  credential: SessionCredential,
  operationSpecs: CompetitionOperationSpec[],
) {
  return async (code: string): Promise<unknown> => {
    const loader = getLoader(env)
    const workerId = `wodsmith-mcp-code-${crypto.randomUUID()}`
    const operationSpecJson = JSON.stringify(operationSpecs)
    const outbound = (
      ctx as ExecutionContextWithMcpExports
    ).exports?.WodsmithCodeModeOutbound?.({ props: { credential } })

    if (!outbound) {
      throw new Error("WodsmithCodeModeOutbound export is not available")
    }

    const worker = loader.get(workerId, () => ({
      compatibilityDate: COMPATIBILITY_DATE,
      globalOutbound: outbound,
      mainModule: "worker.js",
      modules: {
        "worker.js": `
import { WorkerEntrypoint } from "cloudflare:workers";

const operations = ${operationSpecJson};
const categories = [...new Set(operations.map((operation) => operation.category))];
const operationIds = new Set(operations.map((operation) => operation.id));

${findOperationsSource}

async function call(operation, input = {}) {
  if (!operationIds.has(operation)) {
    throw new Error("Unknown WODsmith operation: " + operation);
  }

  const response = await fetch(${JSON.stringify(INTERNAL_OPERATION_URL)}, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation, input }),
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: text };
  }

  if (!response.ok) {
    throw new Error(payload.error || "WODsmith operation failed with status " + response.status);
  }

  return payload.result;
}

const wodsmith = {
  call,
  operations,
  categories,
  findOperations,
};

export default class CodeExecutor extends WorkerEntrypoint {
  async evaluate() {
    try {
      const result = await (${code})();
      return { result, err: undefined };
    } catch (err) {
      return {
        result: undefined,
        err: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      };
    }
  }
}
        `,
      },
    }))

    const entrypoint = worker.getEntrypoint() as unknown as ExecutorEntrypoint
    const response = await entrypoint.evaluate()

    if (response.err) {
      throw new Error(response.err)
    }

    return response.result
  }
}

export function toExecutorError(error: unknown): string {
  return formatError(error)
}

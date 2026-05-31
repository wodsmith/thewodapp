import alchemy from "alchemy"
import {
  KVNamespace,
  Worker,
  WorkerLoader,
  WorkerRef,
} from "alchemy/cloudflare"
import { CloudflareStateStore } from "alchemy/state"
import type { WodsmithOperationsService } from "./src/types"

const stage = process.env.STAGE ?? "dev"

const app = await alchemy("wodsmith-code-mode-mcp", {
  stage,
  phase: process.argv.includes("--destroy") ? "destroy" : "up",
  stateStore: process.env.CI
    ? (scope) => new CloudflareStateStore(scope)
    : undefined,
})

const kvSession = await KVNamespace("wodsmith-sessions", {
  title: `wodsmith-wodsmith-sessions-${stage}`,
  adopt: true,
  delete: false,
})

function getWodsmithServiceName(currentStage: string): string {
  return process.env.WODSMITH_APP_WORKER ?? `wodsmith-app-${currentStage}`
}

function getDomains(currentStage: string): string[] | undefined {
  if (currentStage === "prod") return ["mcp.wodsmith.com"]
  if (currentStage === "demo") return ["mcp.demo.wodsmith.com"]
  return undefined
}

const worker = await Worker("app", {
  name: `wodsmith-code-mode-mcp-${stage}`,
  entrypoint: "./src/index.ts",
  compatibilityDate: "2025-12-17",
  compatibilityFlags: ["nodejs_compat"],
  bindings: {
    KV_SESSION: kvSession,
    MCP_CODE_LOADER: WorkerLoader(),
    WODSMITH_APP: Worker.experimentalEntrypoint<WodsmithOperationsService>(
      WorkerRef({ service: getWodsmithServiceName(stage) }),
      "WodsmithMcpOperations",
    ),
  },
  domains: getDomains(stage),
  adopt: true,
})

export type Env = typeof worker.Env
export default worker

await app.finalize()

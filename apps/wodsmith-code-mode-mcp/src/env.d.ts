import type { WodsmithOperationsService } from "./types"

declare global {
  interface Env {
    KV_SESSION: KVNamespace
    MCP_CODE_LOADER: WorkerLoader
    WODSMITH_APP: Service<WodsmithOperationsService>
  }
}

export {}

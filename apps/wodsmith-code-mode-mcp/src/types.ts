export type SessionCredential =
  | {
      kind: "bearer"
      authorization: string
    }
  | {
      kind: "cookie"
      cookie: string
    }

export interface KVSession {
  id: string
  userId: string
  expiresAt: number
  createdAt: number
  user?: {
    id: string
    email?: string
    firstName?: string | null
    lastName?: string | null
    role?: string
  }
  teams?: Array<{
    id: string
    name: string
    slug: string
    permissions: string[]
  }>
  authenticationType?: "passkey" | "password" | "google-oauth"
  version?: number
}

export interface AuthenticatedMcpSession {
  userId: string
  sessionId: string
  session: KVSession
  credential: SessionCredential
}

export type CompetitionOperationMode = "read" | "write"

export interface CompetitionOperationSpec {
  id: string
  exportName: string
  category: string
  categoryTitle: string
  mode: CompetitionOperationMode
  source: string
  description: string
  input: string
}

export interface WodsmithOperationsService extends Rpc.WorkerEntrypointBranded {
  listCompetitionOperationSpecs(): Promise<CompetitionOperationSpec[]>
  callCompetitionOperation(request: {
    credential: SessionCredential
    operation: string
    input: unknown
  }): Promise<unknown>
}

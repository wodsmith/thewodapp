/**
 * PlanetScale (MySQL) storage adapter for Mastra.
 *
 * Replaces @mastra/cloudflare-d1 D1Store. Works in both
 * Cloudflare Workers and Node.js (mastra dev).
 */

import { MastraStorage, ScoresStorage, WorkflowsStorage } from "@mastra/core/storage"
import type {
	ListScoresResponse,
	SaveScorePayload,
	ScoreRowData,
	ScoringSource,
} from "@mastra/core/evals"
import type {
	StoragePagination,
	WorkflowRun,
	WorkflowRuns,
	StorageListWorkflowRunsInput,
	UpdateWorkflowStateOptions,
} from "@mastra/core/storage"
import type { StepResult, WorkflowRunState } from "@mastra/core/workflows"

import { MemoryStorageMySQL } from "./memory-storage"

/**
 * Minimal ScoresStorage stub. Not used by AI agents.
 */
class ScoresStorageStub extends ScoresStorage {
	async init() {}
	async getScoreById(_: { id: string }): Promise<ScoreRowData | null> {
		return null
	}
	async saveScore(_score: SaveScorePayload): Promise<{ score: ScoreRowData }> {
		throw new Error("ScoresStorage not implemented for PlanetScale")
	}
	async listScoresByScorerId(_: {
		scorerId: string
		pagination: StoragePagination
		entityId?: string
		entityType?: string
		source?: ScoringSource
	}): Promise<ListScoresResponse> {
		return { pagination: { total: 0, page: 0, perPage: 100, hasMore: false }, scores: [] }
	}
	async listScoresByRunId(_: {
		runId: string
		pagination: StoragePagination
	}): Promise<ListScoresResponse> {
		return { pagination: { total: 0, page: 0, perPage: 100, hasMore: false }, scores: [] }
	}
	async listScoresByEntityId(_: {
		entityId: string
		entityType: string
		pagination: StoragePagination
	}): Promise<ListScoresResponse> {
		return { pagination: { total: 0, page: 0, perPage: 100, hasMore: false }, scores: [] }
	}
}

/**
 * Minimal WorkflowsStorage stub. Not used by AI agents.
 */
class WorkflowsStorageStub extends WorkflowsStorage {
	async init() {}
	async dangerouslyClearAll() {}
	async updateWorkflowResults(_: {
		workflowName: string
		runId: string
		stepId: string
		result: StepResult<any, any, any, any>
		requestContext: Record<string, any>
	}): Promise<Record<string, StepResult<any, any, any, any>>> {
		throw new Error("WorkflowsStorage not implemented for PlanetScale")
	}
	async updateWorkflowState(_: {
		workflowName: string
		runId: string
		opts: UpdateWorkflowStateOptions
	}): Promise<WorkflowRunState | undefined> {
		throw new Error("WorkflowsStorage not implemented for PlanetScale")
	}
	async persistWorkflowSnapshot(_: {
		workflowName: string
		runId: string
		resourceId?: string
		snapshot: WorkflowRunState
		createdAt?: Date
		updatedAt?: Date
	}): Promise<void> {
		throw new Error("WorkflowsStorage not implemented for PlanetScale")
	}
	async loadWorkflowSnapshot(_: {
		workflowName: string
		runId: string
	}): Promise<WorkflowRunState | null> {
		return null
	}
	async listWorkflowRuns(_args?: StorageListWorkflowRunsInput): Promise<WorkflowRuns> {
		return { runs: [], total: 0 }
	}
	async getWorkflowRunById(_: {
		runId: string
		workflowName?: string
	}): Promise<WorkflowRun | null> {
		return null
	}
	async deleteWorkflowRunById(_: {
		runId: string
		workflowName: string
	}): Promise<void> {}
}

interface PlanetScaleStoreConfig {
	id: string
	url: string
	tablePrefix?: string
	disableInit?: boolean
}

export class PlanetScaleStore extends MastraStorage {
	stores: {
		scores: ScoresStorage
		workflows: WorkflowsStorage
		memory: MemoryStorageMySQL
	}

	constructor(config: PlanetScaleStoreConfig) {
		super({ id: config.id, name: "PlanetScale", disableInit: config.disableInit })

		if (config.tablePrefix && !/^[a-zA-Z0-9_]*$/.test(config.tablePrefix)) {
			throw new Error("Invalid tablePrefix: only letters, numbers, and underscores are allowed.")
		}

		const memoryConfig = {
			url: config.url,
			tablePrefix: config.tablePrefix,
		}

		this.stores = {
			scores: new ScoresStorageStub(),
			workflows: new WorkflowsStorageStub(),
			memory: new MemoryStorageMySQL(memoryConfig),
		}
	}

	async close() {
		// No explicit cleanup needed for PlanetScale HTTP connections
	}
}

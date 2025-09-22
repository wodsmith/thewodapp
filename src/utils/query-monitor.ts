import "server-only"

// Query monitoring configuration
const SLOW_QUERY_THRESHOLD = 100 // 100ms
const MONITORING_ENABLED = true

interface QueryMetrics {
	query: string
	duration: number
	timestamp: number
	context?: string
	params?: Record<string, any>
}

// In-memory storage for query metrics (could be replaced with external monitoring)
const recentQueries: QueryMetrics[] = []
const slowQueries: QueryMetrics[] = []
const MAX_STORED_QUERIES = 1000

/**
 * Monitor a database query execution time
 */
export async function monitorQuery<T>(
	queryName: string,
	queryFn: () => Promise<T>,
	context?: string,
	params?: Record<string, any>,
): Promise<T> {
	if (!MONITORING_ENABLED) {
		return await queryFn()
	}

	const startTime = performance.now()
	const timestamp = Date.now()

	try {
		const result = await queryFn()
		const duration = performance.now() - startTime

		const metrics: QueryMetrics = {
			query: queryName,
			duration,
			timestamp,
			context,
			params,
		}

		// Store recent queries (with rotation)
		recentQueries.push(metrics)
		if (recentQueries.length > MAX_STORED_QUERIES) {
			recentQueries.shift()
		}

		// Track slow queries
		if (duration > SLOW_QUERY_THRESHOLD) {
			slowQueries.push(metrics)
			if (slowQueries.length > MAX_STORED_QUERIES) {
				slowQueries.shift()
			}

			// Log slow queries in development
			if (process.env.NODE_ENV === "development") {
				console.warn(
					`🐌 Slow query detected: ${queryName} took ${duration.toFixed(2)}ms`,
					{ context, params },
				)
			}

			// In production, you might want to send to external monitoring
			if (process.env.NODE_ENV === "production") {
				// TODO: Send to monitoring service (e.g., Cloudflare Analytics, Sentry)
				console.warn(`Slow query: ${queryName} - ${duration.toFixed(2)}ms`)
			}
		}

		return result
	} catch (error) {
		const duration = performance.now() - startTime

		// Log failed queries
		console.error(
			`❌ Query failed: ${queryName} after ${duration.toFixed(2)}ms`,
			{ error, context, params },
		)

		throw error
	}
}

/**
 * Get query performance statistics
 */
export function getQueryStats() {
	const now = Date.now()
	const lastHour = now - 60 * 60 * 1000

	const recentQueriesLastHour = recentQueries.filter(
		(q) => q.timestamp > lastHour,
	)
	const slowQueriesLastHour = slowQueries.filter((q) => q.timestamp > lastHour)

	const avgDuration =
		recentQueriesLastHour.length > 0
			? recentQueriesLastHour.reduce((sum, q) => sum + q.duration, 0) /
				recentQueriesLastHour.length
			: 0

	const maxDuration =
		recentQueriesLastHour.length > 0
			? Math.max(...recentQueriesLastHour.map((q) => q.duration))
			: 0

	return {
		totalQueries: recentQueriesLastHour.length,
		slowQueries: slowQueriesLastHour.length,
		avgDuration: Math.round(avgDuration * 100) / 100,
		maxDuration: Math.round(maxDuration * 100) / 100,
		slowQueryThreshold: SLOW_QUERY_THRESHOLD,
		recentSlowQueries: slowQueriesLastHour.slice(-10).map((q) => ({
			query: q.query,
			duration: Math.round(q.duration * 100) / 100,
			context: q.context,
		})),
	}
}

/**
 * Get all slow queries for analysis
 */
export function getSlowQueries(limit = 50) {
	return slowQueries
		.slice(-limit)
		.map((q) => ({
			query: q.query,
			duration: Math.round(q.duration * 100) / 100,
			timestamp: new Date(q.timestamp).toISOString(),
			context: q.context,
			params: q.params,
		}))
		.reverse() // Most recent first
}

/**
 * Clear query monitoring data
 */
export function clearQueryMetrics() {
	recentQueries.length = 0
	slowQueries.length = 0
}

/**
 * Scaling-specific query monitoring helpers
 */
export const ScalingQueryMonitor = {
	async monitorScalingGroupFetch(scalingGroupId: string, queryFn: () => any) {
		return monitorQuery("scaling-group-fetch", queryFn, "scaling-groups", {
			scalingGroupId,
		})
	},

	async monitorScalingResolution(
		workoutId: string,
		teamId: string,
		trackId: string | undefined,
		queryFn: () => any,
	) {
		return monitorQuery("scaling-resolution", queryFn, "scaling-resolution", {
			workoutId,
			teamId,
			trackId,
		})
	},

	async monitorLeaderboardQuery(
		workoutId: string,
		scalingLevelId: string,
		queryFn: () => any,
	) {
		return monitorQuery("leaderboard-query", queryFn, "leaderboards", {
			workoutId,
			scalingLevelId,
		})
	},

	async monitorResultsQuery(
		workoutId: string,
		resultCount: number,
		queryFn: () => any,
	) {
		return monitorQuery("results-query", queryFn, "results", {
			workoutId,
			resultCount,
		})
	},
}

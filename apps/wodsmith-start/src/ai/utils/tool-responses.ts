/**
 * @fileoverview Structured response types and utilities for AI tools.
 *
 * Following MCP best practices:
 * - Errors are prompts (tell the agent what to do next)
 * - Include suggestions and next actions
 * - Provide contextual examples and alternatives
 */

/**
 * Error codes for structured error handling
 */
export const ErrorCode = {
	// Access & Authentication
	NO_TEAM_CONTEXT: "NO_TEAM_CONTEXT",
	ACCESS_DENIED: "ACCESS_DENIED",
	COMPETITION_NOT_FOUND: "COMPETITION_NOT_FOUND",
	RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",

	// Validation
	INVALID_DATE_FORMAT: "INVALID_DATE_FORMAT",
	INVALID_INPUT: "INVALID_INPUT",
	VALIDATION_FAILED: "VALIDATION_FAILED",
	SLUG_CONFLICT: "SLUG_CONFLICT",

	// Business Logic
	COMPETITION_NOT_READY: "COMPETITION_NOT_READY",
	INSUFFICIENT_DATA: "INSUFFICIENT_DATA",
	OPERATION_FAILED: "OPERATION_FAILED",
	DEPENDENCY_MISSING: "DEPENDENCY_MISSING",
} as const

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode]

/**
 * Structured error response that guides the agent on what to do next
 */
export interface ToolError {
	error: ErrorCodeType
	message: string
	suggestion: string
	nextActions?: string[]
	context?: Record<string, unknown>
	example?: string | Record<string, unknown>
}

/**
 * Success response with optional guidance for next steps
 */
export interface ToolSuccess<T = Record<string, unknown>> {
	success: true
	data?: T
	message?: string
	nextActions?: string[]
}

/**
 * Union type for all tool responses
 */
export type ToolResponse<T = Record<string, unknown>> = ToolSuccess<T> | ToolError

/**
 * Type guard to check if response is an error
 */
export function isToolError(response: ToolResponse): response is ToolError {
	return "error" in response
}

/**
 * Helper to create structured error responses
 */
export function createToolError(params: {
	error: ErrorCodeType
	message: string
	suggestion: string
	nextActions?: string[]
	context?: Record<string, unknown>
	example?: string | Record<string, unknown>
}): ToolError {
	return {
		error: params.error,
		message: params.message,
		suggestion: params.suggestion,
		nextActions: params.nextActions,
		context: params.context,
		example: params.example,
	}
}

/**
 * Helper to create success responses
 */
export function createToolSuccess<T = Record<string, unknown>>(params: {
	data?: T
	message?: string
	nextActions?: string[]
}): ToolSuccess<T> {
	return {
		success: true,
		...params,
	}
}

/**
 * Common error responses for reuse
 */
export const CommonErrors = {
	noTeamContext: (): ToolError =>
		createToolError({
			error: ErrorCode.NO_TEAM_CONTEXT,
			message: "This operation requires a team context.",
			suggestion:
				"Use the listCompetitions tool to see available teams, or ask the user which team to work with.",
			nextActions: ["listCompetitions", "askUserForTeam"],
		}),

	competitionNotFound: (competitionId: string, teamId?: string): ToolError =>
		createToolError({
			error: ErrorCode.COMPETITION_NOT_FOUND,
			message: `Competition '${competitionId}' does not exist.`,
			suggestion:
				"Use listCompetitions() to see available competitions, or check if the competition ID is correct.",
			nextActions: ["listCompetitions"],
			context: { competitionId, teamId },
		}),

	accessDenied: (
		competitionId: string,
		teamId: string,
		competitionTeamId: string,
	): ToolError =>
		createToolError({
			error: ErrorCode.ACCESS_DENIED,
			message: `Competition '${competitionId}' belongs to team '${competitionTeamId}'.`,
			suggestion: `You are working with team '${teamId}'. Switch to the organizing team or request access from the competition organizer.`,
			nextActions: ["switchTeam", "requestAccess"],
			context: { competitionId, teamId, competitionTeamId },
		}),

	invalidDateFormat: (dateValue: string, fieldName = "date"): ToolError => {
		const today = new Date().toISOString().split("T")[0]
		return createToolError({
			error: ErrorCode.INVALID_DATE_FORMAT,
			message: `${fieldName} '${dateValue}' is not a valid ISO 8601 date.`,
			suggestion: `Use format YYYY-MM-DD. Today is ${today}. Did you mean to use today's date?`,
			nextActions: ["retryWithCorrectFormat", "useTodayDate"],
			context: { dateValue, fieldName, today },
			example: "2026-05-15",
		})
	},

	slugConflict: (slug: string, suggestions: string[]): ToolError =>
		createToolError({
			error: ErrorCode.SLUG_CONFLICT,
			message: `Competition slug '${slug}' is already taken.`,
			suggestion: "Try adding a year or location to make it unique.",
			nextActions: ["retryWithDifferentSlug", "autoGenerateSlug"],
			context: { conflictingSlug: slug, suggestions },
		}),

	validationFailed: (issues: Array<{ message: string; suggestion?: string }>) =>
		createToolError({
			error: ErrorCode.VALIDATION_FAILED,
			message: "Validation failed with errors.",
			suggestion:
				issues[0]?.suggestion || "Fix the validation errors and try again.",
			nextActions: ["fixValidationErrors", "getValidationDetails"],
			context: { issues },
		}),

	dependencyMissing: (
		resource: string,
		dependency: string,
		howToCreate: string,
	): ToolError =>
		createToolError({
			error: ErrorCode.DEPENDENCY_MISSING,
			message: `Cannot create ${resource} - ${dependency} is required but missing.`,
			suggestion: `Create the ${dependency} first. ${howToCreate}`,
			nextActions: [`create${dependency}`, "checkSetup"],
			context: { resource, dependency },
		}),
}

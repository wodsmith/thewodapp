import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { createTeamRole, deleteTeamRole, getTeamRoles, updateTeamRole } from "@/server/team-roles"

// Create role schema
const createRoleSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	name: z.string().min(1, "Name is required").max(255, "Name is too long"),
	description: z.string().max(1000, "Description is too long").optional(),
	permissions: z
		.array(z.string())
		.min(1, "At least one permission is required"),
	metadata: z.record(z.unknown()).optional(),
})

// Update role schema
const updateRoleSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	roleId: z.string().min(1, "Role ID is required"),
	data: z.object({
		name: z
			.string()
			.min(1, "Name is required")
			.max(255, "Name is too long")
			.optional(),
		description: z.string().max(1000, "Description is too long").optional(),
		permissions: z
			.array(z.string())
			.min(1, "At least one permission is required")
			.optional(),
		metadata: z.record(z.unknown()).optional(),
	}),
})

const teamIdSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

const deleteRoleSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	roleId: z.string().min(1, "Role ID is required"),
})

/**
 * Get all roles for a team
 */
export const getTeamRolesFn = createServerFn({ method: "POST" })
	.validator(teamIdSchema)
	.handler(async ({ data: input }) => {
		try {
			const roles = await getTeamRoles(input.teamId)
			return { success: true, data: roles }
		} catch (error) {
			console.error("Failed to get team roles:", error)
			throw error
		}
	})

/**
 * Create a new role for a team
 */
export const createRoleFn = createServerFn({ method: "POST" })
	.validator(createRoleSchema)
	.handler(async ({ data: input }) => {
		try {
			const result = await createTeamRole(input)
			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to create role:", error)
			throw error
		}
	})

/**
 * Update an existing team role
 */
export const updateRoleFn = createServerFn({ method: "POST" })
	.validator(updateRoleSchema)
	.handler(async ({ data: input }) => {
		try {
			const result = await updateTeamRole(input)
			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to update role:", error)
			throw error
		}
	})

/**
 * Delete a team role
 */
export const deleteRoleFn = createServerFn({ method: "POST" })
	.validator(deleteRoleSchema)
	.handler(async ({ data: input }) => {
		try {
			await deleteTeamRole(input)
			return { success: true }
		} catch (error) {
			console.error("Failed to delete role:", error)
			throw error
		}
	})

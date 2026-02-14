import type { Client } from "@planetscale/database"
import { batchInsert, currentTimestamp } from "../helpers"

export async function seed(client: Client): Promise<void> {
	console.log("Seeding billing (entitlement types, features, limits, plans)...")

	const ts = currentTimestamp()

	// Entitlement types
	await batchInsert(client, "entitlement_types", [
		{
			id: "etype_programming_track",
			name: "programming_track_access",
			description:
				"Access to individual programming tracks via purchase",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "etype_ai_messages",
			name: "ai_message_credits",
			description:
				"AI message credits for workout generation and suggestions",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "etype_feature_trial",
			name: "feature_trial",
			description:
				"Time-limited trial access to premium features",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "etype_manual_grant",
			name: "manual_feature_grant",
			description: "Manual feature grants by administrators",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "etype_subscription_seat",
			name: "subscription_seat",
			description: "Subscription seat tracking for team plans",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "etype_addon_access",
			name: "addon_access",
			description: "Access via purchased add-ons",
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// Features
	await batchInsert(client, "features", [
		{
			id: "feat_basic_workouts",
			key: "basic_workouts",
			name: "Basic Workouts",
			description: "Create and manage basic workout templates",
			category: "workouts",
			is_active: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "feat_programming_tracks",
			key: "programming_tracks",
			name: "Programming Tracks",
			description: "Create and manage unlimited programming tracks",
			category: "programming",
			is_active: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "feat_program_calendar",
			key: "program_calendar",
			name: "Program Calendar",
			description: "Visual calendar for programming schedules",
			category: "programming",
			is_active: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "feat_program_analytics",
			key: "program_analytics",
			name: "Program Analytics",
			description:
				"Advanced analytics for programming effectiveness",
			category: "programming",
			is_active: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "feat_custom_scaling_groups",
			key: "custom_scaling_groups",
			name: "Custom Scaling Groups",
			description: "Create custom scaling groups for your gym",
			category: "scaling",
			is_active: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "feat_ai_workout_generation",
			key: "ai_workout_generation",
			name: "AI Workout Generation",
			description: "Generate workouts using AI",
			category: "ai",
			is_active: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "feat_ai_programming_assistant",
			key: "ai_programming_assistant",
			name: "AI Programming Assistant",
			description: "AI assistant for programming strategy",
			category: "ai",
			is_active: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "feat_multi_team_management",
			key: "multi_team_management",
			name: "Multi-Team Management",
			description: "Manage multiple teams from one account",
			category: "team",
			is_active: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "feat_host_competitions",
			key: "host_competitions",
			name: "Host Competitions",
			description: "Create and manage competitions and events",
			category: "team",
			is_active: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "feat_workout_tracking",
			key: "workout_tracking",
			name: "Workout Tracking",
			description: "Access to personal workout tracking features",
			category: "workouts",
			is_active: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// Limits
	await batchInsert(client, "limits", [
		{
			id: "lmt_max_members_per_team",
			key: "max_members_per_team",
			name: "Team Members",
			description: "Maximum members per team",
			unit: "members",
			reset_period: "never",
			is_active: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "lmt_max_admins",
			key: "max_admins",
			name: "Admins",
			description: "Number of admin users per team",
			unit: "admins",
			reset_period: "never",
			is_active: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "lmt_max_programming_tracks",
			key: "max_programming_tracks",
			name: "Programming Tracks",
			description: "Number of programming tracks per team",
			unit: "tracks",
			reset_period: "never",
			is_active: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "lmt_ai_messages_per_month",
			key: "ai_messages_per_month",
			name: "AI Messages",
			description: "AI-powered messages per month",
			unit: "messages",
			reset_period: "monthly",
			is_active: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "lmt_max_published_competitions",
			key: "max_published_competitions",
			name: "Published Competitions",
			description:
				"Maximum public competitions (0: pending approval, -1: unlimited)",
			unit: "competitions",
			reset_period: "never",
			is_active: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// Plans
	await batchInsert(client, "plans", [
		{
			id: "free",
			name: "Free",
			description:
				"Perfect for getting started with basic workout management",
			price: 0,
			interval: null,
			is_active: 1,
			is_public: 1,
			sort_order: 0,
			entitlements: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "pro",
			name: "Pro",
			description: "Advanced features for growing gyms and coaches",
			price: 2900,
			interval: "month",
			is_active: 1,
			is_public: 1,
			sort_order: 1,
			entitlements: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "enterprise",
			name: "Enterprise",
			description: "Everything you need for large organizations",
			price: 9900,
			interval: "month",
			is_active: 1,
			is_public: 1,
			sort_order: 2,
			entitlements: null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	// Plan features
	await batchInsert(client, "plan_features", [
		// Free plan
		{ id: "pf_free_basic_workouts", plan_id: "free", feature_id: "feat_basic_workouts", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "pf_free_programming_tracks", plan_id: "free", feature_id: "feat_programming_tracks", created_at: ts, updated_at: ts, update_counter: 0 },
		// Pro plan
		{ id: "pf_pro_basic_workouts", plan_id: "pro", feature_id: "feat_basic_workouts", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "pf_pro_programming_tracks", plan_id: "pro", feature_id: "feat_programming_tracks", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "pf_pro_program_calendar", plan_id: "pro", feature_id: "feat_program_calendar", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "pf_pro_custom_scaling_groups", plan_id: "pro", feature_id: "feat_custom_scaling_groups", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "pf_pro_ai_workout_generation", plan_id: "pro", feature_id: "feat_ai_workout_generation", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "pf_pro_multi_team_management", plan_id: "pro", feature_id: "feat_multi_team_management", created_at: ts, updated_at: ts, update_counter: 0 },
		// Enterprise plan
		{ id: "pf_ent_basic_workouts", plan_id: "enterprise", feature_id: "feat_basic_workouts", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "pf_ent_programming_tracks", plan_id: "enterprise", feature_id: "feat_programming_tracks", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "pf_ent_program_calendar", plan_id: "enterprise", feature_id: "feat_program_calendar", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "pf_ent_program_analytics", plan_id: "enterprise", feature_id: "feat_program_analytics", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "pf_ent_custom_scaling_groups", plan_id: "enterprise", feature_id: "feat_custom_scaling_groups", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "pf_ent_ai_workout_generation", plan_id: "enterprise", feature_id: "feat_ai_workout_generation", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "pf_ent_ai_programming_assistant", plan_id: "enterprise", feature_id: "feat_ai_programming_assistant", created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "pf_ent_multi_team_management", plan_id: "enterprise", feature_id: "feat_multi_team_management", created_at: ts, updated_at: ts, update_counter: 0 },
	])

	// Plan limits
	await batchInsert(client, "plan_limits", [
		// Free
		{ id: "pl_free_max_members", plan_id: "free", limit_id: "lmt_max_members_per_team", value: 5, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "pl_free_max_tracks", plan_id: "free", limit_id: "lmt_max_programming_tracks", value: 2, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "pl_free_ai_messages", plan_id: "free", limit_id: "lmt_ai_messages_per_month", value: 10, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "pl_free_max_admins", plan_id: "free", limit_id: "lmt_max_admins", value: 2, created_at: ts, updated_at: ts, update_counter: 0 },
		// Pro
		{ id: "pl_pro_max_members", plan_id: "pro", limit_id: "lmt_max_members_per_team", value: 25, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "pl_pro_max_tracks", plan_id: "pro", limit_id: "lmt_max_programming_tracks", value: -1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "pl_pro_ai_messages", plan_id: "pro", limit_id: "lmt_ai_messages_per_month", value: 200, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "pl_pro_max_admins", plan_id: "pro", limit_id: "lmt_max_admins", value: 5, created_at: ts, updated_at: ts, update_counter: 0 },
		// Enterprise
		{ id: "pl_ent_max_members", plan_id: "enterprise", limit_id: "lmt_max_members_per_team", value: -1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "pl_ent_max_tracks", plan_id: "enterprise", limit_id: "lmt_max_programming_tracks", value: -1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "pl_ent_ai_messages", plan_id: "enterprise", limit_id: "lmt_ai_messages_per_month", value: -1, created_at: ts, updated_at: ts, update_counter: 0 },
		{ id: "pl_ent_max_admins", plan_id: "enterprise", limit_id: "lmt_max_admins", value: -1, created_at: ts, updated_at: ts, update_counter: 0 },
	])
}

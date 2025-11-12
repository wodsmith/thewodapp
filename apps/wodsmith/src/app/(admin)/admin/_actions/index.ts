/**
 * Client-safe exports of admin actions
 * Re-exports actions without the "server-only" import to avoid server/client boundary issues
 */

export {
	getAllTeamsWithPlansAction,
	updateTeamPlanAction,
	addEntitlementOverrideAction,
	removeEntitlementOverrideAction,
	getTeamOverridesAction,
	getAllPlansAction,
	getTeamEntitlementSnapshotAction,
	getAllFeaturesAction,
	createFeatureAction,
	updateFeatureAction,
	getAllLimitsAction,
	createLimitAction,
	updateLimitAction,
} from "./entitlement-admin-actions"

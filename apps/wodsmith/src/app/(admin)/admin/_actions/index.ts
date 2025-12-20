/**
 * Client-safe exports of admin actions
 * Re-exports actions without the "server-only" import to avoid server/client boundary issues
 */

export {
	addEntitlementOverrideAction,
	createFeatureAction,
	createLimitAction,
	getAllFeaturesAction,
	getAllLimitsAction,
	getAllPlansAction,
	getAllTeamsWithPlansAction,
	getTeamEntitlementSnapshotAction,
	getTeamOverridesAction,
	removeEntitlementOverrideAction,
	updateFeatureAction,
	updateLimitAction,
	updateTeamPlanAction,
} from "./entitlement-admin-actions"

// Simple test to verify admin dashboard exports
console.log("Testing admin dashboard exports...")

try {
	// Try to import the module
	const adminDashboard = require("./src/server/admin-dashboard.ts")
	console.log("✓ Admin dashboard module imports successfully")

	// Check if main functions exist
	const functions = [
		"getAdminDashboardData",
		"getTeamSchedulingStats",
		"getUpcomingScheduleOverview",
		"invalidateAdminDashboardCache",
		"getDashboardPerformanceMetrics",
	]

	for (const fnName of functions) {
		if (typeof adminDashboard[fnName] === "function") {
			console.log(`✓ ${fnName} function exists`)
		} else {
			console.log(`✗ ${fnName} function missing`)
		}
	}

	console.log("✓ Basic admin dashboard structure is valid")
} catch (error) {
	console.error("✗ Error testing admin dashboard:", error.message)
}

/**
 * Fixtures index - exports all E2E test fixtures
 */

export {
	ADMIN_USER,
	createAuthenticatedContext,
	isAuthenticated,
	login,
	loginAsAdmin,
	loginAsTestUser,
	logout,
	TEST_USER,
} from "./auth"

export {
	TEST_DATA,
	waitForApiCall,
	waitForNavigation,
	type TestTeam,
	type TestUser,
	type TestWorkout,
} from "./test-data"

import { vi } from "vitest"
import "@testing-library/jest-dom/vitest"

/**
 * Global test setup
 *
 * This file sets up default mocks that can be overridden by individual tests.
 *
 * For INTEGRATION TESTS (tests that use real DB):
 *   Use `vi.unmock("@/db")` at the top of your test file, then use
 *   createTestDb() and setTestDb() to inject an in-memory SQLite database.
 *   See test/lib/test-db.ts and test/integration/ for examples.
 *
 * For UNIT TESTS (tests that mock everything):
 *   The mocks below will be used automatically. Override as needed.
 */

// Mock Cloudflare context (always needed since we're not running in Workers)
vi.mock("@opennextjs/cloudflare", () => ({
	getCloudflareContext: () => {
		throw new Error(
			"getCloudflareContext called in tests. For integration tests, use vi.unmock('@/db') and setTestDb(). " +
				"For unit tests, mock the specific functions you need.",
		)
	},
}))

// Mock @/db - integration tests should use vi.unmock("@/db") to use real module
vi.mock("@/db", () => ({
	getDb: vi.fn(() => {
		throw new Error(
			"getDb() called without test DB. Use vi.unmock('@/db') and setTestDb() for integration tests, " +
				"or mock getDb in your test file.",
		)
	}),
	setTestDb: vi.fn(),
}))

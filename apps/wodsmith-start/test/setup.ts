import { vi } from "vitest"
import "@testing-library/jest-dom/vitest"

// Mock DOM methods used by Radix UI components
Element.prototype.scrollIntoView = vi.fn()
Element.prototype.hasPointerCapture = vi.fn()
Element.prototype.setPointerCapture = vi.fn()
Element.prototype.releasePointerCapture = vi.fn()

// Mock the D1 client used by Drizzle
const mockD1Client = {
	prepare: () => mockD1Client,
	bind: () => mockD1Client,
	run: () => Promise.resolve({ success: true }),
	all: () =>
		Promise.resolve({
			success: true,
			results: [{ id: "test_team_id", name: "Test Team", slug: "test-team" }],
		}),
	get: () => Promise.resolve({ success: true }),
	raw: () => Promise.resolve([]),
	returning: () =>
		Promise.resolve([
			{ id: "test_team_id", name: "Test Team", slug: "test-team" },
		]),
}

// Mock the db object that is null in test environment
// The mockDb needs to be thenable so that when you await the query chain, it returns an array
export const createChainableMock = () => {
	const mock: Record<string, unknown> = {
		// Make it thenable so await works at any point in the chain
		then: (resolve: (value: unknown[]) => void) => {
			resolve([])
			return Promise.resolve([])
		},
		// Query chain methods
		select: vi.fn(() => createChainableMock()),
		from: vi.fn(() => createChainableMock()),
		leftJoin: vi.fn(() => createChainableMock()),
		innerJoin: vi.fn(() => createChainableMock()),
		where: vi.fn(() => createChainableMock()),
		limit: vi.fn(() => createChainableMock()),
		orderBy: vi.fn(() => createChainableMock()),
		offset: vi.fn(() => createChainableMock()),
		groupBy: vi.fn(() => createChainableMock()),
		// Insert/update chain
		insert: vi.fn(() => createChainableMock()),
		values: vi.fn(() => createChainableMock()),
		returning: vi.fn().mockResolvedValue([{ id: "test_id", name: "Test" }]),
		onConflictDoUpdate: vi.fn(() => createChainableMock()),
		// Update chain
		update: vi.fn(() => createChainableMock()),
		set: vi.fn(() => createChainableMock()),
		// Delete
		delete: vi.fn().mockResolvedValue({ changes: 0 }),
		// Other methods
		get: vi.fn().mockResolvedValue(null),
		// Query API (drizzle relational queries)
		query: {
			workouts: { findFirst: vi.fn().mockResolvedValue(null) },
			organizerRequestTable: { findFirst: vi.fn().mockResolvedValue(null) },
			teamTable: { findFirst: vi.fn().mockResolvedValue(null) },
			teamMembershipTable: { findFirst: vi.fn().mockResolvedValue(null) },
			planTable: { findFirst: vi.fn().mockResolvedValue(null) },
			featureTable: { findFirst: vi.fn().mockResolvedValue(null) },
			limitTable: { findFirst: vi.fn().mockResolvedValue(null) },
		},
	}
	return mock
}

const mockDb = createChainableMock()

vi.mock("@/db", () => ({
	db: null,
	getDb: vi.fn(() => mockDb),
}))

import { vi } from "vitest"
import "@testing-library/jest-dom/vitest"

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
const mockDb = {
	select: vi.fn().mockReturnThis(),
	from: vi.fn().mockReturnThis(),
	leftJoin: vi.fn().mockReturnThis(),
	innerJoin: vi.fn().mockReturnThis(),
	where: vi.fn().mockImplementation(() => Promise.resolve([
		{
			id: "test_track_id",
			name: "Test Track",
			description: "Test Description",
			type: "team_owned",
			ownerTeamId: "test_team_id",
			isPublic: 1,
			createdAt: new Date(),
			updatedAt: new Date(),
			updateCounter: 1,
			ownerTeam: {
				id: "test_team_id",
				name: "Test Team",
			},
		}
	])),
	insert: vi.fn().mockReturnThis(),
	values: vi.fn().mockReturnThis(),
	returning: vi.fn().mockResolvedValue([{ id: "test_id", name: "Test" }]),
	delete: vi.fn().mockResolvedValue({ changes: 0 }),
	update: vi.fn().mockReturnThis(),
	set: vi.fn().mockReturnThis(),
	get: vi.fn().mockResolvedValue(null),
}

vi.mock("@/db", () => ({
	db: null,
	getDd: vi.fn(() => mockDb),
}))

vi.mock("@opennextjs/cloudflare", () => ({
	getCloudflareContext: () => ({
		env: {
			NEXT_TAG_CACHE_D1: mockD1Client,
		},
	}),
}))

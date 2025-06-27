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

vi.mock("@opennextjs/cloudflare", () => ({
	getCloudflareContext: () => ({
		env: {
			NEXT_TAG_CACHE_D1: mockD1Client,
		},
	}),
}))

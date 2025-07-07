import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockTracks = [
	{
		id: "ptrk_a",
		name: "Mock Track A",
		description: "Description A",
		type: "official_3rd_party" as const,
		ownerTeamId: null,
	},
	{
		id: "ptrk_b",
		name: "Mock Track B",
		description: "Description B",
		type: "official_3rd_party" as const,
		ownerTeamId: null,
	},
];

vi.mock("@/server/programming-tracks", () => ({
	getPublicProgrammingTracks: vi.fn(() => mockTracks),
}));

// Import page after mocks are in place
// eslint-disable-next-line import/first
import ProgrammingPage from "@/app/(main)/programming/page";

describe("Programming Index Page", () => {
	it("renders list length equal to mock data and shows track names", async () => {
		// ProgrammingPage is an async server component; invoke to get element
		const element = await ProgrammingPage();

		render(element);

		// Expect each track name to appear in the document
		for (const track of mockTracks) {
			expect(await screen.findByText(track.name)).toBeInTheDocument();
		}

		// Count cards via role heading maybe; easiest: count track names found
		const headings = await screen.findAllByText(/Mock Track/);
		expect(headings.length).toBe(mockTracks.length);
	});
});

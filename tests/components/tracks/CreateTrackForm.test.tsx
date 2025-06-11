import CreateTrackForm from "@/components/tracks/CreateTrackForm"
import { render, screen } from "@testing-library/react"
import React from "react"
import { vi } from "vitest"

vi.mock("@/app/actions/trackActions", () => ({
	createTrackAction: vi.fn().mockResolvedValue(undefined),
}))

describe("CreateTrackForm", () => {
	it("renders all inputs", () => {
		render(<CreateTrackForm teams={[{ id: "team_1", name: "Team 1" }]} />)
		expect(screen.getByPlaceholderText(/Name/i)).toBeTruthy()
		expect(screen.getByPlaceholderText(/Description/i)).toBeTruthy()
		expect(screen.getByPlaceholderText(/Type/i)).toBeTruthy()
	})
})

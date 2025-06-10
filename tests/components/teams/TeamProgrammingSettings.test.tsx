import { TeamProgrammingSettings } from "@/components/teams/TeamProgrammingSettings"
import { render, screen } from "@testing-library/react"
import React from "react"

describe("TeamProgrammingSettings", () => {
	it("renders placeholder when no tracks", () => {
		render(<TeamProgrammingSettings teamId="team_1" />)
		expect(screen.getByText(/No tracks assigned/i)).toBeTruthy()
	})
})

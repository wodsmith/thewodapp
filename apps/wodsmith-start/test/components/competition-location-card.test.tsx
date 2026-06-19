import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { CompetitionLocationCard } from "@/components/competition-location-card"

const address = {
	name: "Functional Fitness Central",
	streetLine1: "123 Main St",
	city: "Austin",
  stateProvince: "TX",
  postalCode: "78701",
  countryCode: "US",
}

describe("CompetitionLocationCard", () => {
  it("shows physical address details when the competition type has physical venue capability", () => {
    render(
      <CompetitionLocationCard
        address={address}
        competitionType="in-person"
        organizingTeamName="Functional Fitness Austin"
      />,
    )

    expect(screen.getByText(/Functional Fitness Central/)).toBeInTheDocument()
    expect(screen.getByText(/123 Main St/)).toBeInTheDocument()
    expect(screen.queryByText(/No physical location required/)).toBeNull()
  })

  it("hides address details when the competition type does not have physical venue capability", () => {
    render(
      <CompetitionLocationCard
        address={address}
        competitionType="online"
        organizingTeamName="Functional Fitness Austin"
      />,
    )

    expect(
      screen.getByText("This is an online competition. No physical location required."),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Functional Fitness Central/)).toBeNull()
    expect(screen.queryByText(/123 Main St/)).toBeNull()
  })

  it("fails closed for unknown competition types instead of displaying a venue", () => {
    render(
      <CompetitionLocationCard
        address={address}
        competitionType="benchmark"
        organizingTeamName="Functional Fitness Austin"
      />,
    )

    expect(screen.queryByText(/Functional Fitness Central/)).toBeNull()
    expect(screen.queryByText(/123 Main St/)).toBeNull()
    expect(screen.getByText(/No physical location required/)).toBeInTheDocument()
  })
})

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AddOnsSection } from "@/components/registration/addons-section"
import type { PublicAddon } from "@/server-fns/competition-addon-fns"

const includedDownload: PublicAddon = {
  id: "product-1",
  name: "Benchmark standards",
  description: "Movement standards and scorecards.",
  imageUrl: null,
  priceCents: 0,
  delivery: "DOWNLOAD",
  access: "INCLUDED_WITH_REGISTRATION",
  downloadFiles: [
    { title: "Movement standards" },
    { title: "Printable scorecards" },
  ],
  feeConfig: {
    platformPercentageBasisPoints: 0,
    platformFixedCents: 0,
    stripePercentageBasisPoints: 0,
    stripeFixedCents: 0,
    passStripeFeesToCustomer: false,
    passPlatformFeesToCustomer: false,
  },
  maxPerAthlete: 1,
  availableUntil: null,
  variants: [],
}

describe("AddOnsSection", () => {
  // @lat: [[commerce#Downloadable Competition Products#Athlete download library]]
  it("shows included PDFs without rendering purchase controls", () => {
    render(
      <AddOnsSection
        addons={[includedDownload]}
        quantities={new Map()}
        onQuantityChange={vi.fn()}
      />,
    )

    expect(screen.getByText("Included downloads")).toBeInTheDocument()
    expect(screen.getByText("Benchmark standards")).toBeInTheDocument()
    expect(
      screen.getByText("Movement standards · Printable scorecards"),
    ).toBeInTheDocument()
    expect(screen.queryByText("Quantity")).not.toBeInTheDocument()
  })
})

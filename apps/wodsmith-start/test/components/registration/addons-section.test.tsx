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

const optionalDownload: PublicAddon = {
  ...includedDownload,
  id: "product-2",
  name: "Programming guide",
  priceCents: 1900,
  access: "OPTIONAL_PURCHASE",
}

const pickupShirt: PublicAddon = {
  ...includedDownload,
  id: "product-3",
  name: "Event shirt",
  priceCents: 2500,
  delivery: "PICKUP",
  access: "OPTIONAL_PURCHASE",
  downloadFiles: [],
  variants: [
    {
      id: "variant-medium",
      label: "Medium",
      remaining: null,
      soldOut: false,
    },
  ],
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

  // @lat: [[commerce#Registration Add-ons]]
  it("explains how selected add-ons will be delivered", () => {
    render(
      <AddOnsSection
        addons={[optionalDownload, pickupShirt]}
        quantities={
          new Map([
            ["product-2::", 1],
            ["product-3::variant-medium", 2],
          ])
        }
        onQuantityChange={vi.fn()}
      />,
    )

    expect(screen.getByText("Added to your registration")).toBeInTheDocument()
    expect(screen.getByText("1 × Programming guide")).toBeInTheDocument()
    expect(screen.getByText("Download after payment")).toBeInTheDocument()
    expect(screen.getByText("2 × Event shirt (Medium)")).toBeInTheDocument()
    expect(screen.getByText("Pick up at competition")).toBeInTheDocument()
  })
})

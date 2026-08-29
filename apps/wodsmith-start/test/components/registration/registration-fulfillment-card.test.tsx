import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { RegistrationFulfillmentCard } from "@/components/registration/registration-fulfillment-card"

describe("RegistrationFulfillmentCard", () => {
  // @lat: [[commerce#Downloadable Competition Products#Athlete download library]]
  it("renders purchased merch and entitled files on a registration page", () => {
    render(
      <RegistrationFulfillmentCard
        purchases={[
          {
            id: "purchase-1",
            productId: "shirt-1",
            name: "Event shirt",
            description: "Competition tee",
            delivery: "PICKUP",
            quantity: 2,
            variantLabel: "Medium",
          },
          {
            id: "purchase-2",
            productId: "product-1",
            name: "HillerFit Guide",
            description: null,
            delivery: "DOWNLOAD",
            quantity: 1,
            variantLabel: null,
          },
        ]}
        downloads={[
          {
            id: "product-1",
            name: "HillerFit Guide",
            description: "Your benchmark preparation guide.",
            access: "OPTIONAL_PURCHASE",
            competition: {
              id: "competition-1",
              name: "HillerFit Benchmark",
              slug: "hillerfit-benchmark",
            },
            files: [
              {
                id: "file-1",
                title: "Training Guide",
                originalFilename: "guide.pdf",
                fileSize: 2048,
                mimeType: "application/pdf",
              },
            ],
          },
        ]}
      />,
    )

    expect(screen.getByText("Your add-ons & downloads")).toBeInTheDocument()
    expect(screen.getByText("2 × Event shirt (Medium)")).toBeInTheDocument()
    expect(screen.getByText("Pick up at competition")).toBeInTheDocument()
    expect(screen.getByText("1 × HillerFit Guide")).toBeInTheDocument()
    expect(screen.getByText("Download below")).toBeInTheDocument()
    expect(screen.getByText("Training Guide")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Download/ })).toHaveAttribute(
      "href",
      "/api/downloads/file-1",
    )
  })

  it("renders nothing when the registration has no fulfillment items", () => {
    const { container } = render(
      <RegistrationFulfillmentCard purchases={[]} downloads={[]} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})

// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CrewCopyPriorEventPanel } from "@/components/crew-copy-event/crew-copy-prior-event-panel"
import type { CrewCopyPriorEventPageData } from "@/server-fns/crew-copy-event-fns"

vi.mock("@/server-fns/crew-copy-event-fns", () => ({
  getCrewCopyPriorEventPageFn: vi.fn(),
}))

const targetEvent = {
  id: "comp_target",
  name: "Target event",
  organizingTeamId: "team_one",
  startDate: "2026-08-15",
  endDate: "2026-08-16",
  timezone: "America/Denver",
  lifecycle: "draft",
}

const sourceEvent = {
  ...targetEvent,
  id: "comp_source",
  name: "Prior event",
  startDate: "2025-08-15",
  endDate: "2025-08-16",
}

function pageData(): CrewCopyPriorEventPageData {
  return {
    targetEvent,
    eligibleEvents: [sourceEvent],
    selectedSourceEventId: sourceEvent.id,
    preview: {
      mode: "empty_target_only",
      sourceEvent,
      targetEvent,
      dateShiftDays: 365,
      settings: {
        willCopyAssumptions: false,
        sourceAssumptions: "",
        targetHasAssumptions: false,
      },
      summary: [
        {
          category: "venues",
          label: "Venues",
          status: "skip",
          count: 0,
          reason: "Nothing to copy.",
        },
        {
          category: "imports",
          label: "Imports",
          status: "deny",
          count: 0,
          reason: "Imports are never copied.",
        },
      ],
      plan: {
        mode: "empty_target_only",
        sourceEventId: sourceEvent.id,
        targetEventId: targetEvent.id,
        dateShiftDays: 365,
        venuesToCreate: [],
        tracksToCreate: [],
        trackWorkoutsToCreate: [],
        heatsToCreate: [],
        shiftsToCreate: [],
        assumptionsToWrite: null,
      },
      canApply: false,
    },
  }
}

describe("Crew copy-prior-event metric composition", () => {
  // @lat: [[ui-library#UI Library#Current boundary#Metric composition#Crew compact preview consumers#Copy prior event metrics]]
  it("renders zero-state copy counts as semantic label/value pairs without changing their visual order", () => {
    const { container } = render(
      <CrewCopyPriorEventPanel
        eventId={targetEvent.id}
        pageData={pageData()}
        onApply={vi.fn()}
      />,
    )

    const metrics = Array.from(container.querySelectorAll("dl"))
    expect(metrics).toHaveLength(3)
    expect(
      metrics.map((metric) => [
        metric.querySelector("dt")?.textContent,
        metric.querySelector("dd")?.textContent,
      ]),
    ).toEqual([
      ["Copy", "0"],
      ["Skip", "1"],
      ["Deny", "1"],
    ])

    for (const metric of metrics) {
      expect(metric.children[0]?.tagName).toBe("DT")
      expect(metric.children[1]?.tagName).toBe("DD")
      expect(metric).toHaveClass(
        "rounded-md",
        "border",
        "bg-card",
        "px-2",
        "py-2",
      )
      expect(metric).not.toHaveClass("gap-1", "bg-muted", "p-3")
      expect(metric.querySelector("dd")).toHaveClass("order-first", "text-base")
      expect(metric.querySelector("dt")).toHaveClass(
        "text-xs",
        "font-normal",
        "text-muted-foreground",
      )
    }
  })

  // @lat: [[ui-library#UI Library#Current boundary#Metric composition#Crew compact preview consumers#Copy prior event empty state]]
  it("keeps the no-eligible-events state free of fabricated metrics", () => {
    const emptyData = {
      ...pageData(),
      eligibleEvents: [],
      selectedSourceEventId: null,
      preview: null,
    }

    const { container } = render(
      <CrewCopyPriorEventPanel
        eventId={targetEvent.id}
        pageData={emptyData}
        onApply={vi.fn()}
      />,
    )

    expect(
      screen.getByText(
        "No earlier Crew events from this organizing team are eligible.",
      ),
    ).toBeVisible()
    expect(container.querySelector("dl")).toBeNull()
  })
})

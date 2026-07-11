// @vitest-environment jsdom

import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CrewTemplatePanel } from "@/components/crew-templates/crew-template-panel"
import type { CrewTemplatePageData } from "@/server-fns/crew-template-fns"

const templateMocks = vi.hoisted(() => ({
  roles: Number.MAX_SAFE_INTEGER,
}))

vi.mock("@/lib/crew/templates", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/crew/templates")>()

  return {
    ...actual,
    buildCrewTemplatePreview: vi.fn((template) => ({
      template,
      roles: [],
      shifts: [],
      staffingAssumptions: "",
      summary: {
        roles: templateMocks.roles,
        shifts: 0,
        newShifts: 0,
        duplicateShifts: 0,
        outsideEventDateShifts: 0,
        canFillAssumptions: true,
        warnings: [],
      },
    })),
    buildCrewTemplateApplyPlan: vi.fn(() => ({
      mode: "append_missing",
      shiftsToCreate: [],
      assumptionsToWrite: null,
    })),
  }
})

function templatePage(): CrewTemplatePageData {
  return {
    event: {
      id: "comp_target",
      name: "Target event",
      startDate: "2026-08-15",
      endDate: "2026-08-16",
      timezone: "America/Denver",
    },
    templates: [
      {
        id: "template_one",
        name: "Template one",
        description: "A focused template fixture.",
        source: "built_in",
        roles: [],
        shifts: [],
        staffingAssumptions: "",
      },
    ],
    context: {
      eventId: "comp_target",
      startDate: "2026-08-15",
      endDate: "2026-08-16",
      timezone: "America/Denver",
      existingShifts: [],
      existingAssumptions: "",
    },
  }
}

describe("Crew template metric composition", () => {
  // @lat: [[ui-library#UI Library#Current boundary#Metric composition#Crew compact preview consumers#Template preview metrics]]
  it("renders long and zero template counts as semantic label/value pairs without changing their visual order", () => {
    const { container } = render(
      <CrewTemplatePanel
        templatePage={templatePage()}
        onApply={vi.fn()}
        onSavePreset={vi.fn()}
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
      ["Roles", String(Number.MAX_SAFE_INTEGER)],
      ["New", "0"],
      ["Skipped", "0"],
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
      expect(metric.querySelector("dd")).toHaveClass(
        "order-first",
        "text-xs",
        "leading-4",
        "tracking-normal",
        "min-w-0",
        "break-words",
        "[overflow-wrap:anywhere]",
      )
      expect(metric.querySelector("dd")).not.toHaveClass(
        "leading-none",
        "tracking-tight",
      )
      expect(metric.querySelector("dt")).toHaveClass(
        "text-xs",
        "font-normal",
        "text-muted-foreground",
      )
    }
  })

  // @lat: [[ui-library#UI Library#Current boundary#Metric composition#Crew compact preview consumers#Template unavailable state]]
  it("keeps the unavailable-template state non-rendering", () => {
    const page = { ...templatePage(), templates: [] }
    const { container } = render(
      <CrewTemplatePanel
        templatePage={page}
        onApply={vi.fn()}
        onSavePreset={vi.fn()}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})

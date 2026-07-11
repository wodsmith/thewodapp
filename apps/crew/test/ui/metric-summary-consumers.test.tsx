import { render, screen, within } from "@testing-library/react"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import { Metric } from "@/components/ui/metric"

const consumerCases = [
  {
    name: "combined import tabs",
    sourcePath: "src/components/crew/crew-import-tabs.tsx",
    expectedLabels: [
      "{`Ready ${importCopy.nounPlural}`}",
      "Warnings",
      "Need review",
      "Applied",
      "Added",
      "Skipped",
      "Ready",
      "Skipped",
      "Need review",
    ],
  },
  {
    name: "volunteer import flow",
    sourcePath: "src/components/crew/volunteer-import-flow.tsx",
    expectedLabels: [
      "Ready volunteers",
      "Warnings",
      "Need review",
      "Applied",
      "Added",
      "Skipped",
      "Ready",
      "Skipped",
      "Need review",
    ],
  },
  {
    name: "heats import flow",
    sourcePath: "src/routes/events/$eventId/heats.tsx",
    expectedLabels: [
      "Ready heat rows",
      "Warnings",
      "Need review",
      "Applied",
      "Added",
      "Skipped",
      "Ready",
      "Skipped",
      "Need review",
    ],
  },
] as const

describe("Crew metric summary consumers", () => {
  // @lat: [[ui-library#Crew metric consumer tests#Combined import summary composition]]
  it("keeps all combined-import labels and values in direct semantic pairs", () => {
    expectDirectMetricPairs(consumerCases[0])
  })

  // @lat: [[ui-library#Crew metric consumer tests#Volunteer import summary composition]]
  it("keeps all volunteer-import labels and values in direct semantic pairs", () => {
    expectDirectMetricPairs(consumerCases[1])
  })

  // @lat: [[ui-library#Crew metric consumer tests#Heats import summary composition]]
  it("keeps all heats-import labels and values in direct semantic pairs", () => {
    expectDirectMetricPairs(consumerCases[2])
  })

  // @lat: [[ui-library#Crew metric consumer tests#Consumer value edge cases]]
  it("preserves zero, ReactNode, and long values in description-list order", () => {
    const longValue = "import-batch-".repeat(20)
    render(
      <div>
        <ConsumerMetric label="Zero rows">{0}</ConsumerMetric>
        <ConsumerMetric label="Composed value">
          <span>42 ready</span>
        </ConsumerMetric>
        <ConsumerMetric label="Long reference">{longValue}</ConsumerMetric>
      </div>,
    )

    const metrics = screen.getAllByRole("definition").map((value) => {
      const metric = value.closest("dl")
      expect(metric).not.toBeNull()
      return {
        label: within(metric as HTMLElement).getByRole("term").textContent,
        value: value.textContent,
      }
    })

    expect(metrics).toEqual([
      { label: "Zero rows", value: "0" },
      { label: "Composed value", value: "42 ready" },
      { label: "Long reference", value: longValue },
    ])
  })
})

function ConsumerMetric({
  children,
  label,
}: {
  children: ReactNode
  label: ReactNode
}) {
  return (
    <Metric.Inset className="border bg-background">
      <Metric.Label>{label}</Metric.Label>
      <Metric.Value>{children}</Metric.Value>
    </Metric.Inset>
  )
}

function expectDirectMetricPairs({
  name,
  sourcePath,
  expectedLabels,
}: (typeof consumerCases)[number]) {
  const source = readFileSync(resolve(process.cwd(), sourcePath), "utf8")
  const pairs = Array.from(
    source.matchAll(
      /<Metric\.Inset\b[^>]*>\s*<Metric\.Label\b[^>]*>([\s\S]*?)<\/Metric\.Label>\s*<Metric\.Value\b[^>]*>([\s\S]*?)<\/Metric\.Value>\s*<\/Metric\.Inset>/g,
    ),
  )

  expect(pairs, `${name} metric pair count`).toHaveLength(9)
  expect(pairs.map(([, label]) => normalizeJsx(label))).toEqual(
    expectedLabels,
  )
  expect(pairs.every(([, , value]) => normalizeJsx(value).length > 0)).toBe(
    true,
  )
  expect(source).not.toContain("function SummaryMetric")
  expect(source).not.toContain("<SummaryMetric")
}

function normalizeJsx(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

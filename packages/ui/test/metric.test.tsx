// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest"

import { Metric } from "@repo/ui/metric"
import { cleanup, render, screen } from "@testing-library/react"
import { createRef } from "react"
import { afterEach, describe, expect, it } from "vitest"

afterEach(cleanup)

describe("Metric composition", () => {
  // @lat: [[lat.md/ui-library#UI Library#Current boundary#Metric composition#Semantic metric root]]
  it("renders a semantic description list with native props, refs, and portable parts", () => {
    const rootRef = createRef<HTMLDListElement>()
    const labelRef = createRef<HTMLElement>()
    const iconRef = createRef<HTMLSpanElement>()
    const valueRef = createRef<HTMLElement>()
    const supportingRef = createRef<HTMLElement>()

    render(
      <Metric.Root
        ref={rootRef}
        aria-label="Registration metrics"
        data-state="ready"
        className="root-class"
      >
        <Metric.Label ref={labelRef} className="label-class">
          <Metric.Icon ref={iconRef} data-testid="metric-icon">
            <svg role="img" aria-label="Hidden users icon" />
          </Metric.Icon>
          Registered athletes
        </Metric.Label>
        <Metric.Value ref={valueRef} className="value-class">
          128
        </Metric.Value>
        <Metric.Supporting
          ref={supportingRef}
          className="supporting-class"
        >
          18 joined this week
        </Metric.Supporting>
      </Metric.Root>,
    )

    const root = screen.getByRole("term").closest("dl")
    expect(root).toHaveAttribute("aria-label", "Registration metrics")
    expect(root).toHaveAttribute("data-state", "ready")
    expect(root).toHaveClass("root-class", "min-w-0")
    expect(rootRef.current).toBe(root)

    const label = screen.getByRole("term")
    expect(label.tagName).toBe("DT")
    expect(label).toHaveTextContent("Registered athletes")
    expect(label).toHaveClass("label-class")
    expect(labelRef.current).toBe(label)

    const values = screen.getAllByRole("definition")
    expect(values).toHaveLength(2)
    expect(values[0]).toHaveTextContent("128")
    expect(values[0]).toHaveClass("value-class", "tabular-nums")
    expect(valueRef.current).toBe(values[0])
    expect(values[1]).toHaveTextContent("18 joined this week")
    expect(values[1]).toHaveClass("supporting-class", "text-foreground/70")
    expect(supportingRef.current).toBe(values[1])

    expect(iconRef.current).toHaveAttribute("aria-hidden", "true")
    expect(
      screen.queryByRole("img", { name: "Hidden users icon" }),
    ).not.toBeInTheDocument()
  })

  // @lat: [[lat.md/ui-library#UI Library#Current boundary#Metric composition#Explicit metric surfaces]]
  it("provides explicit card and compact inset description-list surfaces", () => {
    const cardRef = createRef<HTMLDListElement>()
    const insetRef = createRef<HTMLDListElement>()

    render(
      <div>
        <Metric.Card ref={cardRef} aria-label="Card metric" className="card">
          <Metric.Label>Revenue</Metric.Label>
          <Metric.Value>$12,450</Metric.Value>
        </Metric.Card>
        <Metric.Inset
          ref={insetRef}
          aria-label="Inset metric"
          className="inset"
        >
          <Metric.Label>Heat</Metric.Label>
          <Metric.Value size="sm">3 of 8</Metric.Value>
        </Metric.Inset>
      </div>,
    )

    const card = screen.getByLabelText("Card metric")
    expect(card.tagName).toBe("DL")
    expect(card).toHaveClass("card", "border", "bg-card")
    expect(cardRef.current).toBe(card)

    const inset = screen.getByLabelText("Inset metric")
    expect(inset.tagName).toBe("DL")
    expect(inset).toHaveClass("inset", "bg-muted")
    expect(insetRef.current).toBe(inset)
    expect(screen.getByText("3 of 8")).toHaveClass("text-lg")
  })

  // @lat: [[lat.md/ui-library#UI Library#Current boundary#Metric composition#Metric value variants]]
  it("offers only finite size and semantic tone variants on values", () => {
    render(
      <Metric.Root>
        <Metric.Label>Status totals</Metric.Label>
        <Metric.Value size="md" tone="neutral">
          48
        </Metric.Value>
        <Metric.Value size="lg" tone="positive">
          +12
        </Metric.Value>
        <Metric.Value tone="warning">7 delayed</Metric.Value>
        <Metric.Value tone="critical">2 blocked</Metric.Value>
      </Metric.Root>,
    )

    const definitions = screen.getAllByRole("definition")
    expect(definitions[0]).toHaveClass("text-2xl", "text-foreground")
    expect(definitions[1]).toHaveClass(
      "text-3xl",
      "text-emerald-700",
      "dark:text-emerald-400",
    )
    expect(definitions[2]).toHaveClass(
      "text-amber-700",
      "dark:text-amber-400",
    )
    expect(definitions[3]).toHaveClass("text-destructive")
  })

  // @lat: [[lat.md/ui-library#UI Library#Current boundary#Metric composition#Metric overflow safety]]
  it("keeps long code-like values and supporting text wrappable", () => {
    render(
      <Metric.Inset aria-label="Long metric">
        <Metric.Label>Competition identifier</Metric.Label>
        <Metric.Value className="font-mono">
          cmp_01JYX9A7V4KQ8N3Z6W2TR5M0BC
        </Metric.Value>
        <Metric.Supporting>
          Synced from a deliberately-long-external-reference-without-spaces
        </Metric.Supporting>
      </Metric.Inset>,
    )

    expect(screen.getByText(/cmp_01JYX/)).toHaveClass(
      "break-words",
      "[overflow-wrap:anywhere]",
    )
    expect(screen.getByText(/Synced from/)).toHaveClass(
      "break-words",
      "[overflow-wrap:anywhere]",
    )
  })

  // @lat: [[lat.md/ui-library#UI Library#Current boundary#Metric composition#Metric context misuse]]
  it.each([
    ["Metric.Icon", <Metric.Icon>icon</Metric.Icon>],
    ["Metric.Label", <Metric.Label>label</Metric.Label>],
    ["Metric.Value", <Metric.Value>value</Metric.Value>],
    ["Metric.Supporting", <Metric.Supporting>supporting</Metric.Supporting>],
  ])("rejects %s outside a metric surface", (component, element) => {
    expect(() => render(element)).toThrow(
      `${component} must be used within <Metric.Root>, <Metric.Card>, or <Metric.Inset>`,
    )
  })
})

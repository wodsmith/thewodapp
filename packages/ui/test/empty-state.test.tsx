// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest"

import { EmptyState } from "@repo/ui/empty-state"
import { fireEvent, render, screen } from "@testing-library/react"
import { createRef, Fragment } from "react"
import { describe, expect, it, vi } from "vitest"

describe("EmptyState composition", () => {
  // @lat: [[lat.md/ui-library#UI Library#Current boundary#Empty state composition#Plain empty state]]
  it("composes a plain status with explicit heading semantics and arbitrary actions", () => {
    const rootRef = createRef<HTMLDivElement>()
    const iconRef = createRef<HTMLDivElement>()
    const titleRef = createRef<HTMLElement>()
    const descriptionRef = createRef<HTMLParagraphElement>()
    const actionsRef = createRef<HTMLDivElement>()
    const onReset = vi.fn()

    render(
      <EmptyState.Root
        ref={rootRef}
        role="status"
        aria-live="polite"
        data-state="filtered"
        className="plain-class"
      >
        <EmptyState.Icon ref={iconRef} data-testid="empty-icon">
          <svg role="img" aria-label="Hidden magnifier" />
        </EmptyState.Icon>
        <EmptyState.Title
          ref={titleRef}
          data-kind="empty-title"
          className="title-class"
        >
          <h2 className="caller-title-class">
            No workouts match your filters
          </h2>
        </EmptyState.Title>
        <EmptyState.Description
          ref={descriptionRef}
          data-testid="empty-description"
        >
          Change or clear the filters to see more workouts.
        </EmptyState.Description>
        <EmptyState.Actions
          ref={actionsRef}
          data-testid="empty-actions"
          className="actions-class"
        >
          <button type="button" onClick={onReset}>
            Clear filters
          </button>
          <a href="#create-workout">Create workout</a>
        </EmptyState.Actions>
      </EmptyState.Root>,
    )

    const status = screen.getByRole("status")
    expect(status).toHaveAttribute("aria-live", "polite")
    expect(status).toHaveAttribute("data-state", "filtered")
    expect(status).toHaveClass("plain-class")
    expect(rootRef.current).toBe(status)
    const heading = screen.getByRole("heading", {
      level: 2,
      name: "No workouts match your filters",
    })
    expect(heading).toBeVisible()
    expect(heading).toHaveAttribute("data-kind", "empty-title")
    expect(heading).toHaveClass("title-class", "caller-title-class")
    expect(titleRef.current).toBe(heading)
    expect(
      screen.getByText("Change or clear the filters to see more workouts."),
    ).toHaveClass("text-muted-foreground")
    expect(descriptionRef.current).toBe(screen.getByTestId("empty-description"))
    expect(iconRef.current).toHaveAttribute("aria-hidden", "true")
    expect(
      screen.queryByRole("img", { name: "Hidden magnifier" }),
    ).not.toBeInTheDocument()
    expect(actionsRef.current).toHaveClass("actions-class")

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }))
    expect(onReset).toHaveBeenCalledOnce()
    expect(screen.getByRole("link", { name: "Create workout" })).toHaveAttribute(
      "href",
      "#create-workout",
    )
  })

  // @lat: [[lat.md/ui-library#UI Library#Current boundary#Empty state composition#Bounded empty state card]]
  it("provides an explicit bounded card surface with native div props and ref", () => {
    const cardRef = createRef<HTMLDivElement>()

    render(
      <EmptyState.Card
        ref={cardRef}
        aria-label="Empty registrations"
        data-kind="bounded"
        className="card-class"
      >
        <EmptyState.Title>
          <h3>No registrations yet</h3>
        </EmptyState.Title>
        <EmptyState.Description>Check back after launch.</EmptyState.Description>
      </EmptyState.Card>,
    )

    const card = screen.getByLabelText("Empty registrations")
    expect(card.tagName).toBe("DIV")
    expect(card).toHaveAttribute("data-kind", "bounded")
    expect(card).toHaveClass("card-class", "max-w-xl", "border")
    expect(cardRef.current).toBe(card)
    expect(
      screen.getByRole("heading", { level: 3, name: "No registrations yet" }),
    ).toBeVisible()
  })

  // @lat: [[lat.md/ui-library#UI Library#Current boundary#Empty state composition#Explicit heading child]]
  it("requires one concrete h1 through h6 child for the title", () => {
    expect(() =>
      render(
        <EmptyState.Root>
          <EmptyState.Title>
            <p>Not a heading</p>
          </EmptyState.Title>
        </EmptyState.Root>,
      ),
    ).toThrow("EmptyState.Title requires one h1 through h6 child")

    expect(() =>
      render(
        <EmptyState.Root>
          <EmptyState.Title>
            <Fragment>
              <h2>Wrapped heading</h2>
            </Fragment>
          </EmptyState.Title>
        </EmptyState.Root>,
      ),
    ).toThrow("EmptyState.Title requires one h1 through h6 child")

    expect(() =>
      render(
        <EmptyState.Root>
          <EmptyState.Title>
            <h2>First heading</h2>
            <h3>Second heading</h3>
          </EmptyState.Title>
        </EmptyState.Root>,
      ),
    ).toThrow()
  })

  // @lat: [[lat.md/ui-library#UI Library#Current boundary#Empty state composition#Empty state context misuse]]
  it.each([
    [
      "EmptyState.Icon",
      <EmptyState.Icon>
        <svg />
      </EmptyState.Icon>,
    ],
    [
      "EmptyState.Title",
      <EmptyState.Title>
        <h2>Orphan title</h2>
      </EmptyState.Title>,
    ],
    [
      "EmptyState.Description",
      <EmptyState.Description>Orphan description</EmptyState.Description>,
    ],
    [
      "EmptyState.Actions",
      <EmptyState.Actions>Orphan actions</EmptyState.Actions>,
    ],
  ])("rejects %s outside a root surface", (component, element) => {
    expect(() => render(element)).toThrow(
      `${component} must be used within <EmptyState.Root> or <EmptyState.Card>`,
    )
  })
})

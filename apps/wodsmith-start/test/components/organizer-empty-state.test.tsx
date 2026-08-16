// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest"

import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fireEvent, render, screen } from "@testing-library/react"
import { Inbox } from "lucide-react"
import { describe, expect, it, vi } from "vitest"
import { OrganizerEmptyState } from "@/components/organizer/empty-state"

describe("OrganizerEmptyState", () => {
  // @lat: [[lat.md/ui-library#UI Library#Current boundary#Empty state composition#Organizer compatibility adapter#Start adapter#Plain presentation]]
  it("preserves the plain presentation with an explicit h3 and decorative icon", () => {
    const { container } = render(
      <OrganizerEmptyState
        variant="plain"
        icon={Inbox}
        title="No heats yet"
        description="Create heats before assigning judges."
      />,
    )

    const root = container.firstElementChild
    expect(root).toHaveClass("px-6", "py-12", "text-center")
    expect(root).not.toHaveClass("border")
    expect(
      screen.getByRole("heading", { level: 3, name: "No heats yet" }),
    ).toHaveClass("text-lg", "font-semibold")
    expect(screen.getByText("Create heats before assigning judges.")).toHaveClass(
      "mt-2",
      "max-w-md",
    )
    expect(container.querySelector("svg")?.parentElement).toHaveAttribute(
      "aria-hidden",
      "true",
    )
  })

  // @lat: [[lat.md/ui-library#UI Library#Current boundary#Empty state composition#Organizer compatibility adapter#Start adapter#Card presentation]]
  it("preserves the bounded card and compatibility content spacing", () => {
    const { container } = render(
      <OrganizerEmptyState
        icon={Inbox}
        title="No registrations"
        description="Registrations will appear here."
      />,
    )

    const card = container.firstElementChild
    expect(card).toHaveClass(
      "rounded-lg",
      "border",
      "bg-card",
      "text-card-foreground",
      "shadow-sm",
    )
    expect(card).not.toHaveClass("max-w-xl", "p-8")
    expect(card?.firstElementChild).toHaveClass("p-6", "pt-0")
    expect(card?.firstElementChild?.firstElementChild).toHaveClass(
      "px-6",
      "py-12",
    )
  })

  // @lat: [[lat.md/ui-library#UI Library#Current boundary#Empty state composition#Organizer compatibility adapter#Start adapter#Incomplete actions]]
  it("omits incomplete action pairs", () => {
    render(
      <OrganizerEmptyState
        icon={Inbox}
        title="No invitations"
        description="Invite athletes when the list is ready."
        actionLabel="Invite athlete"
        onSecondaryAction={vi.fn()}
      />,
    )

    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  // @lat: [[lat.md/ui-library#UI Library#Current boundary#Empty state composition#Organizer compatibility adapter#Start adapter#Action behavior]]
  it("preserves primary and secondary actions, icons, order, and callbacks", () => {
    const onPrimary = vi.fn()
    const onSecondary = vi.fn()

    render(
      <OrganizerEmptyState
        icon={Inbox}
        title="No divisions"
        description="Add a division to continue."
        actionLabel="Add division"
        onAction={onPrimary}
        actionIcon={<span data-testid="primary-icon">+</span>}
        secondaryActionLabel="Import"
        onSecondaryAction={onSecondary}
        secondaryActionIcon={<span data-testid="secondary-icon">+</span>}
      />,
    )

    const buttons = screen.getAllByRole("button")
    expect(buttons.map((button) => button.textContent)).toEqual([
      "+Add division",
      "+Import",
    ])
    expect(screen.getByTestId("primary-icon")).toBeInTheDocument()
    expect(screen.getByTestId("secondary-icon")).toBeInTheDocument()
    expect(buttons[1]).toHaveClass("border")
    expect(buttons[0]?.parentElement).toHaveClass(
      "items-stretch",
      "justify-start",
      "sm:items-center",
    )

    fireEvent.click(buttons[0])
    fireEvent.click(buttons[1])
    expect(onPrimary).toHaveBeenCalledOnce()
    expect(onSecondary).toHaveBeenCalledOnce()
  })

  // @lat: [[lat.md/ui-library#UI Library#Current boundary#Empty state composition#Organizer compatibility adapter#Start adapter#Mirrored source parity]]
  it("stays byte-identical to the Crew compatibility adapter", () => {
    const startSource = readFileSync(
      resolve(process.cwd(), "src/components/organizer/empty-state.tsx"),
      "utf8",
    )
    const crewSource = readFileSync(
      resolve(process.cwd(), "../crew/src/components/organizer/empty-state.tsx"),
      "utf8",
    )

    expect(startSource).toBe(crewSource)
  })
})

import { Button } from "@repo/ui/button"
import { EmptyState } from "@repo/ui/empty-state"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Inbox, ListFilter, SearchX } from "lucide-react"
import { useState } from "react"
import { expect, userEvent, within } from "storybook/test"

const meta = {
  title: "Patterns/Empty state",
  component: EmptyState.Root,
  tags: ["autodocs"],
} satisfies Meta<typeof EmptyState.Root>

export default meta
type Story = StoryObj<typeof meta>

export const Card: Story = {
  render: () => (
    <EmptyState.Card aria-label="Empty registrations">
      <EmptyState.Icon>
        <Inbox />
      </EmptyState.Icon>
      <EmptyState.Title>
        <h2>No registrations yet</h2>
      </EmptyState.Title>
      <EmptyState.Description>
        Registrations will appear here after athletes join the competition.
      </EmptyState.Description>
      <EmptyState.Actions>
        <Button type="button">Copy registration link</Button>
      </EmptyState.Actions>
    </EmptyState.Card>
  ),
  play: async ({ canvasElement }) => {
    // @lat: [[lat.md/ui-library#UI Library#Storybook contract#Bounded empty state story]]
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", { level: 2, name: "No registrations yet" }),
    ).toBeVisible()
    await expect(canvas.getByLabelText("Empty registrations")).toHaveClass(
      "max-w-xl",
    )
    await expect(canvas.queryByRole("img")).not.toBeInTheDocument()
  },
}

export const Plain: Story = {
  render: () => (
    // biome-ignore lint/a11y/useSemanticElements: Root intentionally forwards caller-owned live-region semantics.
    <EmptyState.Root role="status" aria-live="polite">
      <EmptyState.Icon>
        <SearchX />
      </EmptyState.Icon>
      <EmptyState.Title>
        <h3>No movements found</h3>
      </EmptyState.Title>
      <EmptyState.Description>
        Try a broader search or clear the active filters.
      </EmptyState.Description>
    </EmptyState.Root>
  ),
  play: async ({ canvasElement }) => {
    // @lat: [[lat.md/ui-library#UI Library#Storybook contract#Plain empty state story]]
    const status = within(canvasElement).getByRole("status")
    await expect(status).toHaveAttribute("aria-live", "polite")
    await expect(
      within(status).getByRole("heading", { level: 3 }),
    ).toHaveTextContent("No movements found")
  },
}

function ActionExample() {
  const [copied, setCopied] = useState(false)

  return (
    <EmptyState.Card>
      <EmptyState.Title>
        <h2>No volunteers yet</h2>
      </EmptyState.Title>
      <EmptyState.Description>
        Share the signup link or add a volunteer manually.
      </EmptyState.Description>
      <EmptyState.Actions>
        <Button type="button" onClick={() => setCopied(true)}>
          Copy signup link
        </Button>
        <a
          href="#add-volunteer"
          className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          Add volunteer
        </a>
      </EmptyState.Actions>
      {copied ? <output>Signup link copied</output> : null}
    </EmptyState.Card>
  )
}

export const PrimaryAndSecondaryActions: Story = {
  render: () => <ActionExample />,
  play: async ({ canvasElement }) => {
    // @lat: [[lat.md/ui-library#UI Library#Storybook contract#Empty state action story]]
    const canvas = within(canvasElement)
    const copyButton = canvas.getByRole("button", { name: "Copy signup link" })
    const addLink = canvas.getByRole("link", { name: "Add volunteer" })

    await userEvent.click(copyButton)
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Signup link copied",
    )
    await expect(addLink).toHaveAttribute("href", "#add-volunteer")

    await userEvent.click(document.body)
    await userEvent.tab()
    await expect(copyButton).toHaveFocus()
    await userEvent.tab()
    await expect(addLink).toHaveFocus()
  },
}

function FilteredResultsExample() {
  const [cleared, setCleared] = useState(false)

  return (
    // biome-ignore lint/a11y/useSemanticElements: Root intentionally forwards caller-owned live-region semantics.
    <EmptyState.Root role="status" aria-live="polite">
      <EmptyState.Icon>
        <ListFilter />
      </EmptyState.Icon>
      <EmptyState.Title>
        <h2>{cleared ? "Filters cleared" : "No workouts match"}</h2>
      </EmptyState.Title>
      <EmptyState.Description>
        {cleared
          ? "All workouts are ready to load."
          : "No workouts match the selected movement and date range."}
      </EmptyState.Description>
      {!cleared ? (
        <EmptyState.Actions>
          <Button type="button" onClick={() => setCleared(true)}>
            Clear filters
          </Button>
        </EmptyState.Actions>
      ) : null}
    </EmptyState.Root>
  )
}

export const DynamicFilteredResults: Story = {
  render: () => <FilteredResultsExample />,
  play: async ({ canvasElement }) => {
    // @lat: [[lat.md/ui-library#UI Library#Storybook contract#Dynamic empty state story]]
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Clear filters" }))
    await expect(
      canvas.getByRole("heading", { level: 2, name: "Filters cleared" }),
    ).toBeVisible()
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "All workouts are ready to load.",
    )
  },
}

const mobileWidths = [320, 390] as const

export const LongContentMobile: Story = {
  render: () => (
    <div className="flex w-full flex-col items-start gap-6">
      {mobileWidths.map((width) => (
        <div
          key={width}
          data-testid={`empty-mobile-${width}`}
          className="max-w-full overflow-hidden border border-dashed border-border"
          style={{ width }}
        >
          <EmptyState.Card>
            <EmptyState.Title>
              <h2>
                No multi-venue volunteer assignments match this translated
                scheduling filter
              </h2>
            </EmptyState.Title>
            <EmptyState.Description>
              Adjust the competition day, venue, role, and certification filters
              to broaden the results available to this coordinator.
            </EmptyState.Description>
            <EmptyState.Actions>
              <Button type="button">Reset every scheduling filter</Button>
              <a href="#filter-help">Read filtering guidance</a>
            </EmptyState.Actions>
          </EmptyState.Card>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    // @lat: [[lat.md/ui-library#UI Library#Storybook contract#Mobile empty state story]]
    const canvas = within(canvasElement)
    for (const width of mobileWidths) {
      const frame = canvas.getByTestId(`empty-mobile-${width}`)
      await expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth)
    }
  },
}

export const HeadingLevels: Story = {
  render: () => (
    <div className="grid gap-6 md:grid-cols-2">
      <EmptyState.Root aria-label="Page-level example">
        <EmptyState.Title>
          <h1>Nothing scheduled today</h1>
        </EmptyState.Title>
      </EmptyState.Root>
      <EmptyState.Card aria-label="Section-level example">
        <EmptyState.Title>
          <h4>No judges assigned</h4>
        </EmptyState.Title>
      </EmptyState.Card>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // @lat: [[lat.md/ui-library#UI Library#Storybook contract#Empty state heading levels story]]
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", {
        level: 1,
        name: "Nothing scheduled today",
      }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("heading", { level: 4, name: "No judges assigned" }),
    ).toBeVisible()
  },
}

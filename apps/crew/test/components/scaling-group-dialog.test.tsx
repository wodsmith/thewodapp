// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  success: vi.fn(),
  close: vi.fn(),
  dropTargets: [] as Array<{ onDrop: (payload: unknown) => void }>,
}))

vi.mock("@atlaskit/pragmatic-drag-and-drop/combine", () => ({
  combine: (...cleanups: Array<() => void>) => () => {
    for (const cleanup of cleanups) cleanup()
  },
}))

vi.mock("@atlaskit/pragmatic-drag-and-drop/element/adapter", () => ({
  draggable: () => () => undefined,
  dropTargetForElements: (options: { onDrop: (payload: unknown) => void }) => {
    mocks.dropTargets.push(options)
    return () => undefined
  },
}))

vi.mock("@/server-fns/scaling-fns", () => ({
  createScalingGroupFn: mocks.create,
  getScalingGroupWithLevelsFn: mocks.get,
  updateScalingGroupFn: mocks.update,
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

import { ScalingGroupDialog } from "@/components/scaling-group-dialog"

type Props = ComponentProps<typeof ScalingGroupDialog>

const existingGroup = {
  id: "group_1",
  title: "Existing levels",
  description: "Loaded description",
  teamId: "team_1",
  isDefault: false,
  isSystem: false,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  levels: [],
} as Props["group"]

function props(overrides: Partial<Props> = {}): Props {
  return {
    teamId: "team_1",
    open: true,
    onClose: mocks.close,
    onSuccess: mocks.success,
    ...overrides,
  }
}

describe("Crew scaling group dialog field composition", () => {
  beforeEach(() => {
    mocks.create.mockReset().mockResolvedValue({ success: true })
    mocks.get.mockReset()
    mocks.update.mockReset().mockResolvedValue({ success: true })
    mocks.success.mockReset()
    mocks.close.mockReset()
    mocks.dropTargets.length = 0
  })

  // @lat: [[ui-library#UI Library#Current boundary#Field composition#Scaling level field groups#Crew scaling level create]]
  it("supports a named levels group and preserves reordered create payloads", async () => {
    render(<ScalingGroupDialog {...props()} />)

    const group = screen.getByRole("group", { name: "Scaling Levels" })
    expect(group).toHaveAccessibleDescription(
      "Drag to reorder. Top = Hardest, Bottom = Easiest",
    )
    expect(
      screen.getByRole("textbox", { name: "Scaling level 1: Rx" }),
    ).toBeVisible()
    expect(
      screen.getByRole("textbox", { name: "Scaling level 2: Scaled" }),
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Reorder scaling level 1: Rx" }),
    ).toBeVisible()

    act(() => {
      mocks.dropTargets[1]?.onDrop({ source: { data: { index: 0 } } })
    })
    expect(
      screen.getByRole("textbox", { name: "Scaling level 1: Scaled" }),
    ).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Add level" }))
    expect(
      screen.getByRole("textbox", { name: "Scaling level 3" }),
    ).toBeVisible()
    fireEvent.click(
      screen.getByRole("button", { name: "Remove scaling level 3" }),
    )
    expect(
      screen.queryByRole("textbox", { name: "Scaling level 3" }),
    ).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
      target: { value: "Competition levels" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith({
        data: {
          teamId: "team_1",
          title: "Competition levels",
          description: undefined,
          levels: [
            { label: "Scaled", position: 0 },
            { label: "Rx", position: 1 },
          ],
        },
      }),
    )
  })

  // @lat: [[ui-library#UI Library#Current boundary#Field composition#Scaling level field groups#Crew scaling level validation]]
  it("renders a levels validation error without a form-context crash", async () => {
    render(<ScalingGroupDialog {...props()} />)

    fireEvent.change(
      screen.getByRole("textbox", { name: "Scaling level 1: Rx" }),
      { target: { value: "" } },
    )
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
      target: { value: "Competition levels" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create" }))

    const error = await screen.findByRole("alert")
    expect(error).toHaveTextContent("Label is required")
    expect(
      screen.getByRole("group", { name: "Scaling Levels" }),
    ).toHaveAttribute("aria-invalid", "true")
    expect(mocks.create).not.toHaveBeenCalled()
  })

  // @lat: [[ui-library#UI Library#Current boundary#Field composition#Scaling level field groups#Crew scaling level update]]
  it("shows the edit-mode note and preserves the canonical update payload", async () => {
    mocks.get.mockResolvedValue({
      scalingGroup: {
        ...existingGroup,
        levels: [
          { id: "level_2", label: "Scaled", position: 1 },
          { id: "level_1", label: "Rx", position: 0 },
        ],
      },
    })

    render(<ScalingGroupDialog {...props({ group: existingGroup })} />)

    expect(
      await screen.findByRole("textbox", { name: "Scaling level 1: Rx" }),
    ).toBeVisible()
    expect(
      screen.getByText("Note: Level changes are only applied on creation."),
    ).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Update" }))

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        data: {
          groupId: "group_1",
          teamId: "team_1",
          title: "Existing levels",
          description: "Loaded description",
        },
      }),
    )
  })
})

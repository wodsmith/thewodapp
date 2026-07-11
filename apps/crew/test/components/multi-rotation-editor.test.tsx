// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  success: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

vi.mock("@/components/ui/searchable-select", () => ({
  SearchableSelect: ({
    options,
    value,
    onValueChange,
  }: {
    options: Array<{ value: string; label: string }>
    value: string
    onValueChange: (value: string) => void
  }) => (
    <select
      aria-label="Judge"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    >
      <option value="">Select a judge</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}))

import { MultiRotationEditor } from "@/routes/events/$eventId/-components/judges/multi-rotation-editor"

type Props = ComponentProps<typeof MultiRotationEditor>

const judge = {
  membershipId: "tmem_judge",
  source: "membership",
  sourceId: "tmem_judge",
  invitationId: null,
  userId: "user_judge",
  firstName: "Jamie",
  lastName: "Judge",
  email: "jamie@example.com",
  avatar: null,
  volunteerRoleTypes: ["judge"],
}

function props(overrides: Partial<Props> = {}): Props {
  return {
    minHeat: 1,
    maxHeat: 8,
    maxLanes: 4,
    heats: Array.from({ length: 8 }, (_, index) => ({
      heatNumber: index + 1,
      laneCount: 4,
    })),
    availableJudges: [judge],
    rotationsByVolunteer: new Map(),
    activeBlockIndex: 0,
    onActiveBlockChange: vi.fn(),
    eventLaneShiftPattern: "stay",
    eventDefaultHeatsCount: 3,
    onSave: mocks.save,
    onSuccess: mocks.success,
    onCancel: vi.fn(),
    ...overrides,
  } as Props
}

describe("Crew multi-rotation editor field composition", () => {
  beforeEach(() => {
    mocks.save.mockResolvedValue(undefined)
  })

  // @lat: [[ui-library#UI Library#Current boundary#Field composition#Rotation editor field groups#Crew rotation editor group#Crew rotation create]]
  it("renders create state as a named group and preserves the save payload", async () => {
    const { container } = render(<MultiRotationEditor {...props()} />)

    expect(screen.getByRole("group", { name: "Rotations" })).toBeVisible()
    const judgeField = screen.getByRole("combobox", { name: "Judge" })
    fireEvent.change(judgeField, { target: { value: "tmem_judge" } })

    fireEvent.click(screen.getByRole("button", { name: "Add rotation" }))
    expect(screen.getByRole("button", { name: /Rotation 2/ })).toBeVisible()
    const removeButton = container
      .querySelector(".lucide-trash2")
      ?.closest("button")
    expect(removeButton).not.toBeNull()
    fireEvent.click(removeButton as HTMLButtonElement)
    expect(screen.queryByRole("button", { name: /Rotation 2/ })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Create rotations" }))

    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith("tmem_judge", [
        {
          startingHeat: 1,
          startingLane: 1,
          heatsCount: 3,
          notes: "",
        },
      ]),
    )
  })

  // @lat: [[ui-library#UI Library#Current boundary#Field composition#Rotation editor field groups#Crew rotation editor group#Crew rotation update]]
  it("renders existing rotations and preserves the update payload", async () => {
    const existingRotations = [
      {
        membershipId: "tmem_judge",
        invitationId: null,
        startingHeat: 2,
        startingLane: 3,
        heatsCount: 2,
        notes: "North floor",
      },
    ] as Props["existingRotations"]

    render(<MultiRotationEditor {...props({ existingRotations })} />)

    expect(screen.getByRole("button", { name: /Rotation 1.*Heats 2 - 3/ })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Update rotations" }))

    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith("tmem_judge", [
        {
          startingHeat: 2,
          startingLane: 3,
          heatsCount: 2,
          notes: "North floor",
        },
      ]),
    )
  })
})

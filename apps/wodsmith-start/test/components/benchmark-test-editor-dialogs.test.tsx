import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  AddTestDialog,
  type AddTestDialogProps,
  EditTestDialog,
  type EditableTest,
  type EditTestDialogProps,
} from "@/components/benchmark-tiers/test-editor-dialogs"

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

import { toast } from "sonner"

const CATEGORIES = [
  { key: "strength", label: "Strength" },
  { key: "engine", label: "Conditioning" },
]

function renderAddDialog(overrides: Partial<AddTestDialogProps> = {}) {
  const onCreate = vi.fn().mockResolvedValue(undefined)
  const props: AddTestDialogProps = {
    categories: CATEGORIES,
    defaultCategoryKey: "strength",
    maxTier: 3,
    variants: ["male", "female"],
    onCreate,
    ...overrides,
  }
  render(<AddTestDialog {...props} />)
  return { onCreate, props }
}

function openAddDialog() {
  fireEvent.click(screen.getByRole("button", { name: /add event tiers/i }))
}

function fillThresholds(variants: string[], maxTier: number, value = "10") {
  for (const variant of variants) {
    for (let tier = 1; tier <= maxTier; tier++) {
      fireEvent.change(screen.getByLabelText(`${variant} T${tier}`), {
        target: { value: `${value}${tier}` },
      })
    }
  }
}

function makeEditableTest(overrides: Partial<EditableTest> = {}): EditableTest {
  return {
    id: "test-1",
    name: "Max pull-ups",
    categoryKey: "strength",
    scheme: "reps",
    scoreType: "max",
    inputUnit: "reps",
    includedInScoring: true,
    hasCompleteThresholds: true,
    ...overrides,
  }
}

function renderEditDialog(overrides: Partial<EditTestDialogProps> = {}) {
  const onUpdate = vi.fn().mockResolvedValue(undefined)
  const onDelete = vi.fn().mockResolvedValue(undefined)
  const props: EditTestDialogProps = {
    test: makeEditableTest(),
    categories: CATEGORIES,
    maxTier: 3,
    variants: ["male", "female"],
    onUpdate,
    onDelete,
    ...overrides,
  }
  render(<EditTestDialog {...props} />)
  return { onUpdate, onDelete, props }
}

describe("AddTestDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("keeps create disabled until name and all threshold cells are filled", () => {
    renderAddDialog()
    openAddDialog()

    const createButton = screen.getByRole("button", { name: /create event tiers/i })
    expect(createButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/test name/i), {
      target: { value: "Max pull-ups" },
    })
    // Name present but thresholds still empty -> still disabled
    expect(createButton).toBeDisabled()

    fillThresholds(["male", "female"], 3)
    expect(createButton).toBeEnabled()
  })

  it("submits a create payload with one threshold per variant x tier", async () => {
    const { onCreate } = renderAddDialog()
    openAddDialog()

    fireEvent.change(screen.getByLabelText(/test name/i), {
      target: { value: "  Max pull-ups  " },
    })
    fillThresholds(["male", "female"], 3)

    fireEvent.click(screen.getByRole("button", { name: /create event tiers/i }))

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    const payload = onCreate.mock.calls[0][0]
    expect(payload).toMatchObject({
      name: "Max pull-ups",
      categoryKey: "strength",
      scheme: "reps",
      scoreType: "max",
      inputUnit: "reps",
      includedInScoring: true,
    })
    expect(payload.thresholds).toHaveLength(6) // 2 variants x 3 tiers
    expect(payload.thresholds).toEqual(
      expect.arrayContaining([
        { variant: "male", tier: 1, rawValue: "101" },
        { variant: "female", tier: 3, rawValue: "103" },
      ]),
    )
    // No event picked -> no link
    expect(onCreate.mock.calls[0][1]).toBeNull()
  })

  it("auto-selects the time input unit when a time scheme is picked", () => {
    renderAddDialog()
    openAddDialog()

    fireEvent.click(screen.getByLabelText(/scheme/i))
    fireEvent.click(screen.getByRole("option", { name: "time" }))
    expect(screen.getByLabelText(/input unit/i)).toHaveTextContent("Time")
    expect(screen.getByLabelText(/input unit/i)).toBeDisabled()

    // EMOM results are entered as times too.
    fireEvent.click(screen.getByLabelText(/scheme/i))
    fireEvent.click(screen.getByRole("option", { name: "emom" }))
    expect(screen.getByLabelText(/input unit/i)).toHaveTextContent("Time")

    // Leaving the time scheme drops the auto-picked unit again.
    fireEvent.click(screen.getByLabelText(/scheme/i))
    fireEvent.click(screen.getByRole("option", { name: "load" }))
    expect(screen.getByLabelText(/input unit/i)).toHaveTextContent("Reps")
    expect(screen.getByLabelText(/input unit/i)).toBeEnabled()
  })

  it("prefills name, scheme, score type, and input unit from the selected event", () => {
    renderAddDialog({
      events: [
        {
          id: "tw-1",
          name: "Event 1 - Mile Run",
          linkedTestName: null,
          scheme: "time",
          scoreType: "min",
        },
        {
          id: "tw-2",
          name: "Event 2 - Max Snatch",
          linkedTestName: null,
          scheme: "load",
          scoreType: "max",
          categoryKey: "engine",
          inputUnit: "lb",
        },
      ],
    })
    openAddDialog()

    fireEvent.click(screen.getByLabelText(/linked event/i))
    fireEvent.click(screen.getByRole("option", { name: "Event 1 - Mile Run" }))

    expect(screen.getByLabelText(/test name/i)).toHaveValue("Event 1 - Mile Run")
    expect(screen.getByLabelText(/scheme/i)).toHaveTextContent("time")
    expect(screen.getByLabelText(/score type/i)).toHaveTextContent("min")
    expect(screen.getByLabelText(/input unit/i)).toHaveTextContent("Time")

    fireEvent.click(screen.getByLabelText(/linked event/i))
    fireEvent.click(screen.getByRole("option", { name: "Event 2 - Max Snatch" }))
    expect(screen.getByLabelText(/category/i)).toHaveTextContent("Conditioning")
    expect(screen.getByLabelText(/input unit/i)).toHaveTextContent("Pounds")
  })

  it("swaps event-derived names but never clobbers a manually typed name", () => {
    renderAddDialog({
      events: [
        {
          id: "tw-1",
          name: "Event 1 - Mile Run",
          linkedTestName: null,
          scheme: "time",
          scoreType: "min",
        },
        {
          id: "tw-2",
          name: "Event 2 - Max Snatch",
          linkedTestName: null,
          scheme: "load",
          scoreType: "max",
        },
      ],
    })
    openAddDialog()

    // Switching events replaces a name that came from the previous event.
    fireEvent.click(screen.getByLabelText(/linked event/i))
    fireEvent.click(screen.getByRole("option", { name: "Event 1 - Mile Run" }))
    fireEvent.click(screen.getByLabelText(/linked event/i))
    fireEvent.click(screen.getByRole("option", { name: "Event 2 - Max Snatch" }))
    expect(screen.getByLabelText(/test name/i)).toHaveValue(
      "Event 2 - Max Snatch",
    )

    // A manual edit sticks even when picking another event afterwards.
    fireEvent.change(screen.getByLabelText(/test name/i), {
      target: { value: "My custom test" },
    })
    fireEvent.click(screen.getByLabelText(/linked event/i))
    fireEvent.click(screen.getByRole("option", { name: "Event 1 - Mile Run" }))
    expect(screen.getByLabelText(/test name/i)).toHaveValue("My custom test")
    expect(screen.getByLabelText(/scheme/i)).toHaveTextContent("time")
  })

  it("prefills fields from the locked event when opened from an event page", () => {
    renderAddDialog({
      events: [
        {
          id: "tw-1",
          name: "Event 1 - Row Sprint",
          linkedTestName: null,
          scheme: "time-with-cap",
          scoreType: "min",
        },
      ],
      defaultEventId: "tw-1",
      lockEvent: true,
    })
    openAddDialog()

    expect(screen.getByLabelText(/test name/i)).toHaveValue(
      "Event 1 - Row Sprint",
    )
    expect(screen.getByLabelText(/scheme/i)).toHaveTextContent("time-with-cap")
    expect(screen.getByLabelText(/score type/i)).toHaveTextContent("min")
    expect(screen.getByLabelText(/input unit/i)).toHaveTextContent("Time")
  })

  // @lat: [[organizer-dashboard#Organizer Dashboard#Benchmark Tier Scoring#Test-Event Linking#Inline Event Tiers Creation]]
  it("locks the linked event and passes it to onCreate when opened from an event page", async () => {
    const { onCreate } = renderAddDialog({
      events: [
        { id: "tw-1", name: "Event 1 - Strict Press", linkedTestName: null },
      ],
      defaultEventId: "tw-1",
      lockEvent: true,
    })
    openAddDialog()

    // Locked mode shows the event statically instead of a picker
    expect(screen.getByText("Event 1 - Strict Press")).toBeInTheDocument()
    expect(screen.queryByLabelText(/linked event/i)).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/test name/i), {
      target: { value: "Strict Press" },
    })
    fillThresholds(["male", "female"], 3)
    fireEvent.click(screen.getByRole("button", { name: /create event tiers/i }))

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    expect(onCreate.mock.calls[0][1]).toBe("tw-1")
  })

  it("omits thresholds and hides the grid when not included in scoring", async () => {
    const { onCreate } = renderAddDialog()
    openAddDialog()

    fireEvent.change(screen.getByLabelText(/test name/i), {
      target: { value: "Deferred test" },
    })
    fireEvent.click(screen.getByLabelText(/included in scoring/i))

    expect(screen.queryByLabelText("male T1")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /create event tiers/i }))

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    const payload = onCreate.mock.calls[0][0]
    expect(payload.includedInScoring).toBe(false)
    expect(payload.thresholds).toBeUndefined()
  })

  it("shows an error toast when create rejects and stays open", async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error("boom"))
    renderAddDialog({ onCreate })
    openAddDialog()

    fireEvent.change(screen.getByLabelText(/test name/i), {
      target: { value: "Max pull-ups" },
    })
    fillThresholds(["male", "female"], 3)
    fireEvent.click(screen.getByRole("button", { name: /create event tiers/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("boom"))
    expect(
      screen.getByRole("button", { name: /create event tiers/i }),
    ).toBeInTheDocument()
  })
})

describe("EditTestDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function openEditDialog() {
    fireEvent.click(screen.getByRole("button", { name: /edit max pull-ups/i }))
  }

  it("keeps save disabled until a field changes", () => {
    renderEditDialog()
    openEditDialog()

    const saveButton = screen.getByRole("button", { name: /save changes/i })
    expect(saveButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/test name/i), {
      target: { value: "Renamed test" },
    })
    expect(saveButton).toBeEnabled()
  })

  it("sends only the changed fields to onUpdate", async () => {
    const { onUpdate } = renderEditDialog()
    openEditDialog()

    fireEvent.change(screen.getByLabelText(/test name/i), {
      target: { value: "Renamed test" },
    })
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }))

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1))
    expect(onUpdate).toHaveBeenCalledWith("test-1", { name: "Renamed test" })
  })

  it("auto-selects the time input unit when the scheme becomes time-based", async () => {
    const { onUpdate } = renderEditDialog()
    openEditDialog()

    fireEvent.click(screen.getByLabelText(/scheme/i))
    fireEvent.click(screen.getByRole("option", { name: "time-with-cap" }))
    expect(screen.getByLabelText(/input unit/i)).toHaveTextContent("Time")

    // Leaving the time scheme falls back to the test's original unit.
    fireEvent.click(screen.getByLabelText(/scheme/i))
    fireEvent.click(screen.getByRole("option", { name: "load" }))
    expect(screen.getByLabelText(/input unit/i)).toHaveTextContent("Reps")

    fireEvent.click(screen.getByLabelText(/scheme/i))
    fireEvent.click(screen.getByRole("option", { name: "time" }))
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }))

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1))
    expect(onUpdate).toHaveBeenCalledWith("test-1", {
      scheme: "time",
      inputUnit: "time",
    })
  })

  it("repairs a stale non-time unit when saving a time-based test", async () => {
    const { onUpdate } = renderEditDialog({
      test: makeEditableTest({ scheme: "time", scoreType: "min" }),
    })
    openEditDialog()

    expect(screen.getByLabelText(/input unit/i)).toHaveTextContent("Time")
    expect(screen.getByLabelText(/input unit/i)).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/test name/i), {
      target: { value: "Timed pull-ups" },
    })
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }))

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1))
    expect(onUpdate).toHaveBeenCalledWith("test-1", {
      name: "Timed pull-ups",
      inputUnit: "time",
    })
  })

  it("requires a threshold grid when re-including a test without complete thresholds", async () => {
    const { onUpdate } = renderEditDialog({
      test: makeEditableTest({
        includedInScoring: false,
        hasCompleteThresholds: false,
      }),
    })
    openEditDialog()

    // Toggle from deferred -> included reveals the required grid.
    expect(screen.queryByLabelText("male T1")).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/included in scoring/i))
    expect(screen.getByLabelText("male T1")).toBeInTheDocument()

    // Save blocked until every cell is filled.
    expect(
      screen.getByRole("button", { name: /save changes/i }),
    ).toBeDisabled()

    fillThresholds(["male", "female"], 3)
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }))

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1))
    const [, updates] = onUpdate.mock.calls[0]
    expect(updates.includedInScoring).toBe(true)
    expect(updates.thresholds).toHaveLength(6)
  })

  it("labels hybrid threshold cells with reps below the flip and mm:ss at/above", () => {
    renderEditDialog({
      test: makeEditableTest({
        includedInScoring: false,
        hasCompleteThresholds: false,
        scoreModel: "hybrid",
        hybridFlipTier: 2,
      }),
    })
    openEditDialog()

    // Reveal the grid so its inputs render with hybrid placeholders.
    fireEvent.click(screen.getByLabelText(/included in scoring/i))

    expect(screen.getByLabelText("male T1")).toHaveAttribute(
      "placeholder",
      "reps",
    )
    expect(screen.getByLabelText("male T2")).toHaveAttribute(
      "placeholder",
      "mm:ss",
    )
    expect(screen.getByLabelText("male T3")).toHaveAttribute(
      "placeholder",
      "mm:ss",
    )
  })

  it("does not show the grid when re-including a test that already has thresholds", () => {
    renderEditDialog({
      test: makeEditableTest({
        includedInScoring: false,
        hasCompleteThresholds: true,
      }),
    })
    openEditDialog()

    fireEvent.click(screen.getByLabelText(/included in scoring/i))
    expect(screen.queryByLabelText("male T1")).not.toBeInTheDocument()
  })

  it("requires confirmation before deleting", async () => {
    const { onDelete } = renderEditDialog()
    openEditDialog()

    fireEvent.click(screen.getByRole("button", { name: /delete test/i }))

    // Confirmation dialog names the test.
    expect(
      screen.getByRole("alertdialog", { name: /delete max pull-ups/i }),
    ).toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }))

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("test-1"))
  })
})

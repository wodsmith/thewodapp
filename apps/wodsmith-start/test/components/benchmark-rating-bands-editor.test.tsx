import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  type RatingBandDraft,
  RatingBandsEditor,
  type RatingBandsEditorProps,
} from "@/components/benchmark-tiers/rating-bands-editor"

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

/**
 * Tests for RatingBandsEditor.
 *
 * Editable rating bands (label + min/max score) for a benchmark battery.
 * Validates client-side (label required, min<=max, 0..scoreMax bounds,
 * no overlapping ranges, no duplicate keys) and saves bands sorted by
 * minScore via the onSave callback.
 */

function defaultBands(): RatingBandDraft[] {
  return [
    { key: "elite", label: "Elite", minScore: 80, maxScore: 100 },
    { key: "competitive", label: "Competitive", minScore: 50, maxScore: 79 },
    { key: "developing", label: "Developing", minScore: 0, maxScore: 49 },
  ]
}

function renderEditor(props: Partial<RatingBandsEditorProps> = {}) {
  const onSave = props.onSave ?? vi.fn().mockResolvedValue(undefined)
  const defaultProps: RatingBandsEditorProps = {
    bands: defaultBands(),
    scoreMax: 100,
    disabled: false,
    onSave,
    ...props,
  }
  return {
    ...render(<RatingBandsEditor {...defaultProps} />),
    onSave: defaultProps.onSave,
  }
}

function saveButton() {
  return screen.getByRole("button", { name: /save rating bands/i })
}

describe("RatingBandsEditor", () => {
  describe("Rendering", () => {
    it("renders a row per band with its values", () => {
      renderEditor()

      expect(screen.getByLabelText("Rating band 1 label")).toHaveValue("Elite")
      expect(screen.getByLabelText("Rating band 1 minimum score")).toHaveValue(
        80,
      )
      expect(screen.getByLabelText("Rating band 1 maximum score")).toHaveValue(
        100,
      )
      expect(
        screen.getAllByRole("button", { name: /remove rating band/i }),
      ).toHaveLength(3)
    })

    it("disables Save when there are no changes", () => {
      renderEditor()
      expect(saveButton()).toBeDisabled()
    })

    it("disables all controls when disabled prop is true", () => {
      renderEditor({ disabled: true })
      expect(screen.getByLabelText("Rating band 1 label")).toBeDisabled()
      expect(
        screen.getByRole("button", { name: /add band/i }),
      ).toBeDisabled()
      expect(saveButton()).toBeDisabled()
    })
  })

  describe("Add and remove", () => {
    it("adds a new band row", () => {
      renderEditor()

      fireEvent.click(screen.getByRole("button", { name: /add band/i }))

      expect(
        screen.getAllByRole("button", { name: /remove rating band/i }),
      ).toHaveLength(4)
    })

    it("removes a band row", () => {
      renderEditor()

      const removeButtons = screen.getAllByRole("button", {
        name: /remove rating band/i,
      })
      fireEvent.click(removeButtons[0])

      expect(
        screen.getAllByRole("button", { name: /remove rating band/i }),
      ).toHaveLength(2)
    })
  })

  describe("Validation", () => {
    it("blocks save when a range is out of bounds", () => {
      renderEditor()

      fireEvent.change(screen.getByLabelText("Rating band 1 maximum score"), {
        target: { value: "150" },
      })

      expect(screen.getByText(/max score: 0–100/i)).toBeInTheDocument()
      expect(saveButton()).toBeDisabled()
    })

    it("blocks save when min is greater than max", () => {
      renderEditor()

      // Invert the "Elite" band (row 1, 80-100) by dropping its max below min.
      fireEvent.change(screen.getByLabelText("Rating band 1 maximum score"), {
        target: { value: "70" },
      })

      expect(screen.getByText(/max must be ≥ min/i)).toBeInTheDocument()
      expect(saveButton()).toBeDisabled()
    })

    it("blocks save when existing bands share a key", () => {
      renderEditor({
        bands: [
          { key: "elite", label: "Elite", minScore: 80, maxScore: 100 },
          { key: "elite", label: "Elite Again", minScore: 0, maxScore: 79 },
        ],
      })

      // Make a valid edit so only the duplicate key keeps Save disabled.
      fireEvent.change(screen.getByLabelText("Rating band 1 label"), {
        target: { value: "Elite Tier" },
      })

      expect(screen.getAllByText(/duplicate key "elite"/i)).toHaveLength(2)
      expect(saveButton()).toBeDisabled()
    })

    it("blocks save when ranges overlap", () => {
      renderEditor()

      // Widen the "Competitive" band (row 2, 50-79) to overlap "Elite" (80-100)
      fireEvent.change(screen.getByLabelText("Rating band 2 maximum score"), {
        target: { value: "90" },
      })

      expect(
        screen.getAllByText(/range overlaps another band/i).length,
      ).toBeGreaterThan(0)
      expect(saveButton()).toBeDisabled()
    })

    it("blocks save when a label is empty", () => {
      renderEditor()

      fireEvent.change(screen.getByLabelText("Rating band 1 label"), {
        target: { value: "" },
      })

      expect(screen.getByText(/label is required/i)).toBeInTheDocument()
      expect(saveButton()).toBeDisabled()
    })
  })

  describe("Saving", () => {
    it("calls onSave with bands sorted by minScore", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined)
      renderEditor({ onSave })

      // Make a valid edit to dirty the form.
      fireEvent.change(screen.getByLabelText("Rating band 1 label"), {
        target: { value: "Elite Tier" },
      })

      fireEvent.click(saveButton())

      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))

      const saved = onSave.mock.calls[0][0] as RatingBandDraft[]
      expect(saved.map((band) => band.minScore)).toEqual([0, 50, 80])
      expect(saved).toContainEqual({
        key: "elite",
        label: "Elite Tier",
        minScore: 80,
        maxScore: 100,
      })
    })

    it("auto-slugs a key for a newly added band", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined)
      renderEditor({
        bands: [{ key: "base", label: "Base", minScore: 0, maxScore: 40 }],
        onSave,
      })

      fireEvent.click(screen.getByRole("button", { name: /add band/i }))

      fireEvent.change(screen.getByLabelText("Rating band 2 label"), {
        target: { value: "Top Athlete" },
      })
      fireEvent.change(screen.getByLabelText("Rating band 2 minimum score"), {
        target: { value: "41" },
      })
      fireEvent.change(screen.getByLabelText("Rating band 2 maximum score"), {
        target: { value: "100" },
      })

      fireEvent.click(saveButton())

      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
      const saved = onSave.mock.calls[0][0] as RatingBandDraft[]
      expect(saved).toContainEqual({
        key: "top_athlete",
        label: "Top Athlete",
        minScore: 41,
        maxScore: 100,
      })
    })

    it("shows an error toast when onSave rejects", async () => {
      const { toast } = await import("sonner")
      const onSave = vi.fn().mockRejectedValue(new Error("nope"))
      renderEditor({ onSave })

      fireEvent.change(screen.getByLabelText("Rating band 1 label"), {
        target: { value: "Elite Tier" },
      })
      fireEvent.click(saveButton())

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("nope"))
    })
  })
})

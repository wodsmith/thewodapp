import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  CategoriesManager,
  type CategorySummaryItem,
} from "@/components/benchmark-tiers/categories-manager"

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

import { toast } from "sonner"

function createCategories(
  overrides: Partial<CategorySummaryItem>[] = [],
): CategorySummaryItem[] {
  const base: CategorySummaryItem[] = [
    { key: "strength", label: "Strength", weight: 1, totalTestCount: 2 },
    { key: "engine", label: "Engine", weight: 2, totalTestCount: 0 },
  ]
  return overrides.length > 0
    ? overrides.map((o, i) => ({ ...base[i], ...o }))
    : base
}

describe("CategoriesManager", () => {
  let onSave: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onSave = vi.fn().mockResolvedValue(undefined)
    vi.clearAllMocks()
  })

  it("renders an inline row per category with its share of the overall score", () => {
    render(<CategoriesManager categories={createCategories()} onSave={onSave} />)

    const labelInputs = screen.getAllByPlaceholderText("Category label")
    expect(labelInputs).toHaveLength(2)
    expect(labelInputs[0]).toHaveValue("Strength")
    expect(labelInputs[1]).toHaveValue("Engine")
    // Weight is explained as a concrete share of the overall score
    expect(
      screen.getByText(/2 tests · counts for 33% of the overall score/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/0 tests · counts for 67% of the overall score/i),
    ).toBeInTheDocument()
  })

  it("disables delete when the category still has tests", () => {
    render(<CategoriesManager categories={createCategories()} onSave={onSave} />)

    // Strength has 2 tests -> delete disabled
    expect(screen.getByRole("button", { name: /delete strength/i })).toBeDisabled()
    // Engine has 0 tests -> delete enabled
    expect(
      screen.getByRole("button", { name: /delete engine/i }),
    ).not.toBeDisabled()
  })

  it("reorders categories in the array passed to onSave", async () => {
    render(<CategoriesManager categories={createCategories()} onSave={onSave} />)

    fireEvent.click(screen.getByRole("button", { name: /move strength down/i }))
    fireEvent.click(screen.getByRole("button", { name: /save categories/i }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave).toHaveBeenCalledWith([
      { key: "engine", label: "Engine", weight: 2 },
      { key: "strength", label: "Strength", weight: 1 },
    ])
  })

  it("auto-slugs the key for an added category and sends it without testCount", async () => {
    render(<CategoriesManager categories={createCategories()} onSave={onSave} />)

    fireEvent.click(screen.getByRole("button", { name: /add category/i }))

    const labelInputs = screen.getAllByPlaceholderText("Category label")
    fireEvent.change(labelInputs[labelInputs.length - 1], {
      target: { value: "Power Endurance!" },
    })

    fireEvent.click(screen.getByRole("button", { name: /save categories/i }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const saved = onSave.mock.calls[0][0]
    expect(saved).toContainEqual({
      key: "power_endurance",
      label: "Power Endurance!",
      weight: 1,
    })
    // Server recomputes testCount; the client never sends it.
    for (const category of saved) {
      expect(category).not.toHaveProperty("totalTestCount")
      expect(category).not.toHaveProperty("testCount")
    }
  })

  it("dedupes an added key that collides with an existing one", async () => {
    render(<CategoriesManager categories={createCategories()} onSave={onSave} />)

    fireEvent.click(screen.getByRole("button", { name: /add category/i }))
    const labelInputs = screen.getAllByPlaceholderText("Category label")
    fireEvent.change(labelInputs[labelInputs.length - 1], {
      target: { value: "Strength" },
    })

    fireEvent.click(screen.getByRole("button", { name: /save categories/i }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const saved = onSave.mock.calls[0][0]
    expect(saved).toContainEqual({
      key: "strength_2",
      label: "Strength",
      weight: 1,
    })
  })

  it("blocks save when a weight is not positive", () => {
    render(<CategoriesManager categories={createCategories()} onSave={onSave} />)

    const weightInputs = screen.getAllByPlaceholderText("Weight")
    fireEvent.change(weightInputs[1], { target: { value: "0" } })

    expect(
      screen.getByRole("button", { name: /save categories/i }),
    ).toBeDisabled()
  })

  it("blocks save when nothing has changed", () => {
    render(<CategoriesManager categories={createCategories()} onSave={onSave} />)

    expect(
      screen.getByRole("button", { name: /save categories/i }),
    ).toBeDisabled()
  })

  it("surfaces a toast when onSave rejects", async () => {
    onSave.mockRejectedValueOnce(new Error("nope"))
    render(<CategoriesManager categories={createCategories()} onSave={onSave} />)

    const labelInputs = screen.getAllByPlaceholderText("Category label")
    fireEvent.change(labelInputs[0], { target: { value: "Strength Renamed" } })
    fireEvent.click(screen.getByRole("button", { name: /save categories/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("nope"))
  })

  it("blocks save when the disabled prop is set even with edits", () => {
    render(
      <CategoriesManager categories={createCategories()} onSave={onSave} disabled />,
    )

    const labelInputs = screen.getAllByPlaceholderText("Category label")
    fireEvent.change(labelInputs[0], { target: { value: "Strength Renamed" } })

    expect(
      screen.getByRole("button", { name: /save categories/i }),
    ).toBeDisabled()
  })
})

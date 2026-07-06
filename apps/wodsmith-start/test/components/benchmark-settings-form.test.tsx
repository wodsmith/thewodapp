import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { BenchmarkSettingsForm } from "@/components/benchmark-tiers/benchmark-settings-form"

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

import { toast } from "sonner"

function createSettings() {
  return {
    name: "Training Guide Benchmark",
    description: null,
    scoreMax: 100,
    maxTier: 10,
    videoPolicy: "for_top_scores",
  }
}

describe("BenchmarkSettingsForm", () => {
  let onSave: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onSave = vi.fn().mockResolvedValue(undefined)
    vi.clearAllMocks()
  })

  it("renders inline as benchmark settings without battery terminology", () => {
    render(<BenchmarkSettingsForm settings={createSettings()} onSave={onSave} />)

    expect(screen.getByText("Benchmark settings")).toBeInTheDocument()
    expect(screen.getByLabelText("Name")).toHaveValue(
      "Training Guide Benchmark",
    )
    expect(screen.getByLabelText("Number of tiers")).toHaveValue(10)
    expect(screen.getByLabelText("Score scale")).toHaveValue(100)
    expect(screen.queryByText(/battery/i)).not.toBeInTheDocument()
  })

  it("keeps save disabled until something changes", () => {
    render(<BenchmarkSettingsForm settings={createSettings()} onSave={onSave} />)

    const save = screen.getByRole("button", { name: /save settings/i })
    expect(save).toBeDisabled()

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Gym Benchmark" },
    })
    expect(save).not.toBeDisabled()
  })

  it("warns before destructive tier-count reductions", () => {
    render(<BenchmarkSettingsForm settings={createSettings()} onSave={onSave} />)

    fireEvent.change(screen.getByLabelText("Number of tiers"), {
      target: { value: "8" },
    })

    expect(
      screen.getByText(/threshold columns above the new tier count/i),
    ).toBeInTheDocument()
  })

  it("submits the parsed draft on save", async () => {
    render(<BenchmarkSettingsForm settings={createSettings()} onSave={onSave} />)

    fireEvent.change(screen.getByLabelText("Number of tiers"), {
      target: { value: "12" },
    })
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "  Annual fitness check  " },
    })
    fireEvent.click(screen.getByRole("button", { name: /save settings/i }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave).toHaveBeenCalledWith({
      name: "Training Guide Benchmark",
      description: "Annual fitness check",
      scoreMax: 100,
      maxTier: 12,
      videoPolicy: "for_top_scores",
    })
  })

  it("surfaces a toast when onSave rejects", async () => {
    onSave.mockRejectedValueOnce(new Error("nope"))
    render(<BenchmarkSettingsForm settings={createSettings()} onSave={onSave} />)

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Renamed" },
    })
    fireEvent.click(screen.getByRole("button", { name: /save settings/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("nope"))
  })
})

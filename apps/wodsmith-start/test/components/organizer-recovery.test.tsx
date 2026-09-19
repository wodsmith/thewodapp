import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { OrganizerCompetitionForm } from "@/components/organizer-competition-form"
import { OrganizerSeriesForm } from "@/components/organizer-series-form"
import { CapacitySettingsForm } from "@/routes/compete/organizer/$competitionId/-components/capacity-settings-form"

const mocks = vi.hoisted(() => ({ create: vi.fn(), divisions: vi.fn(), events: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn(), invalidate: vi.fn() }))
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn(), useRouter: () => ({ invalidate: mocks.invalidate }) }))
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@/server-fns/competition-fns", () => ({ createCompetitionFn: mocks.create, updateCompetitionFn: vi.fn(), createCompetitionGroupFn: vi.fn(), updateCompetitionGroupFn: vi.fn() }))
vi.mock("@/server-fns/competition-divisions-fns", () => ({ initializeCompetitionDivisionsFn: mocks.divisions, updateCompetitionDefaultCapacityFn: vi.fn() }))
vi.mock("@/server-fns/series-event-template-fns", () => ({ syncTemplateEventsToCompetitionsFn: mocks.events }))
vi.mock("@/lib/posthog", () => ({ trackEvent: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: mocks.success, warning: mocks.warning, error: mocks.error } }))
const teams = [{ id: "team", name: "Gym", type: "gym" }]
const divisions = { series: { scalingGroupId: "template", divisions: [{ id: "rx", label: "RX", teamSize: 1 }] } }
const events = { series: [{ id: "event", name: "Fran", order: 1, scoreType: null }] }

beforeAll(() => {
  globalThis.ResizeObserver ??= class ResizeObserver { observe() {} unobserve() {} disconnect() {} }
})

beforeEach(() => {
  mocks.create.mockResolvedValue({ competitionId: "created" })
  mocks.divisions.mockResolvedValue({})
  mocks.events.mockResolvedValue({})
  mocks.invalidate.mockResolvedValue(undefined)
})

describe("organizer creation recovery", () => {
  // @lat: [[organizer-recovery#Custom slugs]]
  it.each(["competition", "series"])("preserves a customized %s slug through later name changes", (kind) => {
    render(kind === "competition" ? <OrganizerCompetitionForm teams={teams} selectedTeamId="team" seriesTemplateDivisions={divisions} seriesTemplateEvents={events} /> : <OrganizerSeriesForm organizingTeamId="team" />)
    const name = screen.getByLabelText(kind === "competition" ? "Competition Name" : "Series Name")
    const slug = screen.getByLabelText("Slug")
    fireEvent.change(name, { target: { value: "First Name" } })
    expect(slug).toHaveValue("first-name")
    fireEvent.change(name, { target: { value: "Second Name" } })
    expect(slug).toHaveValue("second-name")
    fireEvent.change(slug, { target: { value: "custom-url" } })
    fireEvent.change(name, { target: { value: "Third Name" } })
    expect(slug).toHaveValue("custom-url")
  })

  // @lat: [[organizer-recovery#Partial template setup]]
  it.each(["divisions", "events", "both", "neither"])("reports partial creation when %s setup fails and opens the created competition", async (failure) => {
    if (failure === "divisions" || failure === "both") mocks.divisions.mockRejectedValue(new Error("offline"))
    if (failure === "events" || failure === "both") mocks.events.mockRejectedValue(new Error("offline"))
    const onSuccess = vi.fn()
    const { container } = render(<OrganizerCompetitionForm teams={teams} selectedTeamId="team" defaultGroupId="series" seriesTemplateDivisions={divisions} seriesTemplateEvents={events} onSuccess={onSuccess} />)
    fireEvent.change(screen.getByLabelText("Competition Name"), { target: { value: "Throwdown" } })
    fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: "2026-10-01" } })
    fireEvent.submit(container.querySelector("form")!)
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("created"))
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.divisions).toHaveBeenCalledTimes(1)
    expect(mocks.events).toHaveBeenCalledTimes(1)
    expect(mocks.invalidate).toHaveBeenCalled()
    if (failure === "neither") expect(mocks.success).toHaveBeenCalledWith("Competition created successfully")
    else {
      expect(mocks.success).not.toHaveBeenCalled()
      expect(mocks.warning).toHaveBeenCalledWith(expect.stringContaining("created"), expect.objectContaining({ description: expect.any(String), action: expect.objectContaining({ onClick: expect.any(Function) }) }))
    }
  })
})

describe("capacity validation", () => {
  // @lat: [[organizer-recovery#Integer capacities]]
  it.each(["Default spots per division", "Total competition cap"])("rejects fractional %s without saving and accepts integers and unlimited", async (label) => {
    const save = vi.fn().mockResolvedValue({})
    render(<CapacitySettingsForm competition={{ id: "comp", organizingTeamId: "team", defaultMaxSpotsPerDivision: 4, maxTotalRegistrations: 4 }} onSaveCapacity={save} />)
    const input = screen.getByLabelText(label)
    fireEvent.change(input, { target: { value: "3.5" } })
    expect(screen.getByText(/whole number/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))
    expect(save).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: "3" } })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).not.toBeDisabled())
    fireEvent.change(input, { target: { value: "" } })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    const key = label.startsWith("Default") ? "defaultMaxSpotsPerDivision" : "maxTotalRegistrations"
    expect(save.mock.calls[0][0][key]).toBe(3)
    expect(save.mock.calls[1][0][key]).toBeNull()
  })
})

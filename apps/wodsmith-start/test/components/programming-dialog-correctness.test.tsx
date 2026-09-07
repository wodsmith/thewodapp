import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
const api = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }))
vi.mock("@/server-fns/programming-fns", () => ({ createProgrammingTrackFn: api.create, updateProgrammingTrackFn: api.update }))
vi.mock("@/components/track-visibility-selector", () => ({ TrackVisibilitySelector: () => null }))
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, defaultValue, onValueChange }: { children: ReactNode; value?: string; defaultValue?: string; onValueChange: (value: string) => void }) => <select aria-label="Track Type" value={value} defaultValue={defaultValue} onChange={(e) => onValueChange(e.target.value)}>{children}</select>,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
  SelectTrigger: () => null, SelectValue: () => null,
}))
import { ProgrammingTrackCreateDialog } from "@/components/programming-track-create-dialog"
import { ProgrammingTrackEditDialog } from "@/components/programming-track-edit-dialog"
import { TrackHeader } from "@/components/track-header"
import type { ProgrammingTrackWithOwner } from "@/server-fns/programming-fns"
const track = { id: "track", name: "Original", description: "Old description", type: "self_programmed", isPublic: 0, ownerTeamId: "team", ownerTeam: { name: "Gym" } } as ProgrammingTrackWithOwner
beforeEach(() => { api.create.mockResolvedValue({}); api.update.mockResolvedValue({}) })
afterEach(cleanup)
// @lat: [[training-correctness-tests#Training Correctness Tests#Explicit description clearing]]
it("sends an explicit empty description while leaving unchanged fields out", async () => {
  render(<ProgrammingTrackEditDialog track={track} trigger={<button>Edit</button>} open />)
  fireEvent.change(screen.getByLabelText("Description (Optional)"), { target: { value: "" } })
  fireEvent.click(screen.getByRole("button", { name: "Update track" }))
  await waitFor(() => expect(api.update).toHaveBeenCalledWith({ data: { trackId: "track", description: "" } }))
})
// @lat: [[training-correctness-tests#Training Correctness Tests#Create failure retains input]]
it("shows create failures and retains input for a successful retry", async () => {
  api.create.mockRejectedValueOnce(new Error("Request failed"))
  const success = vi.fn()
  render(<ProgrammingTrackCreateDialog teamId="team" trigger={<button>Open</button>} open onSuccess={success} />)
  fireEvent.change(screen.getByLabelText("Track Name"), { target: { value: "New track" } })
  fireEvent.click(screen.getByRole("button", { name: "Create track" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Request failed")
  expect(screen.getByLabelText("Track Name")).toHaveValue("New track")
  expect(success).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Create track" }))
  await waitFor(() => expect(success).toHaveBeenCalledOnce())
})
// @lat: [[training-correctness-tests#Training Correctness Tests#Edit failure retains input]]
it("shows edit failures and retains edits for retry", async () => {
  api.update.mockRejectedValueOnce(new Error("Request failed"))
  render(<ProgrammingTrackEditDialog track={track} trigger={<button>Open</button>} open />)
  fireEvent.change(screen.getByLabelText("Track Name"), { target: { value: "Renamed" } })
  fireEvent.click(screen.getByRole("button", { name: "Update track" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Request failed")
  expect(screen.getByLabelText("Track Name")).toHaveValue("Renamed")
})
// @lat: [[training-correctness-tests#Training Correctness Tests#Refreshed track heading]]
it("renders refreshed name and description and supplies them to the editor", () => {
  const view = render(<TrackHeader track={track} />)
  view.rerender(<TrackHeader track={{ ...track, name: "Renamed", description: "New description" }} />)
  expect(screen.getByRole("heading", { name: "Renamed" })).toBeInTheDocument()
  expect(screen.getByText("New description")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Edit track" }))
  expect(screen.getByLabelText("Track Name")).toHaveValue("Renamed")
})

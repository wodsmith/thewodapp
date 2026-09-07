import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, expect, it, vi } from "vitest"
const api = vi.hoisted(() => ({ remixes: vi.fn() }))
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@/server-fns/workout-remix-fns", () => ({ getRemixedWorkoutsFn: api.remixes }))
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: ReactNode }) => <a>{children}</a> }))
import { WorkoutRemixInfo } from "@/components/workout-remix-info"
afterEach(cleanup)
// @lat: [[training-display-tests#Training Display Tests#Remix failure and retry]]
it("shows a read error, retries once, and preserves a loaded list across toggles", async () => {
  api.remixes.mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValue({ remixes: [{ id: "remix", name: "Fran remix", teamName: "Gym", scope: "public" }] })
  render(<WorkoutRemixInfo workoutId="workout" teamId="gym" sourceWorkout={null} remixCount={1} />)
  fireEvent.click(screen.getByRole("button", { name: "1 remix" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load remixes")
  expect(api.remixes).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole("button", { name: "Retry" }))
  await screen.findByText("Fran remix")
  expect(api.remixes).toHaveBeenCalledTimes(2)
  fireEvent.click(screen.getByRole("button", { name: "1 remix" }))
  fireEvent.click(screen.getByRole("button", { name: "1 remix" }))
  await waitFor(() => expect(screen.getByText("Fran remix")).toBeVisible())
  expect(api.remixes).toHaveBeenCalledTimes(2)
})

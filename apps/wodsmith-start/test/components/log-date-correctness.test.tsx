import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
vi.mock("@/components/ui/calendar", () => ({ Calendar: ({ onSelect, modifiers }: { onSelect: (date: Date) => void; modifiers: { logged: Date[] } }) => <><button onClick={() => onSelect(new Date(2026, 8, 7))}>September 7</button><output aria-label="Marked dates">{modifiers.logged.map((date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`).join(",")}</output></> }))
import { LogRowCard } from "@/components/log-row-card"
import { LogCalendar } from "@/components/log-calendar"
const log = { id: "log", workoutId: "workout", workoutName: "Fran", date: new Date("2026-09-07T00:00:00.000Z"), notes: null, asRx: true }
afterEach(cleanup)
// @lat: [[training-display-tests#Training Display Tests#Log date display preserves calendar label]]
it("displays the stored calendar day in history", () => {
  render(<LogRowCard logEntry={log} />)
  expect(screen.getByText("Sep 7, 2026")).toBeInTheDocument()
})
// @lat: [[training-display-tests#Training Display Tests#Calendar groups by stored day]]
it("marks and selects the stored day rather than the local timestamp day", () => {
  render(<LogCalendar logs={[log]} />)
  expect(screen.getByLabelText("Marked dates")).toHaveTextContent("2026-9-7")
  fireEvent.click(screen.getByRole("button", { name: "September 7" }))
  expect(screen.getByText("Fran")).toBeInTheDocument()
  expect(screen.getByText("Sep 7, 2026")).toBeInTheDocument()
})

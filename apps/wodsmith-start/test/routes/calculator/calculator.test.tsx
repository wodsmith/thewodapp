import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type Search = { weight?: number; units?: "lb" | "kg"; bar?: number }
type Options = {
  component: () => ReactNode
  validateSearch: (search: Record<string, unknown>) => Search
  beforeLoad: (args: {
    context: { hasWorkoutTracking: boolean }
  }) => Promise<void>
}
const state = vi.hoisted(() => ({
  options: {} as Record<string, Options>,
  search: {} as Search,
  navigate: vi.fn(),
}))
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (path: string) => (options: Options) => {
    state.options[path] = options
    return { fullPath: path, useSearch: () => state.search }
  },
  useNavigate: () => state.navigate,
  redirect: (options: unknown) => options,
}))
import "@/routes/_protected/calculator/index"
import "@/routes/_protected/calculator/spreadsheet/index"

const barbell = () => state.options["/_protected/calculator/"]
const spreadsheet = () => state.options["/_protected/calculator/spreadsheet/"]

function renderCalculator(search: Search = {}) {
  state.search = search
  const Page = barbell().component
  const view = render(<Page />)
  state.navigate.mockImplementation(
    ({ search: update }: { search: (prev: Search) => Search }) => {
      state.search = barbell().validateSearch(update(state.search))
      view.rerender(<Page />)
    },
  )
  return view
}

function submitWeight(value: string) {
  const input = screen.getByRole("spinbutton", { name: /target weight/i })
  fireEvent.change(input, { target: { value } })
  fireEvent.submit(input.closest("form")!)
}

beforeEach(() => {
  state.search = {}
  localStorage.clear()
})
afterEach(cleanup)

describe("barbell calculator", () => {
  // @lat: [[calculators#Calculator Tests#Selected units and bookmarked loads]]
  it("accepts a typed KG target and preserves its physical load when switching both ways", () => {
    renderCalculator()
    fireEvent.click(screen.getByLabelText("KG", { exact: true }))
    submitWeight("100")
    expect(
      screen.getByRole("status", { name: "Loaded weight" }),
    ).toHaveTextContent("100.0 KG")
    expect(state.search.weight).toBeCloseTo(220.4624, 3)
    fireEvent.click(screen.getByLabelText("LB", { exact: true }))
    expect(
      Number(
        (
          screen.getByRole("spinbutton", {
            name: /target weight/i,
          }) as HTMLInputElement
        ).value,
      ),
    ).toBeCloseTo(220.4624, 3)
    fireEvent.click(screen.getByLabelText("KG", { exact: true }))
    expect(
      screen.getByRole("spinbutton", { name: /target weight/i }),
    ).toHaveValue(100)
  })

  it("opens existing pounds-based KG links in display units and accepts fractional loads", () => {
    renderCalculator({ weight: 220.46244201837774, units: "kg", bar: 45 })
    expect(
      screen.getByRole("spinbutton", { name: /target weight/i }),
    ).toHaveValue(100)
    submitWeight("102.5")
    expect(
      screen.getByRole("status", { name: "Loaded weight" }),
    ).toHaveTextContent("102.5 KG")
  })

  it("converts an unsubmitted draft and leaves invalid input out of navigation", () => {
    renderCalculator()
    fireEvent.change(
      screen.getByRole("spinbutton", { name: /target weight/i }),
      { target: { value: "200" } },
    )
    fireEvent.click(screen.getByLabelText("KG", { exact: true }))
    expect(state.search.weight).toBe(200)
    expect(
      screen.getByRole("spinbutton", { name: /target weight/i }),
    ).toHaveValue(90.7184)
    state.navigate.mockClear()
    for (const invalid of ["", "-1", "10001"]) {
      submitWeight(invalid)
      expect(state.navigate).not.toHaveBeenCalled()
      expect(
        screen.getByRole("spinbutton", { name: /target weight/i }),
      ).toHaveValue(90.7184)
    }
  })

  // @lat: [[calculators#Calculator Tests#Attainable totals and bar choices]]
  it("shows a 136 lb request as 135 lb loaded and explains a below-bar request", () => {
    renderCalculator()
    submitWeight("136")
    expect(
      screen.getByRole("status", { name: "Loaded weight" }),
    ).toHaveTextContent("135.0 LB")
    expect(screen.getByText(/1 lb below requested 136 lb/i)).toBeInTheDocument()
    submitWeight("20")
    expect(
      screen.getByRole("status", { name: "Loaded weight" }),
    ).toHaveTextContent("45.0 LB")
    expect(screen.getAllByText(/target is below the 45 lb bar/i)).toHaveLength(
      6,
    )
    expect(
      screen.getAllByText(/25 lb above requested 20 lb/i).length,
    ).toBeGreaterThan(0)
    fireEvent.click(screen.getByLabelText("35 lb", { exact: true }))
    expect(
      screen.getByRole("status", { name: "Loaded weight" }),
    ).toHaveTextContent("35.0 LB")
  })

  it("uses standard metric bars and reports unrepresentable KG remainders", () => {
    renderCalculator({ units: "kg" })
    fireEvent.click(screen.getByLabelText("15 kg", { exact: true }))
    submitWeight("101")
    expect(
      screen.getByRole("status", { name: "Loaded weight" }),
    ).toHaveTextContent("100.0 KG")
    expect(screen.getByText(/1 kg below requested 101 kg/i)).toBeInTheDocument()
    submitWeight("10")
    expect(
      screen.getByRole("status", { name: "Loaded weight" }),
    ).toHaveTextContent("15.0 KG")
  })

  // @lat: [[calculators#Calculator Tests#Warm-up loads and preferences]]
  it("preserves pound warm-up rounding and saved percentages with honest below-bar totals", () => {
    renderCalculator()
    expect(
      screen.getByRole("heading", { name: "Set 1: 55.0 lb" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Set 5: 120.0 lb" }),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Percentage for Set 1"), {
      target: { value: "10" },
    })
    expect(
      screen.getByRole("heading", { name: "Set 1: 45.0 lb" }),
    ).toBeInTheDocument()
    expect(
      JSON.parse(localStorage.getItem("wodsmith_warmup_percentages")!)[0],
    ).toBe(0.1)
    expect(screen.getAllByText(/target is below the 45 lb bar/i)).toHaveLength(
      1,
    )
  })

  it("calculates metric warm-ups from the entered KG load", () => {
    renderCalculator({ units: "kg" })
    submitWeight("100")
    for (const [set, weight] of [
      [1, 40],
      [2, 55],
      [3, 70],
      [4, 80],
      [5, 90],
    ]) {
      expect(
        screen.getByRole("heading", { name: `Set ${set}: ${weight}.0 kg` }),
      ).toBeInTheDocument()
    }
  })

  // @lat: [[calculators#Calculator Tests#Named native calculator controls]]
  it("exposes grouped native radios, selected labels and focusable controls", () => {
    renderCalculator()
    const units = screen.getByRole("group", { name: "Units" })
    const bar = screen.getByRole("group", { name: "Bar" })
    expect(within(units).getAllByRole("radio")).toHaveLength(2)
    expect(within(bar).getAllByRole("radio")).toHaveLength(2)
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio.tagName).toBe("INPUT")
      expect(radio).not.toHaveClass("hidden")
      radio.focus()
      expect(radio).toHaveFocus()
    }
    expect(screen.getByRole("radio", { name: "LB" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "45 lb" })).toBeChecked()
  })

  // @lat: [[calculators#Calculator Tests#Input validation and access boundary]]
  it("accepts finite fractional targets, rejects invalid search values and preserves the route gate", async () => {
    expect(
      barbell().validateSearch({ weight: 102.5, units: "kg", bar: 35 }),
    ).toEqual({ weight: 102.5, units: "kg", bar: 35 })
    for (const weight of [-1, 10_001, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => barbell().validateSearch({ weight })).toThrow()
    }
    expect(() => barbell().validateSearch({ bar: 0 })).toThrow()
    await expect(
      barbell().beforeLoad({ context: { hasWorkoutTracking: false } }),
    ).rejects.toEqual({ to: "/" })
    await expect(
      barbell().beforeLoad({ context: { hasWorkoutTracking: true } }),
    ).resolves.toBeUndefined()
  })
})

// @lat: [[calculators#Calculator Tests#Labelled percentage maximum]]
it("labels 1RM and preserves Enter calculation and invalid-input clearing", () => {
  const Page = spreadsheet().component
  render(<Page />)
  const input = screen.getByRole("spinbutton", { name: "1 Rep Max (kg/lb)" })
  fireEvent.change(input, { target: { value: "125.5" } })
  fireEvent.keyDown(input, { key: "Enter" })
  expect(screen.getByRole("row", { name: "100% 125.5" })).toBeInTheDocument()
  expect(screen.getByRole("row", { name: "50% 62.75" })).toBeInTheDocument()
  fireEvent.change(input, { target: { value: "-1" } })
  fireEvent.click(screen.getByRole("button", { name: "Calculate" }))
  expect(screen.queryByRole("table")).not.toBeInTheDocument()
})

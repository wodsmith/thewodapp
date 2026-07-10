// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentType } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  updateProfile: vi.fn(),
  user: {
    athleteProfile: null as string | null,
    gender: "female" as "male" | "female" | null,
    dateOfBirth: new Date("1994-06-15T00:00:00Z") as Date | null,
    affiliateName: "CrossFit WODsmith" as string | null,
  },
}))

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    options,
    useLoaderData: () => ({ user: mocks.user }),
  }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => mocks.navigate,
}))

vi.mock("@tanstack/react-start", () => ({
  useServerFn: () => mocks.updateProfile,
}))

vi.mock("@/components/registration/affiliate-combobox", () => ({
  AffiliateCombobox: ({
    value,
    onChange,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & {
    onChange: (value: string) => void
  }) => (
    <input
      {...props}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))

vi.mock("@/lib/posthog", () => ({
  trackEvent: vi.fn(),
}))

vi.mock("@/server-fns/athlete-profile-fns", () => ({
  athleteProfileExtendedSchema: z
    .object({
      preferredUnits: z.enum(["imperial", "metric"]).optional(),
      gender: z.enum(["male", "female"]).optional(),
      dateOfBirth: z.string().optional(),
      affiliateName: z.string().optional(),
      heightCm: z.number().positive().optional(),
      weightKg: z.number().positive().optional(),
    })
    .passthrough(),
  getAthleteEditDataFn: vi.fn(),
  updateAthleteExtendedProfileFn: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn(() => "athlete-toast"),
    dismiss: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { Route } from "@/routes/_protected/settings/athlete"

const AthleteSettingsPage = Route.options.component as ComponentType

function chooseUnits(name: "Imperial (lbs, ft/in)" | "Metric (kg, cm)") {
  fireEvent.click(
    screen.getByRole("combobox", { name: "Measurement System" }),
  )
  fireEvent.click(screen.getByRole("option", { name }))
}

describe("athlete settings", () => {
  beforeEach(() => {
    mocks.user = {
      athleteProfile: null,
      gender: "female",
      dateOfBirth: new Date("1994-06-15T00:00:00Z"),
      affiliateName: "CrossFit WODsmith",
    }
    mocks.navigate.mockReset()
    mocks.updateProfile.mockReset()
    mocks.updateProfile.mockResolvedValue({ success: true })
  })

  // @lat: [[auth#Authentication#Athlete Settings#Accessible imperial physical stats]]
  it("renders accessible imperial physical-stat inputs by default", () => {
    render(<AthleteSettingsPage />)

    const feet = screen.getByRole("spinbutton", { name: "Height (feet)" })
    const inches = screen.getByRole("spinbutton", { name: "Height (inches)" })
    const pounds = screen.getByRole("spinbutton", { name: "Weight (lbs)" })

    expect(feet).toHaveAccessibleDescription("Feet")
    expect(feet).toHaveAttribute(
      "aria-describedby",
      "athlete-height-feet-description",
    )
    expect(inches).toHaveAccessibleDescription("Inches")
    expect(inches).toHaveAttribute(
      "aria-describedby",
      "athlete-height-inches-description",
    )
    expect(pounds).toHaveAccessibleDescription("Pounds")
    expect(pounds).toHaveAttribute(
      "aria-describedby",
      "athlete-weight-lbs-description",
    )
  })

  // @lat: [[auth#Authentication#Athlete Settings#Accessible metric physical stats]]
  it("renders accessible metric physical-stat inputs", async () => {
    render(<AthleteSettingsPage />)

    chooseUnits("Metric (kg, cm)")

    expect(
      await screen.findByRole("spinbutton", { name: "Height (cm)" }),
    ).toHaveAccessibleDescription("Centimeters")
    const kilograms = screen.getByRole("spinbutton", { name: "Weight (kg)" })
    expect(kilograms).toHaveAccessibleDescription("Kilograms")
    expect(kilograms).toHaveAttribute(
      "aria-describedby",
      "athlete-weight-kg-description",
    )
  })

  // @lat: [[auth#Authentication#Athlete Settings#Canonical physical-stat hydration]]
  it("hydrates canonical metric values into imperial controls", async () => {
    mocks.user.athleteProfile = JSON.stringify({
      preferredUnits: "imperial",
      heightCm: 178,
      weightKg: 75,
    })

    render(<AthleteSettingsPage />)

    expect(
      await screen.findByRole("spinbutton", { name: "Height (feet)" }),
    ).toHaveValue(5)
    expect(
      screen.getByRole("spinbutton", { name: "Height (inches)" }),
    ).toHaveValue(10)
    expect(
      screen.getByRole("spinbutton", { name: "Weight (lbs)" }),
    ).toHaveValue(165)
  })

  // @lat: [[auth#Authentication#Athlete Settings#Canonical physical-stat submission]]
  it("submits imperial controls as canonical metric values", async () => {
    render(<AthleteSettingsPage />)

    const feet = screen.getByRole("spinbutton", { name: "Height (feet)" })
    const inches = screen.getByRole("spinbutton", { name: "Height (inches)" })
    const weight = screen.getByRole("spinbutton", { name: "Weight (lbs)" })

    fireEvent.change(feet, { target: { value: "5" } })
    fireEvent.change(inches, { target: { value: "10" } })
    fireEvent.blur(inches)
    fireEvent.change(weight, { target: { value: "165" } })
    fireEvent.blur(weight)
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }))

    await waitFor(() =>
      expect(mocks.updateProfile).toHaveBeenCalledWith({
        data: expect.objectContaining({
          preferredUnits: "imperial",
          heightCm: 178,
          weightKg: 75,
        }),
      }),
    )
  })
})

// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentType } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  user: {
    id: "user-1",
    firstName: "Avery",
    lastName: "Athlete",
    email: "avery@example.com",
    avatar: "https://example.com/avatar.png",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
  } as {
    id: string
    firstName: string | null
    lastName: string | null
    email: string | null
    avatar: string | null
    createdAt: Date
    updatedAt: Date
  } | null,
  invalidate: vi.fn(),
  updateProfile: vi.fn(),
}))

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    options,
    useLoaderData: () => ({ user: mocks.user }),
  }),
  useRouter: () => ({ invalidate: mocks.invalidate }),
}))

vi.mock("@tanstack/react-start", () => ({
  useServerFn: () => mocks.updateProfile,
}))

vi.mock("@/server-fns/profile-fns", () => ({
  getUserProfileFn: vi.fn(),
  updateUserProfileFn: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn(() => "profile-toast"),
    dismiss: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { Route } from "@/routes/_protected/settings/profile"

const ProfileSettingsPage = Route.options.component as ComponentType

describe("profile settings", () => {
  beforeEach(() => {
    mocks.user = {
      id: "user-1",
      firstName: "Avery",
      lastName: "Athlete",
      email: "avery@example.com",
      avatar: "https://example.com/avatar.png",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    }
    mocks.updateProfile.mockResolvedValue({ success: true })
  })

  // @lat: [[auth#Authentication#Profile Settings]]
  it("renders the immutable email and keeps editable profile fields controlled", () => {
    render(<ProfileSettingsPage />)

    const email = screen.getByRole("textbox", { name: "Email" })
    expect(email).toBeDisabled()
    expect(email).toHaveAttribute("id", "profile-email")
    expect(email).toHaveAttribute(
      "aria-describedby",
      "profile-email-description",
    )
    expect(email).toHaveValue("avery@example.com")
    expect(email).toHaveAccessibleDescription(
      "This is the email you use to sign in.",
    )

    const firstName = screen.getByRole("textbox", { name: "First Name" })
    const lastName = screen.getByRole("textbox", { name: "Last Name" })
    const avatar = screen.getByRole("textbox", { name: "Avatar URL" })

    fireEvent.change(firstName, { target: { value: "Jamie" } })
    fireEvent.change(lastName, { target: { value: "Judge" } })
    fireEvent.change(avatar, {
      target: { value: "https://example.com/jamie.png" },
    })

    expect(firstName).toHaveValue("Jamie")
    expect(lastName).toHaveValue("Judge")
    expect(avatar).toHaveValue("https://example.com/jamie.png")
  })

  it("submits only editable profile fields", async () => {
    render(<ProfileSettingsPage />)

    fireEvent.change(screen.getByRole("textbox", { name: "First Name" }), {
      target: { value: "Jamie" },
    })
    fireEvent.change(screen.getByRole("textbox", { name: "Last Name" }), {
      target: { value: "Judge" },
    })
    fireEvent.change(screen.getByRole("textbox", { name: "Avatar URL" }), {
      target: { value: "https://example.com/jamie.png" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() =>
      expect(mocks.updateProfile).toHaveBeenCalledWith({
        data: {
          firstName: "Jamie",
          lastName: "Judge",
          avatar: "https://example.com/jamie.png",
        },
      }),
    )
    expect(mocks.invalidate).toHaveBeenCalledOnce()
  })

  it("renders the profile skeleton when the loader has no user", () => {
    mocks.user = null

    const { container } = render(<ProfileSettingsPage />)

    expect(screen.queryByText("Profile Settings")).not.toBeInTheDocument()
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument()
  })
})

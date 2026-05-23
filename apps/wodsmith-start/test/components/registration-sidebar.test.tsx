import { render, screen } from "@testing-library/react"
import type { ComponentProps, ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { RegistrationSidebar } from "@/components/registration-sidebar"

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    ...rest
  }: {
    children: ReactNode
    to: string
    params?: Record<string, string>
  }) => {
    const href = params?.token
      ? to.replace("$token", params.token)
      : params?.slug
        ? to.replace("$slug", params.slug)
        : to
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    )
  },
}))

vi.mock("lucide-react", () => {
  const icon =
    (name: string) =>
    ({ className }: { className?: string }) => (
      <span data-testid={`icon-${name}`} className={className} />
    )
  return {
    AlertTriangle: icon("alert-triangle"),
    Calendar: icon("calendar"),
    CheckCircle2: icon("check-circle"),
    Clock: icon("clock"),
    HandHeart: icon("hand-heart"),
    MapPin: icon("map-pin"),
    Plus: icon("plus"),
    UserPlus: icon("user-plus"),
    Users: icon("users"),
  }
})

const competition = {
  id: "comp_1",
  slug: "test-comp",
  name: "Test Competition",
  startDate: "2026-06-01",
  endDate: "2026-06-02",
  registrationOpensAt: "2026-01-01",
  registrationClosesAt: "2026-05-31",
  timezone: "America/Denver",
  organizingTeam: { id: "team_1", name: "Test Gym" },
  group: null,
} as ComponentProps<typeof RegistrationSidebar>["competition"]

function renderSidebar(
  props: Partial<ComponentProps<typeof RegistrationSidebar>> = {},
) {
  return render(
    <RegistrationSidebar
      competition={competition}
      isRegistered={false}
      registrationOpen={false}
      {...props}
    />,
  )
}

describe("RegistrationSidebar pending team invites", () => {
  it("shows an accept team invite CTA when a pending invite exists", () => {
    renderSidebar({
      pendingTeamInvites: [{ id: "invite_1", token: "token_abc" }],
    })

    const link = screen.getByRole("link", { name: "Accept Team Invite" })
    expect(screen.getByText("Team invite waiting")).toBeInTheDocument()
    expect(link).toHaveAttribute("href", "/compete/invite/token_abc")
  })

  it("still shows the invite CTA when the user is already registered elsewhere", () => {
    renderSidebar({
      isRegistered: true,
      userDivision: "Individual RX",
      registrationId: "reg_1",
      pendingTeamInvites: [{ id: "invite_1", token: "token_abc" }],
    })

    expect(
      screen.getByRole("link", { name: "Accept Team Invite" }),
    ).toBeInTheDocument()
    expect(screen.getByText("You're Registered!")).toBeInTheDocument()
  })

  it("does not show the invite CTA when there are no pending invites", () => {
    renderSidebar()

    expect(
      screen.queryByRole("link", { name: "Accept Team Invite" }),
    ).not.toBeInTheDocument()
  })
})

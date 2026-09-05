import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentType, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const loadConfig = vi.hoisted(() => vi.fn())
const signup = vi.hoisted(() => vi.fn())
const submitRequest = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())
const loader = vi.hoisted(() => ({
  isAuthenticated: true,
  availableTeams: [{ id: "gym", name: "Gym", type: "gym", isPersonalTeam: false }],
}))
vi.mock("@/lib/env", () => ({ getTurnstileConfigFn: loadConfig }))
vi.mock("@tanstack/react-start", () => ({ useServerFn: <T,>(fn: T) => fn }))
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: object) => ({ ...config, useLoaderData: () => loader }),
  useRouter: () => ({ navigate, invalidate: vi.fn() }),
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  redirect: vi.fn(),
}))
vi.mock("@/server-fns/auth-fns", () => ({ signUpFn: signup, signInFn: vi.fn() }))
vi.mock("@/server-fns/middleware/auth", () => ({ getOptionalSession: vi.fn() }))
vi.mock("@/server-fns/organizer-onboarding-fns", () => ({
  submitOrganizerRequestFn: submitRequest,
  getOrganizerRequest: vi.fn(),
  hasPendingOrganizerRequest: vi.fn(),
  isApprovedOrganizer: vi.fn(),
}))
vi.mock("@/server-fns/team-settings-fns", () => ({ createTeamFn: vi.fn() }))
vi.mock("@/lib/posthog/hooks", () => ({
  useTrackEvent: () => vi.fn(),
  useIdentifyUser: () => vi.fn(),
}))
vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: ({ siteKey, onSuccess, onExpire, onError, onTimeout }: {
    siteKey: string
    onSuccess: (token: string) => void
    onExpire: (token: string) => void
    onError: (code: string) => void
    onTimeout: () => void
  }) => <div data-testid="challenge" data-site-key={siteKey}>
    <button type="button" onClick={() => onSuccess("challenge-token")}>Complete challenge</button>
    <button type="button" onClick={() => onExpire("challenge-token")}>Expire challenge</button>
    <button type="button" onClick={() => onError("test-error")}>Fail challenge</button>
    <button type="button" onClick={onTimeout}>Timeout challenge</button>
  </div>,
}))

import { Captcha } from "@/components/captcha"
import { Route } from "@/routes/compete/organizer/onboard/index"
const Onboarding = (Route as unknown as { component: ComponentType }).component

beforeEach(() => {
  loader.isAuthenticated = true
  loadConfig.mockResolvedValue({ enabled: true, siteKey: "runtime-public-key" })
})

describe("Captcha", () => {
  // @lat: [[auth#CAPTCHA tests#Public configuration and readiness]]
  it("waits for server config and uses its key before enabling submission", async () => {
    let resolve!: (value: { enabled: boolean; siteKey: string }) => void
    loadConfig.mockReturnValue(new Promise((done) => { resolve = done }))
    const ready = vi.fn()
    const success = vi.fn()
    render(<Captcha onReadyChange={ready} onSuccess={success} />)
    expect(screen.getByRole("status")).toHaveTextContent("Loading security check")
    expect(ready).toHaveBeenLastCalledWith(false)
    await act(async () => { resolve({ enabled: true, siteKey: "runtime-key" }) })
    expect(screen.getByTestId("challenge")).toHaveAttribute("data-site-key", "runtime-key")
    expect(ready).toHaveBeenLastCalledWith(false)
    fireEvent.click(screen.getByRole("button", { name: "Complete challenge" }))
    expect(ready).toHaveBeenLastCalledWith(true)
    expect(success).toHaveBeenCalledWith("challenge-token")
    fireEvent.click(screen.getByRole("button", { name: "Expire challenge" }))
    expect(ready).toHaveBeenLastCalledWith(false)
    fireEvent.click(screen.getByRole("button", { name: "Complete challenge" }))
    fireEvent.click(screen.getByRole("button", { name: "Fail challenge" }))
    expect(ready).toHaveBeenLastCalledWith(false)
    fireEvent.click(screen.getByRole("button", { name: "Complete challenge" }))
    fireEvent.click(screen.getByRole("button", { name: "Timeout challenge" }))
    expect(ready).toHaveBeenLastCalledWith(false)
  })

  // @lat: [[auth#CAPTCHA tests#Disabled widget readiness]]
  it("permits the explicit server-disabled local configuration", async () => {
    loadConfig.mockResolvedValue({ enabled: false, siteKey: "" })
    const ready = vi.fn()
    render(<Captcha onReadyChange={ready} />)
    await waitFor(() => expect(ready).toHaveBeenLastCalledWith(true))
    expect(screen.queryByTestId("challenge")).not.toBeInTheDocument()
  })

  // @lat: [[auth#CAPTCHA tests#Unavailable widget configuration]]
  it("shows a config error and stays unready when configuration cannot load", async () => {
    loadConfig.mockRejectedValue(new Error("Configuration unavailable"))
    const ready = vi.fn()
    render(<Captcha onReadyChange={ready} />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Security check unavailable")
    expect(ready).toHaveBeenLastCalledWith(false)
  })
})

describe("organizer CAPTCHA forms", () => {
  // @lat: [[auth#CAPTCHA tests#Organizer challenge submission]]
  it("requires a challenge, passes its token, and renews it after a failed organizer request", async () => {
    submitRequest.mockRejectedValue(new Error("Please retry"))
    render(<Onboarding />)
    const submit = screen.getByRole("button", { name: "Submit application" })
    expect(submit).toBeDisabled()
    await screen.findByTestId("challenge")
    fireEvent.change(screen.getByRole("textbox", { name: /Why do you want/ }), { target: { value: "Host a local community competition" } })
    fireEvent.click(screen.getByRole("button", { name: "Complete challenge" }))
    expect(submit).toBeEnabled()
    fireEvent.click(submit)
    await waitFor(() => expect(submitRequest).toHaveBeenCalledWith({ data: {
      teamId: "gym", reason: "Host a local community competition", captchaToken: "challenge-token",
    } }))
    await waitFor(() => expect(submit).toBeDisabled())
    expect(loadConfig).toHaveBeenCalledTimes(2)
  })

  // @lat: [[auth#CAPTCHA tests#Inline signup challenge]]
  it("renders a challenge and submits its token with organizer signup", async () => {
    loader.isAuthenticated = false
    signup.mockResolvedValue({ success: true, userId: "new-user" })
    render(<Onboarding />)
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Create account" }), { button: 0, ctrlKey: false })
    const submit = await screen.findByRole("button", { name: "Create account" })
    expect(submit).toBeDisabled()
    await screen.findByTestId("challenge")
    fireEvent.change(screen.getByLabelText("First Name"), { target: { value: "Test" } })
    fireEvent.change(screen.getByLabelText("Last Name"), { target: { value: "Athlete" } })
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "test@example.com" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "TestPassword1" } })
    fireEvent.click(screen.getByRole("button", { name: "Complete challenge" }))
    fireEvent.click(submit)
    await waitFor(() => expect(signup).toHaveBeenCalledWith({ data: expect.objectContaining({ captchaToken: "challenge-token" }) }))
  })
})

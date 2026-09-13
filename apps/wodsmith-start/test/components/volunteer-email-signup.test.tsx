import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { StrictMode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { VolunteerSignupForm } from "@/routes/compete/$slug/-components/volunteer-signup-form"
import { VolunteerEmailConfirmation } from "@/components/volunteer-email-confirmation"
import { VerifyEmail } from "@/react-email/verify-email"

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  direct: vi.fn(),
  confirm: vi.fn(),
}))
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@/server-fns/volunteer-fns", () => ({
  createAccountAndApplyAsVolunteerFn: mocks.request,
  submitVolunteerSignupFn: mocks.direct,
  confirmVolunteerSignupFn: mocks.confirm,
}))
vi.mock("@/components/compete/waiver-viewer", () => ({
  WaiverViewer: () => <p>Test waiver terms</p>,
}))
const props = {
  competition: { id: "comp_owned", name: "Owned Event", slug: "owned-event" },
  competitionTeamId: "team_competition",
  currentUser: null,
  questions: [
    { id: "question_shirt", label: "Shirt size", type: "text", required: true },
  ],
  waivers: [{ id: "waiv_terms", title: "Terms", content: "Test terms" }],
} as unknown as Parameters<typeof VolunteerSignupForm>[0]

describe("volunteer email signup UX", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    mocks.request.mockResolvedValue({
      success: true,
      requiresVerification: true,
    })
    mocks.direct.mockResolvedValue({ success: true })
    mocks.confirm.mockResolvedValue({
      success: true,
      returnPath: "/compete/owned-event/volunteer",
    })
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  // @lat: [[volunteer-confirmation#Volunteer email confirmation#Saved signup form]]
  it("sends all entered fields and agreements once, then asks only for the email click", async () => {
    render(<VolunteerSignupForm {...props} />)
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Full Name/), {
      target: { value: "Jane Doe" },
    })
    fireEvent.change(screen.getByLabelText(/^Email/), {
      target: { value: "owned@example.com" },
    })
    fireEvent.change(screen.getByLabelText("Phone Number"), {
      target: { value: "555-0100" },
    })
    fireEvent.change(screen.getByLabelText("Certifications / Credentials"), {
      target: { value: "L1" },
    })
    fireEvent.change(screen.getByLabelText("Additional Notes"), {
      target: { value: "After lunch" },
    })
    fireEvent.change(screen.getByLabelText(/Shirt size/), {
      target: { value: "Medium" },
    })
    fireEvent.click(screen.getByLabelText("Afternoon"))
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: "Confirm by email" }))
    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(1))
    expect(mocks.request).toHaveBeenCalledWith({
      data: expect.objectContaining({
        firstName: "Jane",
        lastName: "Doe",
        signupName: "Jane Doe",
        signupEmail: "owned@example.com",
        signupPhone: "555-0100",
        availability: "afternoon",
        credentials: "L1",
        availabilityNotes: "After lunch",
        waiverIds: ["waiv_terms"],
        answers: [{ questionId: "question_shirt", answer: "Medium" }],
      }),
    })
    expect(mocks.request.mock.calls[0][0].data).not.toHaveProperty("password")
    expect(
      await screen.findByText("Check your email to confirm"),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Thank you for signing up!"),
    ).not.toBeInTheDocument()
  })

  // @lat: [[volunteer-confirmation#Volunteer email confirmation#One-click confirmation screen]]
  it("redeems only once in StrictMode and shows the server-provided return context without re-entry", async () => {
    render(
      <StrictMode>
        <VolunteerEmailConfirmation code={"a".repeat(32)} />
      </StrictMode>,
    )
    expect(
      await screen.findByText("Volunteer application confirmed"),
    ).toBeInTheDocument()
    expect(mocks.confirm).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole("link", { name: "Return to competition" }),
    ).toHaveAttribute("href", "/compete/owned-event/volunteer")
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })

  // @lat: [[volunteer-confirmation#Volunteer email confirmation#Direct signup screen]]
  it("keeps a single direct submit for an already signed-in volunteer", async () => {
    render(<VolunteerSignupForm {...props} waivers={[]} questions={[]} currentUser={{ name: "Jane Doe", email: "owned@example.com" }} />)
    fireEvent.click(screen.getByRole("button", { name: "Sign up to volunteer" }))
    expect(await screen.findByText("Thank you for signing up!")).toBeInTheDocument()
    expect(mocks.direct).toHaveBeenCalledTimes(1)
    expect(mocks.request).not.toHaveBeenCalled()
  })

  // @lat: [[volunteer-confirmation#Volunteer email confirmation#Confirmation email content]]
  it("explains saved application submission and the actual expiry while preserving ordinary verification email", () => {
    const volunteer = renderToStaticMarkup(<VerifyEmail volunteerCompetitionName="Owned Event" verificationLink="https://example.test/verify-email?code=mailbox-only" />)
    expect(volunteer).toContain("30 minutes")
    expect(volunteer).toContain("Confirm volunteer application")
    expect(volunteer).toContain("Owned Event")
    expect(volunteer).toContain("?code=mailbox-only")
    const ordinary = renderToStaticMarkup(<VerifyEmail />)
    expect(ordinary).toContain("Verify Email Address")
    expect(ordinary).not.toContain("Confirm volunteer application")
  })

  // @lat: [[volunteer-confirmation#Volunteer email confirmation#Confirmation navigation cancellation]]
  it("does not redirect when redemption finishes after leaving the confirmation page", async () => {
    let resolve!: (value: unknown) => void
    mocks.confirm.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const page = render(<VolunteerEmailConfirmation code={"a".repeat(32)} />)
    page.unmount()
    await act(async () =>
      resolve({ success: true, returnPath: "/compete/owned-event/volunteer" }),
    )
    expect(
      screen.queryByText("Volunteer application confirmed"),
    ).not.toBeInTheDocument()
  })
})

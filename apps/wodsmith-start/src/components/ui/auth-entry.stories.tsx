import { Alert, AlertDescription } from "@repo/ui/alert"
import { AuthEntry } from "@repo/ui/auth-entry"
import { Button } from "@repo/ui/button"
import { Input } from "@repo/ui/input"
import { Label } from "@repo/ui/label"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"

const meta = {
  title: "Patterns/Auth entry",
  component: AuthEntry.Root,
  tags: ["autodocs"],
} satisfies Meta<typeof AuthEntry.Root>

export default meta
type Story = StoryObj<typeof meta>

function StandardSignInForm() {
  return (
    <form className="space-y-4" aria-label="Sign in form">
      <div className="space-y-2">
        <Label htmlFor="storybook-email">Email</Label>
        <Input
          id="storybook-email"
          name="email"
          type="email"
          autoComplete="email"
          spellCheck={false}
          placeholder="name@example.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="storybook-password">Password</Label>
        <Input
          id="storybook-password"
          name="password"
          type="password"
          autoComplete="current-password"
          spellCheck={false}
          placeholder="Enter your password"
        />
      </div>
      <a
        href="#forgot-password"
        className="block text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
      >
        Forgot password?
      </a>
      <Button type="submit" className="w-full">
        Sign in
      </Button>
    </form>
  )
}

export const StandardCard: Story = {
  render: () => (
    <AuthEntry.Root className="min-h-[28rem]">
      <AuthEntry.Card>
        <AuthEntry.Header>
          <AuthEntry.Title>Sign in</AuthEntry.Title>
          <AuthEntry.Description>
            Use your WODsmith account to continue.
          </AuthEntry.Description>
        </AuthEntry.Header>
        <AuthEntry.Content>
          <StandardSignInForm />
        </AuthEntry.Content>
        <AuthEntry.Footer className="justify-center text-sm text-muted-foreground">
          New to WODsmith? Create an account.
        </AuthEntry.Footer>
      </AuthEntry.Card>
    </AuthEntry.Root>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", { level: 1, name: "Sign in" }),
    ).toBeVisible()

    const email = canvas.getByRole("textbox", { name: "Email" })
    const password = canvas.getByLabelText("Password")
    await expect(email).toHaveAttribute("autocomplete", "email")
    await expect(password).toHaveAttribute("autocomplete", "current-password")

    await userEvent.click(document.body)
    await userEvent.tab()
    await expect(email).toHaveFocus()
    await userEvent.tab()
    await expect(password).toHaveFocus()
    await userEvent.tab()
    await expect(
      canvas.getByRole("link", { name: "Forgot password?" }),
    ).toHaveFocus()
    await userEvent.tab()
    await expect(canvas.getByRole("button", { name: "Sign in" })).toHaveFocus()
  },
}

export const PlainForcedDark: Story = {
  render: () => (
    <div className="dark w-full" data-testid="forced-dark-auth-entry">
      <AuthEntry.Root className="min-h-[28rem]">
        <AuthEntry.Plain>
          <AuthEntry.Header className="p-0">
            <AuthEntry.Title>WODsmith Ledger</AuthEntry.Title>
            <AuthEntry.Description>
              Enter your password to access documents.
            </AuthEntry.Description>
          </AuthEntry.Header>
          <AuthEntry.Content className="p-0">
            <div className="space-y-2">
              <Label htmlFor="ledger-password">Password</Label>
              <Input
                id="ledger-password"
                name="password"
                type="password"
                autoComplete="current-password"
              />
            </div>
          </AuthEntry.Content>
          <AuthEntry.Footer className="p-0">
            <Button type="button" className="w-full">
              Sign in
            </Button>
          </AuthEntry.Footer>
        </AuthEntry.Plain>
      </AuthEntry.Root>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByTestId("forced-dark-auth-entry"),
    ).toHaveClass("dark")
  },
}

export const ErrorAndPendingStatus: Story = {
  render: () => (
    <AuthEntry.Root className="min-h-[28rem]">
      <AuthEntry.Card>
        <AuthEntry.Header>
          <AuthEntry.Title>Sign in to Crew</AuthEntry.Title>
          <AuthEntry.Description>
            Use your WODsmith account to manage event operations.
          </AuthEntry.Description>
        </AuthEntry.Header>
        <AuthEntry.Content>
          <Alert id="auth-error" variant="destructive">
            <AlertDescription>
              That password did not match. Check it and try again.
            </AlertDescription>
          </Alert>
          <form
            className="mt-4 space-y-4"
            aria-describedby="auth-error auth-status"
          >
            <div className="space-y-2">
              <Label htmlFor="pending-password">Password</Label>
              <Input
                id="pending-password"
                name="password"
                type="password"
                autoComplete="current-password"
                aria-invalid="true"
              />
            </div>
            <output id="auth-status" aria-live="polite" className="text-sm">
              Signing in…
            </output>
            <Button type="submit" className="w-full" disabled>
              Signing in…
            </Button>
          </form>
        </AuthEntry.Content>
      </AuthEntry.Card>
    </AuthEntry.Root>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("alert")).toBeVisible()
    await expect(canvas.getByRole("status")).toHaveTextContent("Signing in…")
    await expect(
      canvas.getByRole("button", { name: "Signing in…" }),
    ).toBeDisabled()
    await expect(canvas.getByLabelText("Password")).toHaveAttribute(
      "aria-invalid",
      "true",
    )
  },
}

const mobileWidths = [320, 390] as const

export const LongContentAtMobileWidths: Story = {
  render: () => (
    <div className="flex w-full flex-col items-start gap-6">
      {mobileWidths.map((width) => (
        <div
          key={width}
          data-testid={`mobile-${width}`}
          className="max-w-full overflow-x-auto border border-dashed border-border"
          style={{ width }}
        >
          <AuthEntry.Root className="min-h-0 px-4 py-6">
            <AuthEntry.Card>
              <AuthEntry.Header>
                <AuthEntry.Title>
                  Sign in to coordinate a very detailed multi-venue competition
                </AuthEntry.Title>
                <AuthEntry.Description>
                  This deliberately long description verifies that translated or
                  expanded account guidance wraps inside the available viewport.
                </AuthEntry.Description>
              </AuthEntry.Header>
              <AuthEntry.Content>
                <Button type="button" className="w-full">
                  Continue to event operations
                </Button>
              </AuthEntry.Content>
            </AuthEntry.Card>
          </AuthEntry.Root>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const width of mobileWidths) {
      const frame = canvas.getByTestId(`mobile-${width}`)
      await expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth)
    }
  },
}

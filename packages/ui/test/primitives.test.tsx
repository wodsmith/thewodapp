// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest"

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/alert"
import { AuthEntry } from "@repo/ui/auth-entry"
import { Avatar, AvatarFallback } from "@repo/ui/avatar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/ui/breadcrumb"
import { Checkbox } from "@repo/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/collapsible"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/dialog"
import { Form, FormLabel } from "@repo/ui/form"
import { Progress } from "@repo/ui/progress"
import { ScrollArea } from "@repo/ui/scroll-area"
import { fireEvent, render, screen } from "@testing-library/react"
import { createRef } from "react"
import { useForm } from "react-hook-form"
import { describe, expect, it } from "vitest"

function FormLabelWithoutField() {
  const form = useForm()

  return (
    <Form {...form}>
      <FormLabel>Event name</FormLabel>
    </Form>
  )
}

describe("shared form and overlay primitives", () => {
  it("exposes an accessible labeled checkbox with checked state", () => {
    render(
      <label>
        <Checkbox />
        Publish immediately
      </label>,
    )

    const checkbox = screen.getByRole("checkbox", {
      name: "Publish immediately",
    })
    expect(checkbox).not.toBeChecked()

    fireEvent.click(checkbox)

    expect(checkbox).toBeChecked()
  })

  it("opens and closes an accessible named dialog", () => {
    render(
      <Dialog>
        <DialogTrigger>Open confirmation</DialogTrigger>
        <DialogContent>
          <DialogTitle>Publish competition?</DialogTitle>
          <DialogDescription>
            Athletes will see registration details immediately.
          </DialogDescription>
          <DialogClose>Cancel</DialogClose>
        </DialogContent>
      </Dialog>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Open confirmation" }))

    const dialog = screen.getByRole("dialog", {
      name: "Publish competition?",
    })
    expect(dialog).toBeVisible()
    expect(dialog).toHaveAccessibleDescription(
      "Athletes will see registration details immediately.",
    )

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(dialog).not.toBeInTheDocument()
  })

  it("reports FormField misuse before reading field state", () => {
    expect(() => render(<FormLabelWithoutField />)).toThrow(
      "useFormField should be used within <FormField>",
    )
  })
})

describe("shared feedback, identity, navigation, and disclosure primitives", () => {
  it("exposes named default and destructive alerts", () => {
    const { rerender } = render(
      <Alert>
        <AlertTitle>Registration ready</AlertTitle>
        <AlertDescription>Athletes can now register.</AlertDescription>
      </Alert>,
    )

    expect(screen.getByRole("alert")).toHaveTextContent("Registration ready")
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Athletes can now register.",
    )

    rerender(<Alert variant="destructive">Registration failed</Alert>)
    expect(screen.getByRole("alert")).toHaveClass("text-destructive")
  })

  it("renders avatar fallback content", () => {
    render(
      <Avatar>
        <AvatarFallback>WS</AvatarFallback>
      </Avatar>,
    )

    expect(screen.getByText("WS")).toBeVisible()
  })

  it("marks the current breadcrumb page and hides separators", () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>Competitions</BreadcrumbItem>
          <BreadcrumbSeparator data-testid="separator" />
          <BreadcrumbItem>
            <BreadcrumbPage>Results</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    )

    expect(screen.getByRole("navigation", { name: "breadcrumb" })).toBeVisible()
    expect(screen.getByRole("link", { name: "Results" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    expect(screen.getByTestId("separator")).toHaveAttribute(
      "aria-hidden",
      "true",
    )
  })

  it("opens collapsible content from its trigger", () => {
    render(
      <Collapsible>
        <CollapsibleTrigger>Show standards</CollapsibleTrigger>
        <CollapsibleContent>Movement standards</CollapsibleContent>
      </Collapsible>,
    )

    expect(screen.queryByText("Movement standards")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Show standards" }))
    expect(screen.getByText("Movement standards")).toBeVisible()
  })

  it("renders a progressbar and moves its indicator", () => {
    const { container } = render(
      <Progress aria-label="Review progress" value={50} />,
    )

    expect(
      screen.getByRole("progressbar", { name: "Review progress" }),
    ).toBeVisible()
    expect(container.querySelector("[data-state] > div")).toHaveStyle({
      transform: "translateX(-50%)",
    })
  })

  it("renders scroll-area content inside a constrained root", () => {
    const { container } = render(
      <ScrollArea className="h-24">
        <p>Scrollable competition list</p>
      </ScrollArea>,
    )

    expect(screen.getByText("Scrollable competition list")).toBeVisible()
    expect(container.firstElementChild).toHaveClass(
      "relative",
      "overflow-hidden",
      "h-24",
    )
  })
})

describe("auth-entry composition", () => {
  it("exposes a semantic, ref-forwarding Card composition", () => {
    const rootRef = createRef<HTMLDivElement>()
    const cardRef = createRef<HTMLDivElement>()

    render(
      <AuthEntry.Root
        ref={rootRef}
        aria-label="Account access"
        className="min-h-0"
      >
        <AuthEntry.Card ref={cardRef} data-testid="auth-card">
          <AuthEntry.Header>
            <AuthEntry.Title>Sign in</AuthEntry.Title>
            <AuthEntry.Description>
              Use your WODsmith account.
            </AuthEntry.Description>
          </AuthEntry.Header>
          <AuthEntry.Content>Form content</AuthEntry.Content>
          <AuthEntry.Footer>Account links</AuthEntry.Footer>
        </AuthEntry.Card>
      </AuthEntry.Root>,
    )

    expect(rootRef.current).toHaveAttribute("aria-label", "Account access")
    expect(rootRef.current).toHaveClass("min-h-0")
    expect(rootRef.current).not.toHaveClass("min-h-[90svh]")
    expect(cardRef.current).toBe(screen.getByTestId("auth-card"))
    expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible()
    expect(screen.getByText("Use your WODsmith account.").tagName).toBe("P")
    expect(screen.getByText("Form content")).toBeVisible()
    expect(screen.getByText("Account links")).toBeVisible()
  })

  it("provides an unframed Plain surface without changing its content", () => {
    const plainRef = createRef<HTMLElement>()

    render(
      <AuthEntry.Root>
        <AuthEntry.Plain ref={plainRef} data-state="password-gate">
          <AuthEntry.Header className="p-0">
            <AuthEntry.Title>WODsmith Ledger</AuthEntry.Title>
          </AuthEntry.Header>
          <AuthEntry.Content className="p-0">Password form</AuthEntry.Content>
        </AuthEntry.Plain>
      </AuthEntry.Root>,
    )

    expect(plainRef.current?.tagName).toBe("SECTION")
    expect(plainRef.current).toHaveAttribute("data-state", "password-gate")
    expect(plainRef.current).toHaveClass("max-w-sm")
    expect(screen.getByRole("heading", { name: "WODsmith Ledger" })).toBeVisible()
  })
})

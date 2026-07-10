// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest"

import { Checkbox } from "@repo/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/dialog"
import { Form, FormLabel } from "@repo/ui/form"
import { fireEvent, render, screen } from "@testing-library/react"
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

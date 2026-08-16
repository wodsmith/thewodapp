// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest"

import { Field, FieldGroup } from "@repo/ui/field"
import { Input } from "@repo/ui/input"
import { render, screen, within } from "@testing-library/react"
import { createRef, type ComponentPropsWithRef } from "react"
import { describe, expect, it } from "vitest"

function CustomControl({
  ref,
  ...props
}: ComponentPropsWithRef<"button">) {
  return <button ref={ref} {...props} />
}

describe("Field composition", () => {
  // @lat: [[lat.md/ui-library#UI Library#Current boundary#Field composition#Accessible field metadata]]
  it("connects the accessible name, description, and error in stable order", () => {
    const labelRef = createRef<HTMLLabelElement>()
    const descriptionRef = createRef<HTMLParagraphElement>()
    const errorRef = createRef<HTMLParagraphElement>()

    render(
      <Field.Root
        id="event-name"
        description="Shown on the registration page."
        error="Event name is required."
      >
        <Field.Label ref={labelRef} htmlFor="ignored">
          Event name
        </Field.Label>
        <Field.Control aria-describedby="external event-name-description external">
          <Input />
        </Field.Control>
        <Field.Description ref={descriptionRef} id="ignored-description" />
        <Field.Error ref={errorRef} id="ignored-error" role="status" />
      </Field.Root>,
    )

    const input = screen.getByRole("textbox", { name: "Event name" })
    expect(input).toHaveAttribute("id", "event-name")
    expect(input).toHaveAttribute(
      "aria-describedby",
      "external event-name-description event-name-error",
    )
    expect(input).toHaveAccessibleDescription(
      "Shown on the registration page. Event name is required.",
    )
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByText("Shown on the registration page.")).toHaveAttribute(
      "id",
      "event-name-description",
    )
    expect(screen.getByRole("alert")).toHaveAttribute("id", "event-name-error")
    expect(screen.getByRole("alert")).toHaveClass("text-destructive")
    expect(labelRef.current).toHaveAttribute("for", "event-name")
    expect(descriptionRef.current).toHaveAttribute(
      "id",
      "event-name-description",
    )
    expect(errorRef.current).toHaveAttribute("role", "alert")
  })

  // @lat: [[lat.md/ui-library#UI Library#Current boundary#Field composition#Absent field metadata]]
  it("omits absent metadata and aria-invalid", () => {
    const { container } = render(
      <Field.Root
        id="division"
        aria-label="Division field"
        className="gap-4"
        description={<>{false}</>}
        error={<></>}
      >
        <Field.Label>Division</Field.Label>
        <Field.Control>
          <Input aria-invalid="true" />
        </Field.Control>
        <Field.Description data-testid="description" />
        <Field.Error data-testid="error" />
      </Field.Root>,
    )

    const input = screen.getByRole("textbox", { name: "Division" })
    expect(input).not.toHaveAttribute("aria-describedby")
    expect(input).not.toHaveAttribute("aria-invalid")
    expect(screen.queryByTestId("description")).not.toBeInTheDocument()
    expect(screen.queryByTestId("error")).not.toBeInTheDocument()
    expect(container.firstElementChild).toHaveAttribute(
      "aria-label",
      "Division field",
    )
    expect(container.firstElementChild).toHaveClass("space-y-2", "gap-4")
  })

  // @lat: [[lat.md/ui-library#UI Library#Current boundary#Field composition#Slotted control precedence]]
  it("slots one custom control while preserving native props, classes, and refs", () => {
    const rootRef = createRef<HTMLDivElement>()
    const controlRef = createRef<HTMLButtonElement>()

    render(
      <Field.Root
        id="custom-trigger"
        ref={rootRef}
        data-state="ready"
        description="Choose one division."
        error="A division is required."
      >
        <Field.Label>Custom trigger</Field.Label>
        <Field.Control
          ref={controlRef}
          name="custom"
          className="custom-class"
          data-kind="trigger"
          aria-describedby="control-hint child-hint"
        >
          <CustomControl
            id="child-id"
            type="button"
            aria-describedby="child-hint custom-trigger-description"
            aria-invalid="false"
          >
            Choose an option
          </CustomControl>
        </Field.Control>
        <Field.Description />
        <Field.Error />
      </Field.Root>,
    )

    const button = screen.getByRole("button", { name: "Custom trigger" })
    expect(button).toHaveAttribute("id", "custom-trigger")
    expect(button).toHaveAttribute("name", "custom")
    expect(button).toHaveAttribute("data-kind", "trigger")
    expect(button).toHaveClass("custom-class")
    expect(button).toHaveAttribute(
      "aria-describedby",
      "child-hint custom-trigger-description control-hint custom-trigger-error",
    )
    expect(button).toHaveAttribute("aria-invalid", "true")
    expect(controlRef.current).toBe(button)
    expect(rootRef.current).toHaveAttribute("data-state", "ready")
  })

  // @lat: [[lat.md/ui-library#UI Library#Current boundary#Field composition#Single slotted control]]
  it("requires exactly one slotted control child", () => {
    expect(() =>
      render(
        <Field.Root id="too-many">
          <Field.Control>
            <input />
            <input />
          </Field.Control>
        </Field.Root>,
      ),
    ).toThrow()

    expect(() =>
      render(
        <Field.Root id="fragment-control">
          <Field.Control>
            <>
              <input />
            </>
          </Field.Control>
        </Field.Root>,
      ),
    ).toThrow("Field.Control requires one concrete control child")
  })

  // @lat: [[lat.md/ui-library#UI Library#Current boundary#Field composition#Stable field id]]
  it("rejects blank ids", () => {
    expect(() => render(<Field.Root id=" ">content</Field.Root>)).toThrow(
      "Field.Root requires a stable id",
    )
  })

  // @lat: [[lat.md/ui-library#UI Library#Current boundary#Field composition#Field context misuse]]
  it.each([
    ["Field.Label", <Field.Label>Orphan</Field.Label>],
    [
      "Field.Control",
      <Field.Control>
        <input />
      </Field.Control>,
    ],
    ["Field.Description", <Field.Description />],
    ["Field.Error", <Field.Error />],
  ])("rejects %s outside Field.Root", (component, element) => {
    expect(() => render(element)).toThrow(
      `${component} must be used within <Field.Root>`,
    )
  })
})

describe("FieldGroup composition", () => {
  // @lat: [[lat.md/ui-library#UI Library#Current boundary#Field composition#Accessible field group]]
  it("uses a real fieldset and direct legend with group metadata semantics", () => {
    const fieldsetRef = createRef<HTMLFieldSetElement>()
    const legendRef = createRef<HTMLLegendElement>()

    render(
      <FieldGroup.Root
        id="preferred-days"
        ref={fieldsetRef}
        description="Select every day you can attend."
        error="Select at least one day."
        aria-describedby="group-help preferred-days-description"
        className="border-0"
      >
        <FieldGroup.Legend ref={legendRef}>Preferred days</FieldGroup.Legend>
        <FieldGroup.Description />
        <label>
          <input type="checkbox" /> Saturday
        </label>
        <label>
          <input type="checkbox" /> Sunday
        </label>
        <FieldGroup.Error />
      </FieldGroup.Root>,
    )

    const group = screen.getByRole("group", { name: "Preferred days" })
    expect(group.tagName).toBe("FIELDSET")
    expect(group.firstElementChild?.tagName).toBe("LEGEND")
    expect(group).toHaveAttribute(
      "aria-describedby",
      "group-help preferred-days-description preferred-days-error",
    )
    expect(group).toHaveAccessibleDescription(
      "Select every day you can attend. Select at least one day.",
    )
    expect(group).toHaveAttribute("aria-invalid", "true")
    expect(group).toHaveClass("space-y-3", "border-0")
    expect(fieldsetRef.current).toBe(group)
    expect(legendRef.current).toHaveTextContent("Preferred days")
    expect(within(group).getByRole("alert")).toHaveClass("text-destructive")
  })

  // @lat: [[lat.md/ui-library#UI Library#Current boundary#Field composition#Absent group metadata]]
  it("omits absent group metadata and rejects blank ids", () => {
    render(
      <FieldGroup.Root
        id="heat"
        description={<></>}
        error={<>{false}</>}
      >
        <FieldGroup.Legend>Heat</FieldGroup.Legend>
        <FieldGroup.Description data-testid="group-description" />
        <FieldGroup.Error data-testid="group-error" />
      </FieldGroup.Root>,
    )

    const group = screen.getByRole("group", { name: "Heat" })
    expect(group).not.toHaveAttribute("aria-describedby")
    expect(group).not.toHaveAttribute("aria-invalid")
    expect(screen.queryByTestId("group-description")).not.toBeInTheDocument()
    expect(screen.queryByTestId("group-error")).not.toBeInTheDocument()

    expect(() =>
      render(<FieldGroup.Root id=" ">content</FieldGroup.Root>),
    ).toThrow("FieldGroup.Root requires a stable id")
  })

  // @lat: [[lat.md/ui-library#UI Library#Current boundary#Field composition#Field group context misuse]]
  it.each([
    ["FieldGroup.Legend", <FieldGroup.Legend>Orphan</FieldGroup.Legend>],
    ["FieldGroup.Description", <FieldGroup.Description />],
    ["FieldGroup.Error", <FieldGroup.Error />],
  ])("rejects %s outside FieldGroup.Root", (component, element) => {
    expect(() => render(element)).toThrow(
      `${component} must be used within <FieldGroup.Root>`,
    )
  })
})

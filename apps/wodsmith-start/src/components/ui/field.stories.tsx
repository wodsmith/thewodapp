import { Button } from "@repo/ui/button"
import { Checkbox } from "@repo/ui/checkbox"
import { Field, FieldGroup } from "@repo/ui/field"
import { Input } from "@repo/ui/input"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { expect, userEvent, within } from "storybook/test"

const meta = {
  title: "Forms/Field",
  component: Field.Root,
  args: { id: "storybook-field" },
  tags: ["autodocs"],
} satisfies Meta<typeof Field.Root>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Field.Root id="athlete-name" className="max-w-sm">
      <Field.Label>Athlete name</Field.Label>
      <Field.Control>
        <Input placeholder="Alex Smith" />
      </Field.Control>
      <Field.Description />
      <Field.Error />
    </Field.Root>
  ),
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", {
      name: "Athlete name",
    })
    await expect(input).toHaveAttribute("id", "athlete-name")
    await expect(input).not.toHaveAttribute("aria-describedby")
    await expect(input).not.toHaveAttribute("aria-invalid")
  },
}

export const WithDescription: Story = {
  render: () => (
    <Field.Root
      id="team-name"
      description="This name appears on public leaderboards."
      className="max-w-sm"
    >
      <Field.Label>Team name</Field.Label>
      <Field.Control>
        <Input defaultValue="Downtown Strength" />
      </Field.Control>
      <Field.Description />
      <Field.Error />
    </Field.Root>
  ),
}

function ValidationTransition() {
  const [error, setError] = useState<string>()

  return (
    <div className="max-w-sm space-y-4">
      <Field.Root
        id="event-email"
        description="We use this address for event updates."
        error={error}
      >
        <Field.Label>Email</Field.Label>
        <Field.Control>
          <Input type="email" defaultValue="not-an-email" />
        </Field.Control>
        <Field.Description />
        <Field.Error />
      </Field.Root>
      <Button
        type="button"
        onClick={() => setError("Enter a valid email address.")}
      >
        Validate
      </Button>
    </div>
  )
}

export const Invalid: Story = {
  render: () => <ValidationTransition />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole("textbox", { name: "Email" })
    await expect(input).toHaveAccessibleDescription(
      "We use this address for event updates.",
    )
    await expect(input).not.toHaveAttribute("aria-invalid")
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument()

    await userEvent.click(canvas.getByRole("button", { name: "Validate" }))

    await expect(input).toHaveAccessibleDescription(
      "We use this address for event updates. Enter a valid email address.",
    )
    await expect(input).toHaveAttribute("aria-invalid", "true")
    await expect(canvas.getByRole("alert")).toBeVisible()
  },
}

export const Disabled: Story = {
  render: () => (
    <Field.Root
      id="account-email"
      description="Your sign-in email cannot be changed here."
      className="max-w-sm"
    >
      <Field.Label>Account email</Field.Label>
      <Field.Control>
        <Input type="email" defaultValue="athlete@example.com" disabled />
      </Field.Control>
      <Field.Description />
      <Field.Error />
    </Field.Root>
  ),
}

export const CustomControl: Story = {
  render: () => (
    <Field.Root
      id="division-picker"
      description="Choose the division used for scoring."
      className="max-w-sm"
    >
      <Field.Label>Division</Field.Label>
      <Field.Control>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start"
        >
          Select a division
        </Button>
      </Field.Control>
      <Field.Description />
      <Field.Error />
    </Field.Root>
  ),
}

export const CompositeGroup: Story = {
  render: () => (
    <FieldGroup.Root
      id="available-days"
      description="Select every day you are available to volunteer."
      className="max-w-sm"
    >
      <FieldGroup.Legend>Available days</FieldGroup.Legend>
      <FieldGroup.Description />
      <div className="space-y-2">
        <label
          htmlFor="available-saturday"
          className="flex items-center gap-2 text-sm"
        >
          <Checkbox id="available-saturday" /> Saturday
        </label>
        <label
          htmlFor="available-sunday"
          className="flex items-center gap-2 text-sm"
        >
          <Checkbox id="available-sunday" /> Sunday
        </label>
      </div>
      <FieldGroup.Error />
    </FieldGroup.Root>
  ),
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole("group", {
      name: "Available days",
    })
    await expect(group).toHaveAccessibleDescription(
      "Select every day you are available to volunteer.",
    )
  },
}

export const InvalidGroup: Story = {
  render: () => (
    <FieldGroup.Root
      id="heat-days"
      description="At least one day is required."
      error="Select Saturday or Sunday."
      className="max-w-sm"
    >
      <FieldGroup.Legend>Competition days</FieldGroup.Legend>
      <FieldGroup.Description />
      <div className="space-y-2">
        <label
          htmlFor="heat-saturday"
          className="flex items-center gap-2 text-sm"
        >
          <Checkbox id="heat-saturday" /> Saturday
        </label>
        <label
          htmlFor="heat-sunday"
          className="flex items-center gap-2 text-sm"
        >
          <Checkbox id="heat-sunday" /> Sunday
        </label>
      </div>
      <FieldGroup.Error />
    </FieldGroup.Root>
  ),
}

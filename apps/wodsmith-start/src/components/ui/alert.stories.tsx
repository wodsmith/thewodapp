import { Alert, AlertDescription, AlertTitle } from "@repo/ui/alert"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { AlertTriangle, Info } from "lucide-react"
import { expect, within } from "storybook/test"

const meta = {
  title: "Foundations/Alert",
  component: Alert,
  tags: ["autodocs"],
} satisfies Meta<typeof Alert>

export default meta
type Story = StoryObj<typeof meta>

export const Informational: Story = {
  render: () => (
    <Alert className="max-w-xl">
      <Info aria-hidden="true" />
      <AlertTitle>Registration is open</AlertTitle>
      <AlertDescription>
        Athletes can register until Friday at 8:00 PM.
      </AlertDescription>
    </Alert>
  ),
  play: async ({ canvasElement }) => {
    const alert = within(canvasElement).getByRole("alert")
    await expect(alert).toHaveTextContent("Registration is open")
    await expect(alert).toHaveTextContent(
      "Athletes can register until Friday at 8:00 PM.",
    )
  },
}

export const Destructive: Story = {
  render: () => (
    <Alert className="max-w-xl" variant="destructive">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>Unable to publish</AlertTitle>
      <AlertDescription>
        Add at least one division before publishing this competition.
      </AlertDescription>
    </Alert>
  ),
}

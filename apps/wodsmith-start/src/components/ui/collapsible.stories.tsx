import { Button } from "@repo/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/collapsible"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { ChevronDown } from "lucide-react"
import { expect, userEvent, within } from "storybook/test"

const meta = {
  title: "Primitives/Collapsible",
  component: Collapsible,
  tags: ["autodocs"],
} satisfies Meta<typeof Collapsible>

export default meta
type Story = StoryObj<typeof meta>

export const MovementStandards: Story = {
  render: () => (
    <Collapsible className="w-[420px] rounded-lg border p-4">
      <CollapsibleTrigger asChild>
        <Button
          className="w-full justify-between"
          type="button"
          variant="ghost"
        >
          Movement standards
          <ChevronDown aria-hidden="true" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pt-3 text-sm text-muted-foreground">
        Complete every repetition below parallel with full hip extension.
      </CollapsibleContent>
    </Collapsible>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("button", { name: "Movement standards" })
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(trigger)
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    await expect(canvas.getByText(/Complete every repetition/)).toBeVisible()
  },
}

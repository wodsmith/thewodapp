import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@repo/ui/hover-card"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"

const meta = {
  title: "Primitives/Hover card",
  component: HoverCard,
  tags: ["autodocs"],
} satisfies Meta<typeof HoverCard>

export default meta
type Story = StoryObj<typeof meta>

export const AthleteSummary: Story = {
  render: () => (
    <HoverCard closeDelay={0} openDelay={0}>
      <HoverCardTrigger asChild>
        <a className="font-medium underline" href="#athlete">
          Alex Johnson
        </a>
      </HoverCardTrigger>
      <HoverCardContent>
        <p className="font-medium">Alex Johnson</p>
        <p className="text-sm text-muted-foreground">
          Rx division · 3 completed events
        </p>
      </HoverCardContent>
    </HoverCard>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.hover(
      within(canvasElement).getByRole("link", { name: "Alex Johnson" }),
    )
    await expect(
      await within(document.body).findByText(
        "Rx division · 3 completed events",
      ),
    ).toBeVisible()
  },
}

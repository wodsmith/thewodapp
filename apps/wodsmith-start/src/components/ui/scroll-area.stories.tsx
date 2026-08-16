import { ScrollArea } from "@repo/ui/scroll-area"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect } from "storybook/test"

const meta = {
  title: "Layout/Scroll area",
  component: ScrollArea,
  tags: ["autodocs"],
} satisfies Meta<typeof ScrollArea>

export default meta
type Story = StoryObj<typeof meta>

const athletes = Array.from(
  { length: 16 },
  (_, index) => `Athlete ${String(index + 1).padStart(2, "0")}`,
)

export const AthleteList: Story = {
  render: () => (
    <ScrollArea className="h-64 w-[320px] rounded-lg border">
      <div className="grid gap-1 p-3">
        {athletes.map((athlete) => (
          <div className="rounded-md px-3 py-2 text-sm" key={athlete}>
            {athlete}
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
  play: async ({ canvasElement }) => {
    const viewport = canvasElement.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]",
    )
    await expect(viewport).not.toBeNull()
    await expect(viewport?.scrollHeight).toBeGreaterThan(
      viewport?.clientHeight ?? 0,
    )
  },
}

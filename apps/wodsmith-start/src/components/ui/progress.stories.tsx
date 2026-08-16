import { Progress } from "@repo/ui/progress"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"

const meta = {
  title: "Foundations/Progress",
  component: Progress,
  tags: ["autodocs"],
  args: {
    "aria-label": "Competition setup progress",
    value: 50,
  },
} satisfies Meta<typeof Progress>

export default meta
type Story = StoryObj<typeof meta>

export const HalfComplete: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("progressbar", {
        name: "Competition setup progress",
      }),
    ).toBeVisible()
  },
}

export const States: Story = {
  render: () => (
    <div className="grid w-[420px] gap-5">
      {[0, 50, 100].map((value) => (
        <div className="grid gap-2" key={value}>
          <div className="flex justify-between text-sm">
            <span>Setup progress</span>
            <span>{value}%</span>
          </div>
          <Progress aria-label={`${value}% complete`} value={value} />
        </div>
      ))}
    </div>
  ),
}

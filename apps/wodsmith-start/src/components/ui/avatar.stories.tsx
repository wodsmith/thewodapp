import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/avatar"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"

const avatarDataUrl =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' fill='%23fb923c'/%3E%3Ctext x='40' y='49' text-anchor='middle' font-size='28' font-family='sans-serif' fill='%231c1917'%3EWS%3C/text%3E%3C/svg%3E"

const meta = {
  title: "Foundations/Avatar",
  component: Avatar,
  tags: ["autodocs"],
} satisfies Meta<typeof Avatar>

export default meta
type Story = StoryObj<typeof meta>

export const Image: Story = {
  render: () => (
    <Avatar>
      <AvatarImage alt="WODsmith athlete" src={avatarDataUrl} />
      <AvatarFallback>WS</AvatarFallback>
    </Avatar>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("img", { name: "WODsmith athlete" }),
    ).toBeVisible()
  },
}

export const Fallback: Story = {
  render: () => (
    <Avatar>
      <AvatarFallback>AJ</AvatarFallback>
    </Avatar>
  ),
}

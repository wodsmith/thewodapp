import { Button } from "@repo/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/tooltip"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"

const meta = {
  title: "Primitives/Menus and popovers",
  component: DropdownMenu,
  tags: ["autodocs"],
} satisfies Meta<typeof DropdownMenu>

export default meta
type Story = StoryObj<typeof meta>

export const ActionMenu: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline">
            Event actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Competition</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Edit details</DropdownMenuItem>
          <DropdownMenuItem>Duplicate event</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline">
            Registration note
          </Button>
        </PopoverTrigger>
        <PopoverContent>
          Registration closes 48 hours before the first heat.
        </PopoverContent>
      </Popover>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" size="icon" variant="ghost" aria-label="Help">
            ?
          </Button>
        </TooltipTrigger>
        <TooltipContent>Changes are saved automatically.</TooltipContent>
      </Tooltip>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Event actions" }))
    await expect(
      await within(document.body).findByRole("menuitem", {
        name: "Edit details",
      }),
    ).toBeVisible()
    await userEvent.keyboard("{Escape}")

    await userEvent.click(
      canvas.getByRole("button", { name: "Registration note" }),
    )
    await expect(
      await within(document.body).findByText(
        "Registration closes 48 hours before the first heat.",
      ),
    ).toBeVisible()
    await userEvent.click(
      canvas.getByRole("button", { name: "Registration note" }),
    )

    await userEvent.hover(canvas.getByRole("button", { name: "Help" }))
    await expect(
      await within(document.body).findByRole("tooltip", {
        name: "Changes are saved automatically.",
      }),
    ).toBeVisible()
  },
}

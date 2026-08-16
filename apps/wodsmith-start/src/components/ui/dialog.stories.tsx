import { Button } from "@repo/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/dialog"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/sheet"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"

const meta = {
  title: "Primitives/Dialog and sheet",
  component: Dialog,
  tags: ["autodocs"],
} satisfies Meta<typeof Dialog>

export default meta
type Story = StoryObj<typeof meta>

export const ConfirmationDialog: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button">Open confirmation</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish competition?</DialogTitle>
          <DialogDescription>
            Athletes will be able to view registration details immediately.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button type="button">Publish</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Open confirmation" }),
    )
    const dialog = await within(document.body).findByRole("dialog", {
      name: "Publish competition?",
    })
    await expect(dialog).toBeVisible()
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    )
    await expect(dialog).not.toBeInTheDocument()
  },
}

export const EditingSheet: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button">Edit division</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit Rx division</SheetTitle>
          <SheetDescription>
            Update the public details for this division.
          </SheetDescription>
        </SheetHeader>
        <div className="py-6 text-sm text-muted-foreground">
          Division settings appear here.
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button type="button">Done</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Edit division" }),
    )
    const dialog = await within(document.body).findByRole("dialog", {
      name: "Edit Rx division",
    })
    await expect(dialog).toBeVisible()
    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }))
    await expect(dialog).not.toBeInTheDocument()
  },
}

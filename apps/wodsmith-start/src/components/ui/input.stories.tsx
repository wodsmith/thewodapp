import { Input } from "@repo/ui/input"
import { Label } from "@repo/ui/label"
import { Textarea } from "@repo/ui/textarea"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
  title: "Foundations/Form controls",
  component: Input,
  tags: ["autodocs"],
  args: {
    id: "competition-name",
    placeholder: "Summer Throwdown",
  },
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const TextInput: Story = {
  render: (args) => (
    <div className="grid w-[360px] gap-2">
      <Label htmlFor={args.id}>Competition name</Label>
      <Input {...args} />
      <p className="text-sm text-muted-foreground">
        This is the public name athletes will see.
      </p>
    </div>
  ),
}

export const Invalid: Story = {
  args: {
    "aria-describedby": "competition-name-error",
    "aria-invalid": true,
    defaultValue: "A",
  },
  render: (args) => (
    <div className="grid w-[360px] gap-2">
      <Label htmlFor={args.id}>Competition name</Label>
      <Input {...args} />
      <p id="competition-name-error" className="text-sm text-destructive">
        Enter at least three characters.
      </p>
    </div>
  ),
}

export const Description: Story = {
  render: () => (
    <div className="grid w-[360px] gap-2">
      <Label htmlFor="competition-description">Description</Label>
      <Textarea
        id="competition-description"
        placeholder="Tell athletes what makes this event special."
      />
    </div>
  ),
}

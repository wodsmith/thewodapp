import { Button } from "@repo/ui/button"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Plus } from "lucide-react"

const meta = {
  title: "Foundations/Button",
  component: Button,
  tags: ["autodocs"],
  args: {
    children: "Create competition",
    type: "button",
  },
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "destructive",
        "outline",
        "secondary",
        "ghost",
        "link",
      ],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
}

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button">Default</Button>
      <Button type="button" variant="secondary">
        Secondary
      </Button>
      <Button type="button" variant="outline">
        Outline
      </Button>
      <Button type="button" variant="ghost">
        Ghost
      </Button>
      <Button type="button" variant="destructive">
        Destructive
      </Button>
      <Button type="button" variant="link">
        Link
      </Button>
    </div>
  ),
}

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Plus aria-hidden="true" />
        Add event
      </>
    ),
  },
}

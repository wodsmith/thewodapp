import type { Meta, StoryObj } from "@storybook/react-vite"
import { Button } from "./button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card"

const meta = {
  title: "Foundations/Card",
  component: Card,
  tags: ["autodocs"],
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const CompetitionSummary: Story = {
  render: () => (
    <Card className="w-[360px]">
      <CardHeader>
        <CardTitle>Summer Throwdown</CardTitle>
        <CardDescription>12 events · 184 registered athletes</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">
          Registration closes Friday at 8:00 PM Mountain Time.
        </p>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button type="button" variant="outline">
          Preview
        </Button>
        <Button type="button">Manage</Button>
      </CardFooter>
    </Card>
  ),
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/tabs"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"

const meta = {
  title: "Primitives/Tabs",
  component: Tabs,
  tags: ["autodocs"],
} satisfies Meta<typeof Tabs>

export default meta
type Story = StoryObj<typeof meta>

export const CompetitionSections: Story = {
  render: () => (
    <Tabs className="w-[480px]" defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="schedule">Schedule</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">Competition overview content</TabsContent>
      <TabsContent value="schedule">Heat schedule content</TabsContent>
    </Tabs>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("tab", { name: "Schedule" }))
    await expect(canvas.getByRole("tabpanel")).toHaveTextContent(
      "Heat schedule content",
    )
  },
}

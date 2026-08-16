import { Alert, AlertDescription, AlertTitle } from "@repo/ui/alert"
import { Metric } from "@repo/ui/metric"
import { Skeleton } from "@repo/ui/skeleton"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { AlertTriangle, CircleDollarSign, Users } from "lucide-react"
import { expect, within } from "storybook/test"

const meta = {
  title: "Patterns/Metric",
  component: Metric.Root,
  tags: ["autodocs"],
} satisfies Meta<typeof Metric.Root>

export default meta
type Story = StoryObj<typeof meta>

export const NeutralGrid: Story = {
  render: () => (
    <div className="grid w-full max-w-4xl gap-4 sm:grid-cols-3">
      <Metric.Card>
        <Metric.Label>Registered athletes</Metric.Label>
        <Metric.Value>128</Metric.Value>
      </Metric.Card>
      <Metric.Card>
        <Metric.Label>Scheduled heats</Metric.Label>
        <Metric.Value>24</Metric.Value>
      </Metric.Card>
      <Metric.Card>
        <Metric.Label>Available judges</Metric.Label>
        <Metric.Value>18</Metric.Value>
      </Metric.Card>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // @lat: [[lat.md/ui-library#UI Library#Storybook contract#Neutral metric grid story]]
    const canvas = within(canvasElement)
    await expect(canvasElement.querySelectorAll("dl")).toHaveLength(3)
    await expect(canvas.getAllByRole("term")).toHaveLength(3)
    await expect(canvas.getAllByRole("definition")).toHaveLength(3)
    await expect(canvas.getByText("Registered athletes").tagName).toBe("DT")
    await expect(canvas.getByText("128").tagName).toBe("DD")
  },
}

export const IconAndSupporting: Story = {
  render: () => (
    <Metric.Card className="w-full max-w-sm">
      <Metric.Label>
        <Metric.Icon data-testid="metric-users-icon">
          <Users aria-label="Users" />
        </Metric.Icon>
        Volunteer confirmations
      </Metric.Label>
      <Metric.Value>42</Metric.Value>
      <Metric.Supporting>Six confirmations arrived today.</Metric.Supporting>
    </Metric.Card>
  ),
  play: async ({ canvasElement }) => {
    // @lat: [[lat.md/ui-library#UI Library#Storybook contract#Metric icon and supporting story]]
    const canvas = within(canvasElement)
    await expect(canvas.getByTestId("metric-users-icon")).toHaveAttribute(
      "aria-hidden",
      "true",
    )
    await expect(
      canvas.queryByRole("img", { name: "Users" }),
    ).not.toBeInTheDocument()
    await expect(canvas.getAllByRole("definition")).toHaveLength(2)
  },
}

export const SemanticTones: Story = {
  render: () => (
    <div className="grid w-full max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric.Inset>
        <Metric.Label>Total assignments</Metric.Label>
        <Metric.Value tone="neutral">48</Metric.Value>
        <Metric.Supporting>Neutral total</Metric.Supporting>
      </Metric.Inset>
      <Metric.Inset>
        <Metric.Label>Confirmed</Metric.Label>
        <Metric.Value tone="positive">+12</Metric.Value>
        <Metric.Supporting>Ahead of yesterday</Metric.Supporting>
      </Metric.Inset>
      <Metric.Inset>
        <Metric.Label>Unconfirmed</Metric.Label>
        <Metric.Value tone="warning">7</Metric.Value>
        <Metric.Supporting>Needs attention</Metric.Supporting>
      </Metric.Inset>
      <Metric.Inset>
        <Metric.Label>Coverage gaps</Metric.Label>
        <Metric.Value tone="critical">2</Metric.Value>
        <Metric.Supporting>Blocked roles</Metric.Supporting>
      </Metric.Inset>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // @lat: [[lat.md/ui-library#UI Library#Storybook contract#Metric tone story]]
    const canvas = within(canvasElement)
    await expect(canvas.getByText("+12")).toHaveClass("text-emerald-700")
    await expect(canvas.getByText("7")).toHaveClass("text-amber-700")
    await expect(canvas.getByText("2")).toHaveClass("text-destructive")
    await expect(canvas.getByText("Needs attention")).toBeVisible()
    await expect(canvas.getByText("Blocked roles")).toBeVisible()
  },
}

export const CompactInset: Story = {
  render: () => (
    <Metric.Inset className="w-full max-w-xs">
      <Metric.Label>Current heat</Metric.Label>
      <Metric.Value size="sm">3 of 8</Metric.Value>
    </Metric.Inset>
  ),
  play: async ({ canvasElement }) => {
    // @lat: [[lat.md/ui-library#UI Library#Storybook contract#Compact metric inset story]]
    const canvas = within(canvasElement)
    const inset = canvas.getByText("Current heat").closest("dl")
    await expect(inset).toHaveClass("bg-muted", "p-3")
    await expect(canvas.getByText("3 of 8")).toHaveClass("text-lg")
  },
}

const mobileWidths = [320, 390] as const

export const LongCodeMobile: Story = {
  render: () => (
    <div className="flex w-full flex-col items-start gap-6">
      {mobileWidths.map((width) => (
        <div
          key={width}
          data-testid={`metric-mobile-${width}`}
          className="max-w-full overflow-hidden border border-dashed border-border"
          style={{ width }}
        >
          <Metric.Card>
            <Metric.Label>
              <Metric.Icon>
                <CircleDollarSign />
              </Metric.Icon>
              Deliberately long external competition identifier
            </Metric.Label>
            <Metric.Value className="font-mono">
              cmp_01JYX9A7V4KQ8N3Z6W2TR5M0BC
            </Metric.Value>
            <Metric.Supporting>
              Synced from a-deliberately-long-provider-reference-without-spaces
            </Metric.Supporting>
          </Metric.Card>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    // @lat: [[lat.md/ui-library#UI Library#Storybook contract#Mobile metric overflow story]]
    const canvas = within(canvasElement)
    for (const width of mobileWidths) {
      const frame = canvas.getByTestId(`metric-mobile-${width}`)
      await expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth)
    }
    await expect(canvas.getAllByText(/cmp_01JYX/)).toHaveLength(2)
  },
}

export const LoadingAndErrorComposition: Story = {
  render: () => (
    <div className="grid w-full max-w-xl gap-4">
      <Metric.Card aria-busy="true" aria-label="Loading registration metric">
        <Metric.Label>Registered athletes</Metric.Label>
        <Metric.Value>
          <Skeleton className="h-8 w-24" aria-hidden="true" />
          <span className="sr-only">Loading registered athletes</span>
        </Metric.Value>
      </Metric.Card>
      <Alert variant="destructive">
        <AlertTriangle aria-hidden="true" />
        <AlertTitle>Unable to load revenue</AlertTitle>
        <AlertDescription>
          Refresh the page or try again after the connection recovers.
        </AlertDescription>
      </Alert>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // @lat: [[lat.md/ui-library#UI Library#Storybook contract#Metric state composition story]]
    const canvas = within(canvasElement)
    const pendingMetric = canvas.getByLabelText("Loading registration metric")
    await expect(pendingMetric).toHaveAttribute("aria-busy", "true")
    await expect(canvas.getByText("Loading registered athletes")).toHaveClass(
      "sr-only",
    )
    const alert = canvas.getByRole("alert")
    await expect(alert).toHaveTextContent("Unable to load revenue")
    await expect(alert.closest("dl")).toBeNull()
  },
}

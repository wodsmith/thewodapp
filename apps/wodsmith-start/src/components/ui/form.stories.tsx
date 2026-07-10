import { Button } from "@repo/ui/button"
import { Checkbox } from "@repo/ui/checkbox"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/form"
import { Input } from "@repo/ui/input"
import { RadioGroup, RadioGroupItem } from "@repo/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useForm } from "react-hook-form"
import { expect, userEvent, within } from "storybook/test"

type FormValues = {
  eventName: string
  division: string
  format: string
  published: boolean
}

function CompetitionForm() {
  const form = useForm<FormValues>({
    defaultValues: {
      eventName: "",
      division: "",
      format: "individual",
      published: false,
    },
  })

  return (
    <Form {...form}>
      <form
        className="grid w-[420px] gap-5 rounded-lg border bg-card p-6"
        onSubmit={form.handleSubmit((values) => {
          form.setValue("eventName", `${values.eventName} saved`)
        })}
      >
        <FormField
          control={form.control}
          name="eventName"
          rules={{ required: "Enter an event name." }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Event name</FormLabel>
              <FormControl>
                <Input placeholder="Summer Throwdown" {...field} />
              </FormControl>
              <FormDescription>
                This appears on the public event page.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="division"
          rules={{ required: "Choose a division." }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Division</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a division" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="rx">Rx</SelectItem>
                  <SelectItem value="scaled">Scaled</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="format"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Format</FormLabel>
              <FormControl>
                <RadioGroup
                  className="flex gap-4"
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem id="format-individual" value="individual" />
                    <label htmlFor="format-individual">Individual</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem id="format-team" value="team" />
                    <label htmlFor="format-team">Team</label>
                  </div>
                </RadioGroup>
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="published"
          render={({ field }) => (
            <FormItem className="flex items-center gap-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) =>
                    field.onChange(checked === true)
                  }
                />
              </FormControl>
              <FormLabel className="font-normal">Publish immediately</FormLabel>
            </FormItem>
          )}
        />

        <Button type="submit">Save event</Button>
      </form>
    </Form>
  )
}

const meta = {
  title: "Primitives/Form",
  component: CompetitionForm,
  tags: ["autodocs"],
} satisfies Meta<typeof CompetitionForm>

export default meta
type Story = StoryObj<typeof meta>

export const ValidationAndSelection: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Save event" }))
    await expect(canvas.getByText("Enter an event name.")).toBeVisible()

    await userEvent.type(canvas.getByLabelText("Event name"), "Boise Open")
    await userEvent.click(canvas.getByRole("combobox", { name: "Division" }))
    await userEvent.click(
      await within(document.body).findByRole("option", { name: "Scaled" }),
    )
    await userEvent.click(canvas.getByLabelText("Team"))
    await userEvent.click(canvas.getByLabelText("Publish immediately"))
    await userEvent.click(canvas.getByRole("button", { name: "Save event" }))

    await expect(canvas.getByDisplayValue("Boise Open saved")).toBeVisible()
    await expect(canvas.getByLabelText("Publish immediately")).toBeChecked()
  },
}

"use client"

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  VOLUNTEER_ROLE_OPTIONS,
  VOLUNTEER_ROLE_TYPE_VALUES,
} from "@/db/schemas/volunteers"
import type { CrewShiftBoardItem } from "@/server-fns/crew-roster-shift-fns"
import {
  createCrewShiftFn,
  updateCrewShiftFn,
} from "@/server-fns/crew-roster-shift-fns"
import { cn } from "@/utils/cn"
import { formatDateTimeInTimezone } from "@/utils/timezone-utils"

// Zod enum from shared volunteer role types
const volunteerRoleTypeEnum = z.enum(VOLUNTEER_ROLE_TYPE_VALUES)

// Form validation schema
const shiftFormSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(200, "Name is too long"),
    roleType: volunteerRoleTypeEnum,
    date: z.date(),
    startTime: z
      .string()
      .min(1, "Start time is required")
      .regex(/^([01]?\d|2[0-3]):([0-5]\d)$/, "Invalid time format"),
    endTime: z
      .string()
      .min(1, "End time is required")
      .regex(/^([01]?\d|2[0-3]):([0-5]\d)$/, "Invalid time format"),
    location: z.string().max(200, "Location is too long").optional(),
    capacity: z.number().int().min(1, "Capacity must be at least 1"),
    notes: z.string().max(1000, "Notes are too long").optional(),
  })
  .refine(
    (data) => {
      // Validate startTime is before endTime on the same day
      const [startHours, startMins] = data.startTime.split(":").map(Number)
      const [endHours, endMins] = data.endTime.split(":").map(Number)
      const startMinutes = (startHours ?? 0) * 60 + (startMins ?? 0)
      const endMinutes = (endHours ?? 0) * 60 + (endMins ?? 0)
      return startMinutes < endMinutes
    },
    {
      message: "Start time must be before end time",
      path: ["endTime"],
    },
  )

type ShiftFormValues = z.infer<typeof shiftFormSchema>

interface ShiftFormDialogProps {
  eventId: string
  /** Event timezone — controls how shift times are displayed and submitted. */
  timezone: string
  /** Default calendar date (YYYY-MM-DD) for new shifts, usually the event start. */
  defaultDate?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The shift to edit, or undefined for create mode */
  shift?: CrewShiftBoardItem
  /** Callback when the form is successfully submitted */
  onSuccess?: () => void
}

/**
 * Format the HH:MM portion of a Date for display in the event timezone.
 */
function formatTimeFieldInTimezone(date: Date, timezone: string): string {
  return formatDateTimeInTimezone(date, timezone, "HH:mm")
}

/**
 * Parse a YYYY-MM-DD string into a local Date at midnight so the calendar
 * popover renders the event-timezone calendar day. We avoid `new Date(str)`
 * which would parse as UTC and could shift the day.
 */
function parseDateOnly(value: string | null | undefined): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number)
    return new Date(year, month - 1, day)
  }
  return new Date()
}

/**
 * Format a calendar Date back into the YYYY-MM-DD string the server expects.
 */
function toDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function ShiftFormDialog({
  eventId,
  timezone,
  defaultDate,
  open,
  onOpenChange,
  shift,
  onSuccess,
}: ShiftFormDialogProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const createShift = useServerFn(createCrewShiftFn)
  const updateShift = useServerFn(updateCrewShiftFn)

  const isEditing = !!shift

  // Initialize form with default values
  const form = useForm<ShiftFormValues>({
    resolver: standardSchemaResolver(shiftFormSchema),
    defaultValues: {
      name: "",
      roleType: undefined,
      date: parseDateOnly(defaultDate),
      startTime: "09:00",
      endTime: "12:00",
      location: "",
      capacity: 1,
      notes: "",
    },
  })

  // Reset form when dialog opens or shift changes
  useEffect(() => {
    if (open) {
      if (shift) {
        // Edit mode - pre-fill with shift values (displayed in event timezone)
        form.reset({
          name: shift.name,
          roleType: shift.roleType,
          date: parseDateOnly(
            formatDateTimeInTimezone(shift.startTime, timezone, "yyyy-MM-dd"),
          ),
          startTime: formatTimeFieldInTimezone(shift.startTime, timezone),
          endTime: formatTimeFieldInTimezone(shift.endTime, timezone),
          location: shift.location ?? "",
          capacity: shift.capacity,
          notes: shift.notes ?? "",
        })
      } else {
        // Create mode - reset to defaults
        form.reset({
          name: "",
          roleType: undefined,
          date: parseDateOnly(defaultDate),
          startTime: "09:00",
          endTime: "12:00",
          location: "",
          capacity: 1,
          notes: "",
        })
      }
    }
  }, [open, shift, form, timezone, defaultDate])

  const handleSubmit = async (values: ShiftFormValues) => {
    setIsSubmitting(true)

    try {
      const date = toDateString(values.date)

      if (isEditing && shift) {
        await updateShift({
          data: {
            eventId,
            shiftId: shift.id,
            name: values.name,
            roleType: values.roleType,
            date,
            startTime: values.startTime,
            endTime: values.endTime,
            location: values.location || undefined,
            capacity: values.capacity,
            notes: values.notes || undefined,
          },
        })
        toast.success("Shift updated successfully")
      } else {
        await createShift({
          data: {
            eventId,
            name: values.name,
            roleType: values.roleType,
            date,
            startTime: values.startTime,
            endTime: values.endTime,
            location: values.location || undefined,
            capacity: values.capacity,
            notes: values.notes || undefined,
          },
        })
        toast.success("Shift created successfully")
      }

      onOpenChange(false)
      await router.invalidate()
      onSuccess?.()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : isEditing
            ? "Failed to update shift"
            : "Failed to create shift",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit shift" : "Add shift"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the volunteer shift details."
              : "Create a new volunteer shift for this event."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            {/* Shift Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shift Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Morning Check-In"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Role Type */}
            <FormField
              control={form.control}
              name="roleType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {VOLUNTEER_ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          disabled={isSubmitting}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        autoFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Time Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start time</FormLabel>
                    <FormControl>
                      <Input type="time" disabled={isSubmitting} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input type="time" disabled={isSubmitting} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Location (optional) */}
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Main Entrance"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Where this shift takes place
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Capacity */}
            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacity</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      disabled={isSubmitting}
                      value={field.value}
                      onChange={(e) =>
                        field.onChange(Number(e.target.value) || 1)
                      }
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>
                    Maximum number of volunteers for this shift
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes (optional) */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional instructions or notes for this shift..."
                      className="resize-none"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? isEditing
                    ? "Saving..."
                    : "Creating..."
                  : isEditing
                    ? "Save changes"
                    : "Create shift"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

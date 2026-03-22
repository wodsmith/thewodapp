"use client"

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
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
import { DEFAULT_COHOST_PERMISSIONS } from "@/db/schemas/cohost"
import { inviteCohostFn } from "@/server-fns/cohost-fns"

const formSchema = z.object({
  name: z.string().optional(),
  email: z
    .string()
    .email("Please enter a valid email address")
    .min(1, "Email is required"),
  canViewRevenue: z.boolean(),
  canEditCapacity: z.boolean(),
  canEditScoring: z.boolean(),
  canEditRotation: z.boolean(),
  canManagePricing: z.boolean(),
  canManageVolunteers: z.boolean(),
  canManageEvents: z.boolean(),
  canManageHeats: z.boolean(),
  canManageResults: z.boolean(),
  canManageRegistrations: z.boolean(),
})

type FormValues = z.infer<typeof formSchema>

interface InviteCohostDialogProps {
  competitionId: string
  competitionTeamId: string
  organizingTeamId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteCohostDialog({
  competitionId,
  competitionTeamId,
  organizingTeamId,
  open,
  onOpenChange,
}: InviteCohostDialogProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      canViewRevenue: DEFAULT_COHOST_PERMISSIONS.canViewRevenue,
      canEditCapacity: DEFAULT_COHOST_PERMISSIONS.canEditCapacity,
      canEditScoring: DEFAULT_COHOST_PERMISSIONS.canEditScoring,
      canEditRotation: DEFAULT_COHOST_PERMISSIONS.canEditRotation,
      canManagePricing: DEFAULT_COHOST_PERMISSIONS.canManagePricing,
      canManageVolunteers: DEFAULT_COHOST_PERMISSIONS.canManageVolunteers,
      canManageEvents: DEFAULT_COHOST_PERMISSIONS.canManageEvents,
      canManageHeats: DEFAULT_COHOST_PERMISSIONS.canManageHeats,
      canManageResults: DEFAULT_COHOST_PERMISSIONS.canManageResults,
      canManageRegistrations: DEFAULT_COHOST_PERMISSIONS.canManageRegistrations,
    },
  })

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true)
    const toastId = toast.loading("Sending invitation...")

    try {
      await inviteCohostFn({
        data: {
          name: data.name || undefined,
          email: data.email,
          competitionTeamId,
          organizingTeamId,
          competitionId,
          permissions: {
            canViewRevenue: data.canViewRevenue,
            canEditCapacity: data.canEditCapacity,
            canEditScoring: data.canEditScoring,
            canEditRotation: data.canEditRotation,
            canManagePricing: data.canManagePricing,
            canManageVolunteers: data.canManageVolunteers,
            canManageEvents: data.canManageEvents,
            canManageHeats: data.canManageHeats,
            canManageResults: data.canManageResults,
            canManageRegistrations: data.canManageRegistrations,
          },
        },
      })

      toast.dismiss(toastId)
      toast.success("Cohost invitation sent")
      form.reset()
      onOpenChange(false)
      router.invalidate()
    } catch (error) {
      toast.dismiss(toastId)
      toast.error(
        error instanceof Error ? error.message : "Failed to invite cohost",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Co-Host</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 pt-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Jane Smith" {...field} />
                  </FormControl>
                  <FormDescription>
                    Used in the invitation email and cohost list
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="cohost@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium leading-none">Permissions</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select what this co-host can access
                </p>
              </div>

              {/* Competition Setup group */}
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Competition Setup
                </p>

                <FormField
                  control={form.control}
                  name="canEditCapacity"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">
                        Division &amp; athlete capacity limits
                      </FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="canEditScoring"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">
                        Scoring algorithm &amp; tiebreak rules
                      </FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="canEditRotation"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">
                        Judge rotation defaults
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="canViewRevenue"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">
                      View revenue &amp; financial dashboard
                    </FormLabel>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="canManagePricing"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">
                      Set registration pricing &amp; coupons
                    </FormLabel>
                  </FormItem>
                )}
              />

              {/* Operations group */}
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Operations
                </p>

                <FormField
                  control={form.control}
                  name="canManageVolunteers"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">
                        Invite &amp; schedule volunteers and judges
                      </FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="canManageEvents"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">
                        Create, edit &amp; publish events/workouts
                      </FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="canManageHeats"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">
                        Create heats &amp; assign athletes to lanes
                      </FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="canManageResults"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">
                        Enter scores &amp; publish leaderboard results
                      </FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="canManageRegistrations"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">
                        Register athletes, transfers &amp; removals
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Sending..." : "Send Invitation"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

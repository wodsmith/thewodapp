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
  canEditSettings: z.boolean(),
  canManagePricing: z.boolean(),
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
      canEditSettings: DEFAULT_COHOST_PERMISSIONS.canEditSettings,
      canManagePricing: DEFAULT_COHOST_PERMISSIONS.canManagePricing,
    },
  })

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true)
    toast.loading("Sending invitation...")

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
            canEditSettings: data.canEditSettings,
            canManagePricing: data.canManagePricing,
          },
        },
      })

      toast.dismiss()
      toast.success("Cohost invitation sent")
      form.reset()
      onOpenChange(false)
      router.invalidate()
    } catch (error) {
      toast.dismiss()
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

              <FormField
                control={form.control}
                name="canEditSettings"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">
                      Can edit settings
                    </FormLabel>
                  </FormItem>
                )}
              />

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
                      Can view revenue
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
                      Can manage pricing and coupons
                    </FormLabel>
                  </FormItem>
                )}
              />
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

"use client"

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useRouter } from "@tanstack/react-router"
import { Check, ChevronsUpDown } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Badge } from "@/components/ui/badge"
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DEFAULT_COHOST_PERMISSIONS } from "@/db/schemas/cohost"
import { cn } from "@/lib/utils"
import { inviteCohostFn } from "@/server-fns/cohost-fns"
import { inviteSeriesCohostFn } from "@/server-fns/series-cohost-fns"

const formSchema = z.object({
  name: z.string().optional(),
  email: z
    .string()
    .email("Please enter a valid email address")
    .min(1, "Email is required"),
  divisions: z.boolean(),
  events: z.boolean(),
  scoring: z.boolean(),
  viewRegistrations: z.boolean(),
  editRegistrations: z.boolean(),
  waivers: z.boolean(),
  schedule: z.boolean(),
  locations: z.boolean(),
  volunteers: z.boolean(),
  results: z.boolean(),
  pricing: z.boolean(),
  revenue: z.boolean(),
  coupons: z.boolean(),
  sponsors: z.boolean(),
})

type FormValues = z.infer<typeof formSchema>

export interface SeriesCompetitionOption {
  id: string
  name: string
}

type InviteCohostDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizingTeamId: string
  /** Permission keys to hide (e.g. when team lacks entitlement) */
  hiddenPermissions?: string[]
} & (
  | { mode?: "competition"; competitionId: string; competitionTeamId: string; groupId?: never; competitions?: never }
  | { mode: "series"; groupId: string; competitions: SeriesCompetitionOption[]; competitionId?: never; competitionTeamId?: never }
)

const PERMISSION_GROUPS = [
  {
    label: "Competition Setup",
    items: [
      { key: "divisions" as const, label: "Divisions" },
      { key: "viewRegistrations" as const, label: "View registrations" },
      { key: "editRegistrations" as const, label: "Add/remove/transfer athletes" },
      { key: "events" as const, label: "Events" },
      { key: "scoring" as const, label: "Scoring" },
      { key: "waivers" as const, label: "Waivers" },
    ],
  },
  {
    label: "Run Competition",
    items: [
      { key: "schedule" as const, label: "Schedule" },
      { key: "locations" as const, label: "Locations" },
      { key: "volunteers" as const, label: "Volunteers" },
      { key: "results" as const, label: "Results" },
    ],
  },
  {
    label: "Business",
    items: [
      { key: "pricing" as const, label: "Pricing" },
      { key: "revenue" as const, label: "Revenue" },
      { key: "coupons" as const, label: "Coupons" },
      { key: "sponsors" as const, label: "Sponsors" },
    ],
  },
]

export function InviteCohostDialog(props: InviteCohostDialogProps) {
  const { open, onOpenChange, organizingTeamId, hiddenPermissions = [] } = props
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Series mode: track which competitions are selected (default all)
  const [selectedCompetitionIds, setSelectedCompetitionIds] = useState<Set<string>>(
    () => new Set(props.mode === "series" ? props.competitions.map((c) => c.id) : []),
  )
  const [compPopoverOpen, setCompPopoverOpen] = useState(false)
  const [compSearch, setCompSearch] = useState("")

  // Reset selection when dialog opens with new competitions
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && props.mode === "series") {
      setSelectedCompetitionIds(new Set(props.competitions.map((c) => c.id)))
      setCompSearch("")
    }
    onOpenChange(isOpen)
  }

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      ...DEFAULT_COHOST_PERMISSIONS,
    },
  })

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true)
    const toastId = toast.loading("Sending invitation...")

    try {
      const permissions = {
        divisions: data.divisions,
        events: data.events,
        scoring: data.scoring,
        viewRegistrations: data.viewRegistrations,
        editRegistrations: data.editRegistrations,
        waivers: data.waivers,
        schedule: data.schedule,
        locations: data.locations,
        volunteers: data.volunteers,
        results: data.results,
        pricing: data.pricing,
        revenue: data.revenue,
        coupons: data.coupons,
        sponsors: data.sponsors,
      }

      if (props.mode === "series") {
        if (selectedCompetitionIds.size === 0) {
          toast.dismiss(toastId)
          toast.error("Select at least one competition")
          setIsSubmitting(false)
          return
        }
        const competitionIds = Array.from(selectedCompetitionIds)
        const result = await inviteSeriesCohostFn({
          data: {
            name: data.name || undefined,
            email: data.email,
            organizingTeamId,
            groupId: props.groupId,
            competitionIds: competitionIds.length < props.competitions.length ? competitionIds : undefined,
            permissions,
          },
        })
        toast.dismiss(toastId)
        toast.success(
          result.invitedCount > 0
            ? `Cohost invitation sent to ${result.invitedCount} competition${result.invitedCount !== 1 ? "s" : ""}`
            : "Cohost already invited to selected competitions",
        )
      } else {
        await inviteCohostFn({
          data: {
            name: data.name || undefined,
            email: data.email,
            competitionTeamId: props.competitionTeamId,
            organizingTeamId,
            competitionId: props.competitionId,
            permissions,
          },
        })
        toast.dismiss(toastId)
        toast.success("Cohost invitation sent")
      }
      form.reset()
      handleOpenChange(false)
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

  const toggleCompetition = (id: string) => {
    setSelectedCompetitionIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllCompetitions = () => {
    if (props.mode !== "series") return
    if (selectedCompetitionIds.size === props.competitions.length) {
      setSelectedCompetitionIds(new Set())
    } else {
      setSelectedCompetitionIds(new Set(props.competitions.map((c) => c.id)))
    }
  }

  const filteredCompetitions =
    props.mode === "series"
      ? props.competitions.filter((c) =>
          c.name.toLowerCase().includes(compSearch.toLowerCase()),
        )
      : []

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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

            {props.mode === "series" && props.competitions.length > 0 && (
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium leading-none">Competitions</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Select which competitions to invite to
                  </p>
                </div>
                <Popover open={compPopoverOpen} onOpenChange={setCompPopoverOpen}>
                  <PopoverTrigger asChild>
                    {/* biome-ignore lint/a11y/useSemanticElements: Custom combobox */}
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={compPopoverOpen}
                      className="w-full justify-between font-normal"
                    >
                      <span className="truncate">
                        {selectedCompetitionIds.size === props.competitions.length
                          ? "All competitions"
                          : selectedCompetitionIds.size === 0
                            ? "None selected"
                            : `${selectedCompetitionIds.size} of ${props.competitions.length} selected`}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] p-0"
                    align="start"
                  >
                    <div className="p-2">
                      <Input
                        placeholder="Search competitions..."
                        value={compSearch}
                        onChange={(e) => setCompSearch(e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div className="border-b px-2 pb-2">
                      <button
                        type="button"
                        onClick={toggleAllCompetitions}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        {selectedCompetitionIds.size === props.competitions.length
                          ? "Deselect all"
                          : "Select all"}
                      </button>
                    </div>
                    <ScrollArea className="h-[200px]">
                      <div className="p-1">
                        {filteredCompetitions.map((comp) => (
                          <button
                            key={comp.id}
                            type="button"
                            onClick={() => toggleCompetition(comp.id)}
                            className={cn(
                              "flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                              selectedCompetitionIds.has(comp.id) && "bg-accent",
                            )}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 shrink-0",
                                selectedCompetitionIds.has(comp.id)
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            <span className="truncate">{comp.name}</span>
                          </button>
                        ))}
                        {filteredCompetitions.length === 0 && (
                          <p className="p-2 text-sm text-muted-foreground text-center">
                            No competitions found.
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
                {selectedCompetitionIds.size > 0 &&
                  selectedCompetitionIds.size < props.competitions.length && (
                    <div className="flex flex-wrap gap-1">
                      {props.competitions
                        .filter((c) => selectedCompetitionIds.has(c.id))
                        .map((c) => (
                          <Badge key={c.id} variant="secondary" className="text-xs">
                            {c.name}
                          </Badge>
                        ))}
                    </div>
                  )}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium leading-none">Permissions</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select what this co-host can access
                </p>
              </div>

              {PERMISSION_GROUPS.map((group) => {
                const visibleItems = group.items.filter(
                  (item) => !hiddenPermissions.includes(item.key),
                )
                if (visibleItems.length === 0) return null
                return (
                  <div key={group.label} className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {group.label}
                    </p>

                    {visibleItems.map((item) => (
                      <FormField
                        key={item.key}
                        control={form.control}
                        name={item.key}
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {item.label}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                )
              })}
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

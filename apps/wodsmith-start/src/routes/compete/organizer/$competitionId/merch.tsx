/**
 * Competition Merch (Registration Add-ons) Route
 *
 * Organizers manage the add-on catalog sold inside the registration flow
 * (e.g., event tees with sizes), plus fulfillment reports: counts-by-variant
 * for the print shop and the per-athlete pickup list for the check-in table.
 *
 * Selling add-ons requires the `registration_addons` entitlement, granted
 * per organizing team by platform admins (/admin/entitlements). Without it
 * this page renders a locked state and all mutations are rejected server-side.
 */
// @lat: [[organizer-dashboard#Merch]]

import { createFileRoute } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  Archive,
  Eye,
  EyeOff,
  Lock,
  Pencil,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { COMPETITION_PRODUCT_STATUS } from "@/db/schemas/competition-products"
import {
  archiveCompetitionAddonFn,
  createCompetitionAddonFn,
  getAddonSalesReportFn,
  listCompetitionAddonsFn,
  type OrganizerAddon,
  updateCompetitionAddonFn,
} from "@/server-fns/competition-addon-fns"

export const Route = createFileRoute("/compete/organizer/$competitionId/merch")(
  {
    component: MerchPage,
    loader: async ({ parentMatchPromise }) => {
      const parentMatch = await parentMatchPromise
      const { competition } = parentMatch.loaderData!

      const [{ entitled, addons }, report] = await Promise.all([
        listCompetitionAddonsFn({
          data: {
            competitionId: competition.id,
            teamId: competition.organizingTeamId,
          },
        }),
        getAddonSalesReportFn({
          data: {
            competitionId: competition.id,
            teamId: competition.organizingTeamId,
          },
        }),
      ])

      return { competition, entitled, addons, report }
    },
  },
)

interface VariantDraft {
  id?: string
  label: string
  stock: string
  unitsSold: number
}

interface AddonDraft {
  name: string
  priceDollars: string
  description: string
  imageUrl: string
  availableUntil: string
  maxPerAthlete: string
  status: string
  variants: VariantDraft[]
}

const emptyDraft: AddonDraft = {
  name: "",
  priceDollars: "",
  description: "",
  imageUrl: "",
  availableUntil: "",
  maxPerAthlete: "",
  status: COMPETITION_PRODUCT_STATUS.ACTIVE,
  variants: [],
}

function draftFromAddon(addon: OrganizerAddon): AddonDraft {
  return {
    name: addon.name,
    priceDollars: (addon.priceCents / 100).toFixed(2),
    description: addon.description ?? "",
    imageUrl: addon.imageUrl ?? "",
    availableUntil: addon.availableUntil ?? "",
    maxPerAthlete: addon.maxPerAthlete?.toString() ?? "",
    status: addon.status,
    variants: addon.variants.map((v) => ({
      id: v.id,
      label: v.label,
      stock: v.stockQty?.toString() ?? "",
      unitsSold: v.unitsSold,
    })),
  }
}

function StatusBadge({ status }: { status: string }) {
  if (status === COMPETITION_PRODUCT_STATUS.ACTIVE)
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        Active
      </Badge>
    )
  if (status === COMPETITION_PRODUCT_STATUS.HIDDEN)
    return (
      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
        Hidden
      </Badge>
    )
  return <Badge variant="secondary">Archived</Badge>
}

function MerchPage() {
  const {
    competition,
    entitled,
    addons: initialAddons,
    report: initialReport,
  } = Route.useLoaderData()

  const teamId = competition.organizingTeamId
  const competitionId = competition.id

  const [addons, setAddons] = useState<OrganizerAddon[]>(initialAddons)
  const [report, setReport] = useState(initialReport)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<AddonDraft>(emptyDraft)
  const [isSaving, setIsSaving] = useState(false)

  const createAddon = useServerFn(createCompetitionAddonFn)
  const updateAddon = useServerFn(updateCompetitionAddonFn)
  const archiveAddon = useServerFn(archiveCompetitionAddonFn)

  async function refresh() {
    const [{ addons: nextAddons }, nextReport] = await Promise.all([
      listCompetitionAddonsFn({ data: { competitionId, teamId } }),
      getAddonSalesReportFn({ data: { competitionId, teamId } }),
    ])
    setAddons(nextAddons)
    setReport(nextReport)
  }

  if (!entitled) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-semibold">Merch</h2>
          <p className="text-sm text-muted-foreground">
            Sell event merch during registration for {competition.name}
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">
                Registration add-ons aren't enabled for your account
              </p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Sell t-shirts and other merch inside your registration flow,
                with size options, order deadlines, and fulfillment reports.
                Contact WODsmith to enable this feature for your team.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  function openCreate() {
    setEditingId(null)
    setDraft(emptyDraft)
    setDialogOpen(true)
  }

  function openEdit(addon: OrganizerAddon) {
    setEditingId(addon.id)
    setDraft(draftFromAddon(addon))
    setDialogOpen(true)
  }

  function updateVariant(index: number, patch: Partial<VariantDraft>) {
    setDraft((prev) => ({
      ...prev,
      variants: prev.variants.map((v, i) =>
        i === index ? { ...v, ...patch } : v,
      ),
    }))
  }

  async function handleSave() {
    const priceCents = Math.round(parseFloat(draft.priceDollars) * 100)
    if (!draft.name.trim()) {
      toast.error("Enter a product name")
      return
    }
    if (Number.isNaN(priceCents) || priceCents <= 0) {
      toast.error("Enter a valid price")
      return
    }
    const maxPerAthlete = draft.maxPerAthlete.trim()
      ? parseInt(draft.maxPerAthlete, 10)
      : null
    if (
      maxPerAthlete !== null &&
      (Number.isNaN(maxPerAthlete) || maxPerAthlete <= 0)
    ) {
      toast.error("Max per athlete must be a positive number (or blank)")
      return
    }
    const variants = draft.variants
      .filter((v) => v.label.trim())
      .map((v) => ({
        ...(v.id ? { id: v.id } : {}),
        label: v.label.trim(),
        stockQty: v.stock.trim() === "" ? null : parseInt(v.stock, 10),
      }))
    if (variants.some((v) => v.stockQty !== null && Number.isNaN(v.stockQty))) {
      toast.error("Stock must be a number (or blank for untracked)")
      return
    }

    const shared = {
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      imageUrl: draft.imageUrl.trim() || undefined,
      priceCents,
      maxPerAthlete,
      availableUntil: draft.availableUntil.trim() || null,
      status: draft.status as "ACTIVE" | "HIDDEN" | "ARCHIVED",
      variants,
    }

    setIsSaving(true)
    try {
      if (editingId) {
        await updateAddon({
          data: { productId: editingId, teamId, ...shared },
        })
        toast.success("Add-on updated")
      } else {
        await createAddon({
          data: { competitionId, teamId, ...shared },
        })
        toast.success("Add-on created")
      }
      setDialogOpen(false)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save add-on")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleToggleVisibility(addon: OrganizerAddon) {
    const nextStatus =
      addon.status === COMPETITION_PRODUCT_STATUS.ACTIVE
        ? COMPETITION_PRODUCT_STATUS.HIDDEN
        : COMPETITION_PRODUCT_STATUS.ACTIVE
    try {
      await updateAddon({
        data: { productId: addon.id, teamId, status: nextStatus },
      })
      toast.success(
        nextStatus === COMPETITION_PRODUCT_STATUS.ACTIVE
          ? "Add-on is now visible to athletes"
          : "Add-on hidden from athletes",
      )
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update")
    }
  }

  async function handleArchive(addonId: string) {
    try {
      await archiveAddon({ data: { productId: addonId, teamId } })
      toast.success("Add-on archived")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to archive")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Merch</h2>
          <p className="text-sm text-muted-foreground">
            Sell add-ons inside the registration flow for {competition.name}.
            Athletes pay with their registration; pickup happens at the venue.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add product
        </Button>
      </div>

      {/* Catalog */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingBag className="h-4 w-4" />
            Products ({addons.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {addons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <ShoppingBag className="mb-2 h-8 w-8 opacity-40" />
              <p className="text-sm">No merch yet</p>
              <p className="text-xs">
                Add a product to offer it during registration
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Options</TableHead>
                    <TableHead>Order by</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {addons.map((addon) => (
                    <TableRow key={addon.id}>
                      <TableCell className="font-medium">
                        {addon.name}
                      </TableCell>
                      <TableCell>
                        ${(addon.priceCents / 100).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {addon.variants.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {addon.variants.map((v) => (
                              <Badge
                                key={v.id}
                                variant="outline"
                                className="font-normal"
                              >
                                {v.label}
                                <span className="ml-1 text-muted-foreground">
                                  {v.stockQty !== null
                                    ? `${v.unitsSold}/${v.stockQty}`
                                    : v.unitsSold}
                                </span>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{addon.availableUntil ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={addon.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {addon.unitsSold}
                      </TableCell>
                      <TableCell className="text-right">
                        ${(addon.revenueCents / 100).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(addon)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          {addon.status !==
                            COMPETITION_PRODUCT_STATUS.ARCHIVED && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleVisibility(addon)}
                              >
                                {addon.status ===
                                COMPETITION_PRODUCT_STATUS.ACTIVE ? (
                                  <EyeOff className="h-3.5 w-3.5" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5" />
                                )}
                                <span className="sr-only">
                                  Toggle visibility
                                </span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleArchive(addon.id)}
                              >
                                <Archive className="h-3.5 w-3.5" />
                                <span className="sr-only">Archive</span>
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fulfillment: counts by variant */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Print shop summary (counts by option)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {report.variantCounts.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No completed sales yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Option</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.variantCounts.map((row) => (
                  <TableRow key={`${row.productId}-${row.variantLabel ?? ""}`}>
                    <TableCell>{row.productName}</TableCell>
                    <TableCell>{row.variantLabel ?? "—"}</TableCell>
                    <TableCell className="text-right">{row.units}</TableCell>
                    <TableCell className="text-right">
                      ${(row.revenueCents / 100).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Fulfillment: pickup list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pickup list</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {report.pickupList.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No completed sales yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Athlete</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.pickupList.map((row) => (
                  <TableRow key={row.purchaseId}>
                    <TableCell className="font-medium">
                      {row.purchaserName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.purchaserEmail ?? "—"}
                    </TableCell>
                    <TableCell>
                      {row.productName}
                      {row.variantLabel ? ` (${row.variantLabel})` : ""}
                    </TableCell>
                    <TableCell className="text-right">{row.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit add-on" : "New add-on"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="addon-name">Name</Label>
              <Input
                id="addon-name"
                placeholder="Event Tee 2026"
                value={draft.name}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, name: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="addon-price">Price ($)</Label>
                <Input
                  id="addon-price"
                  type="number"
                  min="0.50"
                  step="0.01"
                  placeholder="25.00"
                  value={draft.priceDollars}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, priceDollars: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="addon-max">
                  Max per athlete{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="addon-max"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="No limit"
                  value={draft.maxPerAthlete}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, maxPerAthlete: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="addon-until">
                  Order by{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="addon-until"
                  type="date"
                  value={draft.availableUntil}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, availableUntil: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Last day athletes can order — e.g. your print shop deadline.
                  End of day in the competition timezone.
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="addon-status">Status</Label>
                <Select
                  value={draft.status}
                  onValueChange={(value) =>
                    setDraft((d) => ({ ...d, status: value }))
                  }
                >
                  <SelectTrigger id="addon-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={COMPETITION_PRODUCT_STATUS.ACTIVE}>
                      Active
                    </SelectItem>
                    <SelectItem value={COMPETITION_PRODUCT_STATUS.HIDDEN}>
                      Hidden
                    </SelectItem>
                    <SelectItem value={COMPETITION_PRODUCT_STATUS.ARCHIVED}>
                      Archived
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="addon-description">
                Description{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="addon-description"
                rows={2}
                placeholder="Soft tri-blend tee with the event logo"
                value={draft.description}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="addon-image">
                Image URL{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="addon-image"
                type="url"
                placeholder="https://..."
                value={draft.imageUrl}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, imageUrl: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Options (sizes){" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      variants: [
                        ...d.variants,
                        { label: "", stock: "", unitsSold: 0 },
                      ],
                    }))
                  }
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add option
                </Button>
              </div>
              {draft.variants.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No options — athletes just pick a quantity. Add options for
                  sizes like S / M / L / XL.
                </p>
              ) : (
                <div className="space-y-2">
                  {draft.variants.map((variant, index) => (
                    <div
                      key={variant.id ?? `new-${index}`}
                      className="flex items-center gap-2"
                    >
                      <Input
                        placeholder="Label (e.g. L)"
                        value={variant.label}
                        onChange={(e) =>
                          updateVariant(index, { label: e.target.value })
                        }
                      />
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        className="w-28"
                        placeholder="Stock"
                        title="Leave blank for untracked stock"
                        value={variant.stock}
                        onChange={(e) =>
                          updateVariant(index, { stock: e.target.value })
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={variant.unitsSold > 0}
                        title={
                          variant.unitsSold > 0
                            ? "Sold units — set stock to 0 instead"
                            : "Remove option"
                        }
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            variants: d.variants.filter((_, i) => i !== index),
                          }))
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Blank stock = untracked (sell until the order deadline).
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving
                ? "Saving..."
                : editingId
                  ? "Save changes"
                  : "Create add-on"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

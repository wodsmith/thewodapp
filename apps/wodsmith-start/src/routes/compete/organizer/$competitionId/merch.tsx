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
  Download,
  Eye,
  EyeOff,
  FileText,
  Lock,
  Pencil,
  Plus,
  ShoppingBag,
  Trash2,
  Upload,
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
import {
  COMPETITION_PRODUCT_ACCESS,
  COMPETITION_PRODUCT_DELIVERY,
  COMPETITION_PRODUCT_STATUS,
} from "@/db/schema"
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
      const competition = parentMatch.loaderData?.competition
      if (!competition) throw new Error("Competition not found")

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
  delivery: string
  access: string
  variants: VariantDraft[]
  files: ProductFileDraft[]
}

interface ProductFileDraft {
  id?: string
  title: string
  r2Key: string
  originalFilename: string
  fileSize: number
  mimeType: "application/pdf"
}

const emptyDraft: AddonDraft = {
  name: "",
  priceDollars: "",
  description: "",
  imageUrl: "",
  availableUntil: "",
  maxPerAthlete: "",
  status: COMPETITION_PRODUCT_STATUS.ACTIVE,
  delivery: COMPETITION_PRODUCT_DELIVERY.PICKUP,
  access: COMPETITION_PRODUCT_ACCESS.OPTIONAL_PURCHASE,
  variants: [],
  files: [],
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
    delivery: addon.delivery,
    access: addon.access,
    variants: addon.variants.map((v) => ({
      id: v.id,
      label: v.label,
      stock: v.stockQty?.toString() ?? "",
      unitsSold: v.unitsSold,
    })),
    files: addon.files.map((file) => ({
      id: file.id,
      title: file.title,
      r2Key: file.r2Key,
      originalFilename: file.originalFilename,
      fileSize: file.fileSize,
      mimeType: "application/pdf",
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
  const [isUploading, setIsUploading] = useState(false)
  const editingAddon = editingId
    ? addons.find((addon) => addon.id === editingId)
    : undefined
  const deliveryLocked = Boolean(
    editingAddon &&
      (editingAddon.unitsSold > 0 ||
        editingAddon.hasPendingCheckout ||
        editingAddon.access ===
          COMPETITION_PRODUCT_ACCESS.INCLUDED_WITH_REGISTRATION),
  )

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

  async function cleanupPendingFiles(files: ProductFileDraft[]) {
    await Promise.allSettled(
      files
        .filter((file) => !file.id)
        .map((file) =>
          fetch("/api/upload", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              purpose: "competition-download",
              entityId: competitionId,
              key: file.r2Key,
            }),
          }),
        ),
    )
  }

  function handleDialogOpenChange(open: boolean) {
    if (!open && (isUploading || isSaving)) {
      toast.error(
        isUploading
          ? "Wait for the PDF upload to finish before closing"
          : "Wait for the product to finish saving before closing",
      )
      return
    }
    if (!open) void cleanupPendingFiles(draft.files)
    setDialogOpen(open)
  }

  function handleDeliveryChange(value: string) {
    if (isUploading) {
      toast.error("Wait for the PDF upload to finish before changing delivery")
      return
    }
    if (deliveryLocked) {
      toast.error(
        editingAddon?.access ===
          COMPETITION_PRODUCT_ACCESS.INCLUDED_WITH_REGISTRATION
          ? "Delivery cannot be changed while this product is included with registration"
          : editingAddon?.hasPendingCheckout
            ? "Delivery cannot be changed after checkout has started for a product"
            : "Delivery cannot be changed after a product has sales",
      )
      return
    }
    if (value === COMPETITION_PRODUCT_DELIVERY.PICKUP) {
      void cleanupPendingFiles(draft.files)
    }
    setDraft((current) => ({
      ...current,
      delivery: value,
      access:
        value === COMPETITION_PRODUCT_DELIVERY.PICKUP
          ? COMPETITION_PRODUCT_ACCESS.OPTIONAL_PURCHASE
          : current.access,
      priceDollars:
        value === COMPETITION_PRODUCT_DELIVERY.PICKUP &&
        current.access === COMPETITION_PRODUCT_ACCESS.INCLUDED_WITH_REGISTRATION
          ? ""
          : current.priceDollars,
      files: value === COMPETITION_PRODUCT_DELIVERY.PICKUP ? [] : current.files,
    }))
  }

  function handleRemoveFile(index: number) {
    const file = draft.files[index]
    if (file && !file.id) void cleanupPendingFiles([file])
    setDraft((current) => ({
      ...current,
      files: current.files.filter((_, fileIndex) => fileIndex !== index),
    }))
  }

  async function handleSave() {
    const included =
      draft.access === COMPETITION_PRODUCT_ACCESS.INCLUDED_WITH_REGISTRATION
    const isDownload = draft.delivery === COMPETITION_PRODUCT_DELIVERY.DOWNLOAD
    const priceCents = included
      ? 0
      : Math.round(parseFloat(draft.priceDollars) * 100)
    if (!draft.name.trim()) {
      toast.error("Enter a product name")
      return
    }
    if (!included && (Number.isNaN(priceCents) || priceCents <= 0)) {
      toast.error("Enter a valid price")
      return
    }
    if (isDownload && draft.files.length === 0) {
      toast.error("Upload at least one PDF")
      return
    }
    if (isDownload && draft.files.some((file) => !file.title.trim())) {
      toast.error("Give every PDF a display title")
      return
    }
    if (
      editingAddon &&
      editingAddon.delivery !== draft.delivery &&
      deliveryLocked
    ) {
      toast.error(
        editingAddon.access ===
          COMPETITION_PRODUCT_ACCESS.INCLUDED_WITH_REGISTRATION
          ? "Delivery cannot be changed while this product is included with registration"
          : editingAddon.hasPendingCheckout
            ? "Delivery cannot be changed after checkout has started for a product"
            : "Delivery cannot be changed after a product has sales",
      )
      return
    }
    // Number() (not parseInt) so decimal input like "2.5" is rejected
    // instead of silently truncated.
    const parseWholeNumber = (raw: string): number => {
      const value = Number(raw)
      return Number.isInteger(value) ? value : Number.NaN
    }
    const maxPerAthlete = draft.maxPerAthlete.trim()
      ? parseWholeNumber(draft.maxPerAthlete)
      : null
    if (
      maxPerAthlete !== null &&
      (Number.isNaN(maxPerAthlete) || maxPerAthlete <= 0)
    ) {
      toast.error("Max per athlete must be a positive whole number (or blank)")
      return
    }
    const variants = (isDownload ? [] : draft.variants)
      .filter((v) => v.label.trim())
      .map((v) => ({
        ...(v.id ? { id: v.id } : {}),
        label: v.label.trim(),
        stockQty: v.stock.trim() === "" ? null : parseWholeNumber(v.stock),
      }))
    if (
      variants.some(
        (v) =>
          v.stockQty !== null && (Number.isNaN(v.stockQty) || v.stockQty < 0),
      )
    ) {
      toast.error("Stock must be a whole number of 0 or more (or blank)")
      return
    }

    const shared = {
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      imageUrl: draft.imageUrl.trim() || undefined,
      priceCents,
      delivery: draft.delivery as "PICKUP" | "DOWNLOAD",
      access: draft.access as
        | "OPTIONAL_PURCHASE"
        | "INCLUDED_WITH_REGISTRATION",
      maxPerAthlete: isDownload ? 1 : maxPerAthlete,
      availableUntil: isDownload ? null : draft.availableUntil.trim() || null,
      status: draft.status as "ACTIVE" | "HIDDEN" | "ARCHIVED",
      variants,
      files: draft.files.map((file) => ({
        ...file,
        title: file.title.trim(),
      })),
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

  async function handleFileUpload(file: File | undefined) {
    if (!file) return
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files can be uploaded")
      return
    }
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.set("file", file)
      formData.set("purpose", "competition-download")
      formData.set("entityId", competitionId)
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })
      const result = (await response.json()) as {
        error?: string
        key?: string
        originalFilename?: string
        fileSize?: number
      }
      if (!response.ok || !result.key) {
        throw new Error(result.error ?? "Upload failed")
      }
      const uploadedKey = result.key
      setDraft((current) => ({
        ...current,
        files: [
          ...current.files,
          {
            title: file.name.replace(/\.pdf$/i, ""),
            r2Key: uploadedKey,
            originalFilename: result.originalFilename ?? file.name,
            fileSize: result.fileSize ?? file.size,
            mimeType: "application/pdf",
          },
        ],
      }))
      toast.success("PDF uploaded")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setIsUploading(false)
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
          <h2 className="text-xl font-semibold">Merch &amp; downloads</h2>
          <p className="text-sm text-muted-foreground">
            Offer physical add-ons and PDF products for {competition.name}.
            Downloads can be sold separately or included with registration.
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
                    <TableHead>Delivery</TableHead>
                    <TableHead>Access</TableHead>
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
                        <Badge variant="outline" className="font-normal">
                          {addon.delivery ===
                          COMPETITION_PRODUCT_DELIVERY.DOWNLOAD ? (
                            <>
                              <Download className="mr-1 h-3 w-3" /> Download
                            </>
                          ) : (
                            "Pickup"
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {addon.access ===
                        COMPETITION_PRODUCT_ACCESS.INCLUDED_WITH_REGISTRATION
                          ? "Included"
                          : "Optional add-on"}
                      </TableCell>
                      <TableCell>
                        {addon.access ===
                        COMPETITION_PRODUCT_ACCESS.INCLUDED_WITH_REGISTRATION
                          ? "—"
                          : `$${(addon.priceCents / 100).toFixed(2)}`}
                      </TableCell>
                      <TableCell>
                        {addon.delivery ===
                        COMPETITION_PRODUCT_DELIVERY.DOWNLOAD ? (
                          <span className="text-muted-foreground">
                            {addon.files.length} PDF
                            {addon.files.length === 1 ? "" : "s"}
                          </span>
                        ) : addon.variants.length === 0 ? (
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
      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit product" : "New product"}
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
                <Label htmlFor="addon-delivery">Delivery</Label>
                <Select
                  value={draft.delivery}
                  disabled={isUploading || deliveryLocked}
                  onValueChange={handleDeliveryChange}
                >
                  <SelectTrigger id="addon-delivery">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={COMPETITION_PRODUCT_DELIVERY.PICKUP}>
                      Physical pickup
                    </SelectItem>
                    <SelectItem value={COMPETITION_PRODUCT_DELIVERY.DOWNLOAD}>
                      PDF download
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="addon-access">Access</Label>
                <Select
                  value={draft.access}
                  disabled={
                    draft.delivery === COMPETITION_PRODUCT_DELIVERY.PICKUP
                  }
                  onValueChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      access: value,
                      priceDollars:
                        value ===
                        COMPETITION_PRODUCT_ACCESS.INCLUDED_WITH_REGISTRATION
                          ? "0.00"
                          : current.priceDollars === "0.00"
                            ? ""
                            : current.priceDollars,
                    }))
                  }
                >
                  <SelectTrigger id="addon-access">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value={COMPETITION_PRODUCT_ACCESS.OPTIONAL_PURCHASE}
                    >
                      Optional line item
                    </SelectItem>
                    <SelectItem
                      value={
                        COMPETITION_PRODUCT_ACCESS.INCLUDED_WITH_REGISTRATION
                      }
                    >
                      Included with registration
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {draft.access === COMPETITION_PRODUCT_ACCESS.OPTIONAL_PURCHASE ? (
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
              ) : (
                <div className="rounded-md border bg-primary/5 p-3 text-sm text-muted-foreground">
                  The download unlocks automatically after registration.
                </div>
              )}
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

            {draft.delivery === COMPETITION_PRODUCT_DELIVERY.PICKUP ? (
              <div className="grid gap-4 sm:grid-cols-2">
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
                      setDraft((d) => ({
                        ...d,
                        maxPerAthlete: e.target.value,
                      }))
                    }
                  />
                </div>
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
                      setDraft((d) => ({
                        ...d,
                        availableUntil: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            ) : null}
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

            {draft.delivery === COMPETITION_PRODUCT_DELIVERY.DOWNLOAD ? (
              <div className="space-y-3 rounded-md border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label>PDF files</Label>
                    <p className="text-xs text-muted-foreground">
                      Files are delivered through the purchase-gated downloads
                      library.
                    </p>
                  </div>
                  <Button asChild type="button" variant="outline" size="sm">
                    <label className="cursor-pointer">
                      <Upload className="mr-1 h-3.5 w-3.5" />
                      {isUploading ? "Uploading…" : "Upload PDF"}
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="sr-only"
                        disabled={isUploading}
                        onChange={(event) => {
                          void handleFileUpload(event.target.files?.[0])
                          event.target.value = ""
                        }}
                      />
                    </label>
                  </Button>
                </div>
                {draft.files.length === 0 ? (
                  <p className="rounded-md bg-muted/50 px-3 py-4 text-center text-sm text-muted-foreground">
                    Upload at least one PDF.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {draft.files.map((file, index) => (
                      <div
                        key={file.id ?? file.r2Key}
                        className="flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-primary" />
                        <Input
                          aria-label={`Title for ${file.originalFilename}`}
                          value={file.title}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              files: current.files.map(
                                (candidate, fileIndex) =>
                                  fileIndex === index
                                    ? {
                                        ...candidate,
                                        title: event.target.value,
                                      }
                                    : candidate,
                              ),
                            }))
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFile(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Remove file</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
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
                              variants: d.variants.filter(
                                (_, variantIndex) => variantIndex !== index,
                              ),
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
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
              disabled={isSaving || isUploading}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || isUploading}>
              {isSaving
                ? "Saving..."
                : editingId
                  ? "Save changes"
                  : "Create product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

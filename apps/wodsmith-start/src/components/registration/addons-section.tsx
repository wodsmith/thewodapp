/**
 * Event merch (registration add-ons) section of the registration form.
 *
 * Renders the organizer's add-on catalog as an optional order bump between
 * the coupon input and the fee summary. Entirely skippable — selecting
 * nothing changes nothing about the registration flow.
 */
import { Minus, Plus, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { PublicAddon } from "@/server-fns/competition-addon-fns"
import { getMaxSelectableQuantity } from "@/utils/addon-availability"
import { cn } from "@/utils/cn"
import { formatRegistrationDate } from "./registration-sections"

/** Stable key for a (product, variant) selection. */
export function addonSelectionKey(
  productId: string,
  variantId: string | null,
): string {
  return `${productId}::${variantId ?? ""}`
}

function QuantityStepper({
  value,
  max,
  disabled,
  onChange,
  label,
}: {
  value: number
  max: number
  disabled?: boolean
  onChange: (next: number) => void
  label: string
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-7 w-7"
        aria-label={`Remove one ${label}`}
        disabled={disabled || value <= 0}
        onClick={() => onChange(value - 1)}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <span
        className={cn(
          "w-7 text-center text-sm tabular-nums",
          value > 0 && "font-semibold",
        )}
      >
        {value}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-7 w-7"
        aria-label={`Add one ${label}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

export function AddOnsSection({
  addons,
  quantities,
  onQuantityChange,
  disabled,
}: {
  addons: PublicAddon[]
  quantities: Map<string, number>
  onQuantityChange: (
    productId: string,
    variantId: string | null,
    quantity: number,
  ) => void
  disabled?: boolean
}) {
  if (addons.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4" />
          Event merch
        </CardTitle>
        <CardDescription>
          Optional add-ons from the organizer, paid with your registration. Pick
          up at the venue.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {addons.map((addon) => {
          const quantityForProduct = (variantId: string | null) =>
            quantities.get(addonSelectionKey(addon.id, variantId)) ?? 0
          const selectedForProduct =
            addon.variants.length > 0
              ? addon.variants.reduce(
                  (sum, v) => sum + quantityForProduct(v.id),
                  0,
                )
              : quantityForProduct(null)
          const productCapReached =
            addon.maxPerAthlete !== null &&
            selectedForProduct >= addon.maxPerAthlete

          return (
            <div key={addon.id} className="rounded-md border p-4">
              <div className="flex gap-3">
                {addon.imageUrl ? (
                  <img
                    src={addon.imageUrl}
                    alt={addon.name}
                    className="h-16 w-16 shrink-0 rounded-md border object-cover"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium">{addon.name}</p>
                    <p className="shrink-0 text-sm font-semibold">
                      ${(addon.unitChargeCents / 100).toFixed(2)}
                    </p>
                  </div>
                  {addon.description ? (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {addon.description}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {addon.availableUntil
                      ? `Order by ${formatRegistrationDate(addon.availableUntil)}`
                      : "Only available with registration"}
                    {addon.maxPerAthlete !== null
                      ? ` · Max ${addon.maxPerAthlete} per athlete`
                      : ""}
                  </p>
                </div>
              </div>

              {addon.variants.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {addon.variants.map((variant) => {
                    const quantity = quantityForProduct(variant.id)
                    const stepperMax = getMaxSelectableQuantity(
                      addon,
                      variant.remaining !== null
                        ? { stockQty: variant.remaining, soldQty: 0 }
                        : null,
                    )
                    // Freeze increments across variants once the per-product
                    // cap is hit, while still allowing decrements.
                    const effectiveMax =
                      productCapReached && quantity < stepperMax
                        ? quantity
                        : stepperMax
                    return (
                      <div
                        key={variant.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="text-sm">
                          {variant.label}
                          {variant.soldOut ? (
                            <span className="ml-2 text-xs font-medium text-muted-foreground">
                              Sold out
                            </span>
                          ) : variant.remaining !== null &&
                            variant.remaining <= 5 ? (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {variant.remaining} left
                            </span>
                          ) : null}
                        </span>
                        <QuantityStepper
                          value={quantity}
                          max={variant.soldOut ? 0 : effectiveMax}
                          disabled={disabled}
                          label={`${addon.name} (${variant.label})`}
                          onChange={(next) =>
                            onQuantityChange(addon.id, variant.id, next)
                          }
                        />
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">
                    Quantity
                  </span>
                  <QuantityStepper
                    value={quantityForProduct(null)}
                    max={getMaxSelectableQuantity(addon, null)}
                    disabled={disabled}
                    label={addon.name}
                    onChange={(next) => onQuantityChange(addon.id, null, next)}
                  />
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

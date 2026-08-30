import { Download, FileDown, FileText, PackageCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  COMPETITION_PRODUCT_ACCESS,
  COMPETITION_PRODUCT_DELIVERY,
} from "@/db/schema"
import type {
  DownloadableProduct,
  RegistrationAddonPurchase,
} from "@/server-fns/registration-fulfillment-fns"

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// @lat: [[commerce#Downloadable Competition Products#Athlete download library]]
export function RegistrationFulfillmentCard({
  purchases,
  downloads,
}: {
  purchases: RegistrationAddonPurchase[]
  downloads: DownloadableProduct[]
}) {
  if (purchases.length === 0 && downloads.length === 0) return null

  return (
    <Card className="overflow-hidden border-primary/30">
      <CardHeader className="bg-primary/5">
        <CardTitle className="flex items-center gap-2">
          <PackageCheck className="h-5 w-5 text-primary" />
          Your add-ons & downloads
        </CardTitle>
        <CardDescription>
          Everything included with your registration or purchased during
          checkout, along with how to receive it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        {purchases.length > 0 ? (
          <section>
            <h3 className="text-sm font-semibold">Purchased add-ons</h3>
            <div className="mt-3 space-y-3">
              {purchases.map((purchase) => (
                <div
                  key={purchase.id}
                  className="flex items-start justify-between gap-4 rounded-md border bg-background p-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {purchase.quantity} × {purchase.name}
                      {purchase.variantLabel
                        ? ` (${purchase.variantLabel})`
                        : ""}
                    </p>
                    {purchase.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {purchase.description}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {purchase.delivery === COMPETITION_PRODUCT_DELIVERY.DOWNLOAD
                      ? "Download below"
                      : "Pick up at competition"}
                  </Badge>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {downloads.length > 0 ? (
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <FileDown className="h-4 w-4 text-primary" />
              Downloads
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              You can return to this registration page to download these files
              again.
            </p>
            <div className="mt-3 space-y-4">
              {downloads.map((product) => (
                <div
                  key={product.id}
                  className="rounded-md border bg-background p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      {product.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {product.description}
                        </p>
                      ) : null}
                    </div>
                    <Badge variant="outline">
                      {product.access ===
                      COMPETITION_PRODUCT_ACCESS.INCLUDED_WITH_REGISTRATION
                        ? "Included with registration"
                        : "Purchased add-on"}
                    </Badge>
                  </div>

                  <div className="mt-4 divide-y border-t">
                    {product.files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between gap-4 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <FileText className="h-5 w-5 shrink-0 text-primary" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {file.title}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              PDF · {formatFileSize(file.fileSize)}
                            </p>
                          </div>
                        </div>
                        <Button asChild size="sm">
                          <a href={`/api/downloads/${file.id}`}>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </CardContent>
    </Card>
  )
}

import { createFileRoute } from "@tanstack/react-router"
import { Download, FileText, PackageCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { COMPETITION_PRODUCT_ACCESS } from "@/db/schema"
import { getMyDownloadsFn } from "@/server-fns/downloadable-product-fns"

export const Route = createFileRoute("/_protected/settings/downloads")({
  component: DownloadsPage,
  loader: () => getMyDownloadsFn(),
})

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function DownloadsPage() {
  const { products } = Route.useLoaderData()

  return (
    <div className="space-y-6 pb-12">
      <div>
        <div className="mb-1.5 text-xs font-bold tracking-[0.18em] text-primary uppercase">
          Your library
        </div>
        <h1 className="font-mono text-3xl font-bold tracking-tight">
          Downloads
        </h1>
        <p className="mt-1.5 max-w-2xl text-muted-foreground">
          Digital products included with your competition registrations and
          add-on purchases.
        </p>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <PackageCheck className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 font-medium">Your library is empty</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Eligible files appear here after a registration or digital add-on
              purchase is complete.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden">
              <CardHeader className="border-b bg-muted/30">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {product.competition.name}
                    </p>
                    <CardTitle className="mt-1 text-lg">
                      {product.name}
                    </CardTitle>
                    {product.description ? (
                      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
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
              </CardHeader>
              <CardContent className="divide-y p-0">
                {product.files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between gap-4 px-5 py-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-background">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{file.title}</p>
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

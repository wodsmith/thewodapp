import { createFileRoute, notFound } from "@tanstack/react-router"
import { CrossFitImportAdmin } from "@/components/crossfit-import-admin"
import { CROSSFIT_TRACK_ID } from "@/lib/crossfit/source"
import { getCrossFitImportsFn } from "@/server-fns/crossfit-import-fns"
export const Route = createFileRoute("/_protected/admin/programming/$trackId/")(
  {
    loader: async ({ params }) => {
      if (params.trackId !== CROSSFIT_TRACK_ID) throw notFound()
      await getCrossFitImportsFn()
    },
    component: CrossFitAdminPage,
  },
)
function CrossFitAdminPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm">
        Admin / Programming / CrossFit.com
      </nav>
      <h1 className="mb-8 text-3xl font-semibold">
        Admin · CrossFit.com imports
      </h1>
      <CrossFitImportAdmin />
    </main>
  )
}

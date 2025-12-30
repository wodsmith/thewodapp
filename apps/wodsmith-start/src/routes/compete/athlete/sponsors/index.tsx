import {createFileRoute, Link, useRouter} from '@tanstack/react-router'
import {useServerFn} from '@tanstack/react-start'
import {ArrowLeft, ExternalLink, Pencil, Plus, Trash2} from 'lucide-react'
import {useEffect, useState} from 'react'
import {toast} from 'sonner'
import {Button} from '@/components/ui/button'
import {Card, CardContent} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {
  createSponsorFn,
  deleteSponsorFn,
  getSponsorsPageDataFn,
  updateSponsorFn,
} from '@/server-fns/sponsor-fns'

export const Route = createFileRoute('/compete/athlete/sponsors/')({
  component: AthleteSponsorsPage,
  loader: async () => {
    return await getSponsorsPageDataFn()
  },
})

// ============================================================================
// Types
// ============================================================================

type Sponsor = {
  id: string
  name: string
  logoUrl: string | null
  website: string | null
}

// ============================================================================
// Component
// ============================================================================

function AthleteSponsorsPage() {
  const {sponsors: initialSponsors, userId} = Route.useLoaderData()
  const router = useRouter()

  const [sponsors, setSponsors] = useState<Sponsor[]>(initialSponsors)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formLogoUrl, setFormLogoUrl] = useState('')
  const [formWebsite, setFormWebsite] = useState('')

  // Server functions
  const createSponsor = useServerFn(createSponsorFn)
  const updateSponsor = useServerFn(updateSponsorFn)
  const deleteSponsor = useServerFn(deleteSponsorFn)

  // Sync state with props
  useEffect(() => {
    setSponsors(initialSponsors)
  }, [initialSponsors])

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (showAddDialog) {
      setFormName('')
      setFormLogoUrl('')
      setFormWebsite('')
    }
  }, [showAddDialog])

  useEffect(() => {
    if (editingSponsor) {
      setFormName(editingSponsor.name)
      setFormLogoUrl(editingSponsor.logoUrl || '')
      setFormWebsite(editingSponsor.website || '')
    }
  }, [editingSponsor])

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error('Sponsor name is required')
      return
    }

    setIsSubmitting(true)
    try {
      await createSponsor({
        data: {
          userId,
          name: formName.trim(),
          logoUrl: formLogoUrl.trim() || undefined,
          website: formWebsite.trim() || undefined,
        },
      })
      toast.success('Sponsor added')
      setShowAddDialog(false)
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to add sponsor',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingSponsor || !formName.trim()) {
      toast.error('Sponsor name is required')
      return
    }

    setIsSubmitting(true)
    try {
      await updateSponsor({
        data: {
          sponsorId: editingSponsor.id,
          name: formName.trim(),
          logoUrl: formLogoUrl.trim() || null,
          website: formWebsite.trim() || null,
        },
      })
      toast.success('Sponsor updated')
      setEditingSponsor(null)
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update sponsor',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (sponsorId: string) => {
    try {
      await deleteSponsor({data: {sponsorId}})
      toast.success('Sponsor removed')
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to remove sponsor',
      )
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link to="/compete/athlete">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">My Sponsors</h1>
            <p className="text-muted-foreground mt-1">
              Manage your sponsors and partnerships
            </p>
          </div>
        </div>
      </div>

      {/* Add button */}
      <div className="flex justify-end">
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Sponsor
        </Button>
      </div>

      {/* Sponsors grid */}
      {sponsors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No sponsors yet</p>
            <p className="text-muted-foreground text-sm mb-6 text-center max-w-md">
              Add your sponsors and partners to showcase them on your athlete
              profile.
            </p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Sponsor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sponsors.map((sponsor) => (
            <Card key={sponsor.id} className="group relative">
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center gap-3">
                  {sponsor.logoUrl ? (
                    <div className="relative h-20 w-full flex items-center justify-center">
                      <img
                        src={sponsor.logoUrl}
                        alt={sponsor.name}
                        className="h-20 w-auto object-contain"
                      />
                    </div>
                  ) : (
                    <div className="h-20 flex items-center justify-center">
                      <p className="text-lg font-semibold">{sponsor.name}</p>
                    </div>
                  )}

                  {sponsor.logoUrl && (
                    <p className="font-medium text-sm">{sponsor.name}</p>
                  )}

                  {sponsor.website && (
                    <Button
                      asChild
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                    >
                      <a
                        href={sponsor.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Website
                      </a>
                    </Button>
                  )}
                </div>

                {/* Actions (show on hover) */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setEditingSponsor(sponsor)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(sponsor.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Sponsor</DialogTitle>
            <DialogDescription>
              Add a new sponsor to your athlete profile.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Sponsor name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                value={formLogoUrl}
                onChange={(e) => setFormLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={formWebsite}
                onChange={(e) => setFormWebsite(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Sponsor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingSponsor}
        onOpenChange={(open) => !open && setEditingSponsor(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sponsor</DialogTitle>
            <DialogDescription>Update sponsor details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Sponsor name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-logoUrl">Logo URL</Label>
              <Input
                id="edit-logoUrl"
                value={formLogoUrl}
                onChange={(e) => setFormLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-website">Website</Label>
              <Input
                id="edit-website"
                value={formWebsite}
                onChange={(e) => setFormWebsite(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSponsor(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

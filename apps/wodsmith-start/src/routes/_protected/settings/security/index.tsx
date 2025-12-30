import {createFileRoute, useRouter} from '@tanstack/react-router'
import {useServerFn} from '@tanstack/react-start'
import {formatDistanceToNow} from 'date-fns'
import {Loader2} from 'lucide-react'
import {useState} from 'react'
import {toast} from 'sonner'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {Skeleton} from '@/components/ui/skeleton'
import {cn} from '@/lib/utils'
import {
  deletePasskeyFn,
  getUserPasskeysFn,
  type PasskeyWithMeta,
} from '@/server-fns/passkey-fns'
import {PASSKEY_AUTHENTICATOR_IDS} from '@/utils/passkey-authenticator-ids'

export const Route = createFileRoute('/_protected/settings/security/')({
  component: SecurityPage,
  pendingComponent: SecurityPageSkeleton,
  loader: async () => {
    const data = await getUserPasskeysFn()
    return data
  },
})

function SecurityPageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-4xl font-bold">SECURITY</h1>
        <p className="text-muted-foreground mt-2">
          Manage your passkeys for passwordless authentication
        </p>
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[100px] w-full" />
        ))}
      </div>
    </div>
  )
}

function SecurityPage() {
  const {passkeys, currentPasskeyId, email} = Route.useLoaderData()

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-4xl font-bold">SECURITY</h1>
        <p className="text-muted-foreground mt-2">
          Manage your passkeys for passwordless authentication
        </p>
      </div>
      <PasskeysList
        passkeys={passkeys}
        currentPasskeyId={currentPasskeyId}
        email={email}
      />
    </div>
  )
}

interface PasskeysListProps {
  passkeys: PasskeyWithMeta[]
  currentPasskeyId: string | null
  email: string | null
}

function PasskeysList({passkeys, currentPasskeyId, email}: PasskeysListProps) {
  const router = useRouter()
  const deletePasskey = useServerFn(deletePasskeyFn)
  const [deletingCredentialId, setDeletingCredentialId] = useState<
    string | null
  >(null)
  const [openDialogId, setOpenDialogId] = useState<string | null>(null)

  const handleDeletePasskey = async (credentialId: string) => {
    setDeletingCredentialId(credentialId)
    try {
      await deletePasskey({data: {credentialId}})
      toast.success('Passkey deleted')
      setOpenDialogId(null)
      router.invalidate()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete passkey'
      toast.error(message)
    } finally {
      setDeletingCredentialId(null)
    }
  }

  const isCurrentPasskey = (passkey: PasskeyWithMeta) =>
    passkey.credentialId === currentPasskeyId

  const getAuthenticatorName = (aaguid: string | null) => {
    if (!aaguid) return 'Unknown Authenticator'
    return (
      (PASSKEY_AUTHENTICATOR_IDS as Record<string, string>)[aaguid] ??
      'Unknown Authenticator'
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Passkeys</h2>
          <p className="text-sm text-muted-foreground">
            Manage your passkeys for passwordless authentication.
          </p>
        </div>
        {email && (
          // TODO: Implement WebAuthn registration
          // This requires the @simplewebauthn/browser package and server-side registration options
          // See apps/wodsmith/src/app/(settings)/settings/security/passkey.client.tsx for reference
          <Button disabled className="w-full sm:w-auto">
            Register Passkey (Coming Soon)
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {passkeys.map((passkey) => (
          <Card
            key={passkey.id}
            className={cn(
              !isCurrentPasskey(passkey)
                ? 'bg-card/40'
                : 'border-2 border-primary/20 shadow-lg bg-secondary/30',
            )}
          >
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                      {getAuthenticatorName(passkey.aaguid)}
                      {isCurrentPasskey(passkey) && (
                        <Badge>Current Passkey</Badge>
                      )}
                    </CardTitle>
                    <div className="text-sm text-muted-foreground whitespace-nowrap">
                      &nbsp;·&nbsp;{formatDistanceToNow(passkey.createdAt)} ago
                    </div>
                  </div>
                  {passkey.parsedUserAgent && (
                    <CardDescription className="text-sm">
                      {passkey.parsedUserAgent.browser.name ??
                        'Unknown browser'}{' '}
                      {passkey.parsedUserAgent.browser.major ??
                        'Unknown version'}{' '}
                      on{' '}
                      {passkey.parsedUserAgent.device.vendor ??
                        'Unknown device'}{' '}
                      {passkey.parsedUserAgent.device.model ?? 'Unknown model'}{' '}
                      {passkey.parsedUserAgent.device.type ?? 'Unknown type'} (
                      {passkey.parsedUserAgent.os.name ?? 'Unknown OS'}{' '}
                      {passkey.parsedUserAgent.os.version ?? 'Unknown version'})
                    </CardDescription>
                  )}
                </div>
                <div>
                  {!isCurrentPasskey(passkey) && (
                    <Dialog
                      open={openDialogId === passkey.credentialId}
                      onOpenChange={(open) =>
                        setOpenDialogId(open ? passkey.credentialId : null)
                      }
                    >
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="w-full sm:w-auto"
                        >
                          Delete passkey
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Delete passkey?</DialogTitle>
                          <DialogDescription>
                            This will remove this passkey from your account.
                            This action cannot be undone.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="mt-6 sm:mt-0">
                          <Button
                            variant="outline"
                            onClick={() => setOpenDialogId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            className="mb-4 sm:mb-0"
                            disabled={
                              deletingCredentialId === passkey.credentialId
                            }
                            onClick={() =>
                              handleDeletePasskey(passkey.credentialId)
                            }
                          >
                            {deletingCredentialId === passkey.credentialId && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Delete passkey
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}

        {passkeys.length === 0 && (
          <div className="text-center py-16 border-2 border-dashed border-muted rounded-lg bg-muted/50">
            <p className="text-muted-foreground text-lg">
              No passkeys found. Add a passkey to enable passwordless
              authentication.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

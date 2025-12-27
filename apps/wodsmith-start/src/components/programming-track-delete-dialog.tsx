'use client'

import {useRef, useState} from 'react'
import {Button} from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {deleteProgrammingTrackFn} from '@/server-fns/programming-fns'

interface ProgrammingTrackDeleteDialogProps {
  track: {
    id: string
    name: string
  }
  trigger: React.ReactNode
  onSuccess?: () => void
  onError?: (error: Error) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ProgrammingTrackDeleteDialog({
  track,
  trigger,
  onSuccess,
  onError,
  open,
  onOpenChange,
}: ProgrammingTrackDeleteDialogProps) {
  const dialogCloseRef = useRef<HTMLButtonElement>(null)
  const [isPending, setIsPending] = useState(false)

  const handleDelete = async () => {
    try {
      setIsPending(true)
      await deleteProgrammingTrackFn({data: {trackId: track.id}})
      onSuccess?.()
      dialogCloseRef.current?.click()
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Failed to delete'))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="top"
        className="border-4 border-red-500 shadow-[8px_8px_0px_0px] shadow-red-500 rounded-none mx-auto max-w-lg"
      >
        <SheetHeader>
          <SheetTitle className="font-mono text-xl tracking-tight text-red-600">
            Delete Programming Track
          </SheetTitle>
          <SheetDescription className="font-mono text-sm">
            Are you sure you want to delete "{track.name}"? This action cannot
            be undone. All workouts associated with this track will also be
            removed.
          </SheetDescription>
        </SheetHeader>
        <SheetFooter className="mt-4 flex flex-col gap-4 sm:flex-row">
          <SheetClose ref={dialogCloseRef} asChild>
            <Button className="sm:w-auto w-full border-2 border-primary shadow-[4px_4px_0px_0px] shadow-primary hover:shadow-[2px_2px_0px_0px] transition-all font-mono bg-white text-primary hover:bg-surface rounded-none">
              Cancel
            </Button>
          </SheetClose>
          <Button
            onClick={handleDelete}
            disabled={isPending}
            className="sm:w-auto w-full border-2 border-red-500 shadow-[4px_4px_0px_0px] shadow-red-500 hover:shadow-[2px_2px_0px_0px] transition-all font-mono bg-red-500 text-white hover:bg-red-600 rounded-none"
          >
            {isPending ? 'Deleting...' : 'Delete Track'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

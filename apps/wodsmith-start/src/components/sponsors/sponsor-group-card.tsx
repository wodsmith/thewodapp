'use client'

import {combine} from '@atlaskit/pragmatic-drag-and-drop/combine'
import {
  draggable,
  dropTargetForElements,
  type ElementDropTargetEventBasePayload,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import {pointerOutsideOfPreview} from '@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview'
import {setCustomNativeDragPreview} from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview'
import {
  attachClosestEdge,
  type Edge,
  extractClosestEdge,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
import {DropIndicator} from '@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box'
import {GripVertical, MoreHorizontal, Pencil, Plus, Trash2} from 'lucide-react'
import {useCallback, useEffect, useRef, useState} from 'react'
import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type {Sponsor, SponsorGroup} from '@/db/schemas/sponsors'
import {DraggableSponsorCard} from './sponsor-card'

interface SponsorGroupCardProps {
  group: SponsorGroup
  sponsors: Sponsor[]
  index: number
  instanceId: symbol
  sponsorInstanceId: symbol
  onEditGroup: () => void
  onDeleteGroup: () => void
  onAddSponsor: () => void
  onEditSponsor: (sponsor: Sponsor) => void
  onDeleteSponsor: (sponsorId: string) => void
  onDropGroup: (sourceIndex: number, targetIndex: number) => void
  onDropSponsor: (
    groupId: string,
    sourceIndex: number,
    targetIndex: number,
  ) => void
}

export function SponsorGroupCard({
  group,
  sponsors,
  index,
  instanceId,
  sponsorInstanceId,
  onEditGroup,
  onDeleteGroup,
  onAddSponsor,
  onEditSponsor,
  onDeleteSponsor,
  onDropGroup,
  onDropSponsor,
}: SponsorGroupCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const dragHandleRef = useRef<HTMLButtonElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null)
  const closestEdgeRef = useRef<Edge | null>(null)

  const isSingleSponsor = sponsors.length === 1

  const updateClosestEdge = useCallback((edge: Edge | null) => {
    closestEdgeRef.current = edge
    setClosestEdge(edge)
  }, [])

  useEffect(() => {
    const element = ref.current
    const dragHandle = dragHandleRef.current
    if (!element || !dragHandle) return

    const groupData = {
      id: group.id,
      index,
      instanceId,
      type: 'group' as const,
    }

    return combine(
      draggable({
        element: dragHandle,
        getInitialData: () => groupData,
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
        onGenerateDragPreview({nativeSetDragImage}) {
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: pointerOutsideOfPreview({
              x: '16px',
              y: '8px',
            }),
            render({container}) {
              const preview = document.createElement('div')
              preview.style.cssText = `
								background: hsl(var(--background));
								border: 2px solid hsl(var(--border));
								border-radius: 6px;
								padding: 8px 12px;
								font-size: 14px;
								color: hsl(var(--foreground));
								box-shadow: 0 2px 8px rgba(0,0,0,0.15);
							`
              preview.textContent = group.name
              container.appendChild(preview)
            },
          })
        },
      }),
      dropTargetForElements({
        element,
        canDrop: ({source}) => {
          return (
            source.data.type === 'group' &&
            source.data.instanceId === instanceId &&
            source.data.index !== index
          )
        },
        getData({input}) {
          return attachClosestEdge(groupData, {
            element,
            input,
            allowedEdges: ['top', 'bottom'],
          })
        },
        onDrag({source, self}: ElementDropTargetEventBasePayload) {
          if (source.data.index === index) {
            updateClosestEdge(null)
            return
          }

          const edge = extractClosestEdge(self.data)
          const sourceIndex = source.data.index

          if (typeof sourceIndex !== 'number') return

          const isItemBeforeSource = index === sourceIndex - 1
          const isItemAfterSource = index === sourceIndex + 1

          const isDropIndicatorHidden =
            (isItemBeforeSource && edge === 'bottom') ||
            (isItemAfterSource && edge === 'top')

          updateClosestEdge(isDropIndicatorHidden ? null : edge)
        },
        onDragLeave: () => updateClosestEdge(null),
        onDrop({source}) {
          const sourceIndex = source.data.index
          if (typeof sourceIndex === 'number' && sourceIndex !== index) {
            const edge = closestEdgeRef.current
            const targetIndex = edge === 'top' ? index : index + 1
            const adjustedTargetIndex =
              sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
            onDropGroup(sourceIndex, adjustedTargetIndex)
          }
          updateClosestEdge(null)
        },
      }),
    )
  }, [group.id, group.name, index, instanceId, onDropGroup, updateClosestEdge])

  const handleSponsorDrop = useCallback(
    (sourceIndex: number, targetIndex: number) => {
      onDropSponsor(group.id, sourceIndex, targetIndex)
    },
    [group.id, onDropSponsor],
  )

  return (
    <div ref={ref} className="relative">
      {closestEdge && <DropIndicator edge={closestEdge} gap="8px" />}
      <Card className={isDragging ? 'opacity-50' : ''}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <button
              ref={dragHandleRef}
              type="button"
              className="cursor-grab active:cursor-grabbing"
              aria-label="Drag to reorder group"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </button>
            <div>
              <CardTitle className="text-lg">{group.name}</CardTitle>
              <CardDescription>
                {sponsors.length} sponsor{sponsors.length !== 1 ? 's' : ''}
                {isSingleSponsor && ' (Featured)'}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onAddSponsor}>
              <Plus className="mr-2 h-4 w-4" />
              Add Sponsor
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Group actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEditGroup}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Group
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDeleteGroup}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Group
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          {sponsors.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              No sponsors in this group yet
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sponsors.map((sponsor, sponsorIndex) => (
                <DraggableSponsorCard
                  key={sponsor.id}
                  sponsor={sponsor}
                  index={sponsorIndex}
                  instanceId={sponsorInstanceId}
                  groupId={group.id}
                  featured={isSingleSponsor}
                  onEdit={() => onEditSponsor(sponsor)}
                  onDelete={() => onDeleteSponsor(sponsor.id)}
                  onDrop={handleSponsorDrop}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

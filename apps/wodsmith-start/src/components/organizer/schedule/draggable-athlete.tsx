'use client'

import {draggable} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import {pointerOutsideOfPreview} from '@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview'
import {setCustomNativeDragPreview} from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview'
import {Check, GripVertical} from 'lucide-react'
import {useEffect, useRef, useState} from 'react'
import {Badge} from '@/components/ui/badge'

interface Registration {
  id: string
  teamName: string | null
  registeredAt: Date
  user: {
    id: string
    firstName: string | null
    lastName: string | null
  }
  division: {
    id: string
    label: string
  } | null
}

interface DraggableAthleteProps {
  registration: Registration
  isSelected?: boolean
  onToggleSelect?: (id: string, shiftKey: boolean) => void
  selectedCount?: number
  selectedIds?: Set<string>
}

export function DraggableAthlete({
  registration,
  isSelected = false,
  onToggleSelect,
  selectedIds,
}: DraggableAthleteProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const displayName =
    registration.teamName ??
    (`${registration.user.firstName ?? ''} ${registration.user.lastName ?? ''}`.trim() ||
      'Unknown')

  // Format: yy-mm-dd-hh (will show points instead when available)
  const sortIndicator = (() => {
    const date = new Date(registration.registeredAt)
    const yy = String(date.getFullYear()).slice(-2)
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    const hh = String(date.getHours()).padStart(2, '0')
    return `${yy}-${mm}-${dd}-${hh}`
  })()

  useEffect(() => {
    const element = ref.current
    if (!element) return

    return draggable({
      element,
      getInitialData: () => {
        // If this item is selected and there are multiple selections, include all
        const isDraggingMultiple =
          isSelected && selectedIds && selectedIds.size > 1
        const registrationIds = isDraggingMultiple
          ? Array.from(selectedIds)
          : [registration.id]

        return {
          type: 'athlete',
          registrationId: registration.id,
          registrationIds, // Array of all IDs being dragged
          displayName,
          divisionLabel: registration.division?.label,
          count: registrationIds.length,
        }
      },
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
      onGenerateDragPreview({nativeSetDragImage}) {
        const isDraggingMultiple =
          isSelected && selectedIds && selectedIds.size > 1
        const count = isDraggingMultiple ? selectedIds.size : 1

        setCustomNativeDragPreview({
          nativeSetDragImage,
          getOffset: pointerOutsideOfPreview({x: '16px', y: '8px'}),
          render({container}) {
            const preview = document.createElement('div')
            preview.style.cssText = `
							background: hsl(var(--background));
							border: 2px solid hsl(var(--primary));
							border-radius: 6px;
							padding: 8px 12px;
							font-size: 14px;
							color: hsl(var(--foreground));
							box-shadow: 0 4px 12px rgba(0,0,0,0.25);
							display: flex;
							align-items: center;
							gap: 8px;
						`
            if (count > 1) {
              const badge = document.createElement('span')
              badge.style.cssText = `
								background: hsl(var(--primary));
								color: hsl(var(--primary-foreground));
								border-radius: 9999px;
								padding: 2px 8px;
								font-size: 12px;
								font-weight: 600;
							`
              badge.textContent = String(count)
              preview.appendChild(badge)
              preview.appendChild(document.createTextNode('athletes'))
            } else {
              preview.textContent = displayName
            }
            container.appendChild(preview)
          },
        })
      },
    })
  }, [
    registration.id,
    displayName,
    registration.division?.label,
    isSelected,
    selectedIds,
  ])

  function handleClick(e: React.MouseEvent) {
    if (onToggleSelect) {
      e.preventDefault()
      onToggleSelect(registration.id, e.shiftKey)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (onToggleSelect) {
        onToggleSelect(registration.id, e.shiftKey)
      }
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop element with conditional click handler
    <div
      ref={ref}
      role={onToggleSelect ? 'button' : undefined}
      tabIndex={onToggleSelect ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={onToggleSelect ? handleKeyDown : undefined}
      className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded cursor-grab active:cursor-grabbing transition-colors ${
        isDragging ? 'opacity-50' : ''
      } ${
        isSelected
          ? 'bg-primary/20 ring-1 ring-primary'
          : 'bg-muted hover:bg-muted/80'
      }`}
    >
      {onToggleSelect ? (
        <div
          className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 ${
            isSelected
              ? 'bg-primary border-primary text-primary-foreground'
              : 'border-muted-foreground/50'
          }`}
        >
          {isSelected && <Check className="h-3 w-3" />}
        </div>
      ) : (
        <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      )}
      <span className="flex-1 truncate">{displayName}</span>
      <Badge variant="outline" className="text-xs flex-shrink-0 font-mono">
        {sortIndicator}
      </Badge>
    </div>
  )
}

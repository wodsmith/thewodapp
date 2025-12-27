'use client'

import {draggable} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import {pointerOutsideOfPreview} from '@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview'
import {setCustomNativeDragPreview} from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview'
import {GripVertical} from 'lucide-react'
import {useEffect, useRef, useState} from 'react'
import {Badge} from '@/components/ui/badge'

interface DraggableDivisionProps {
  divisionId: string
  divisionName: string
  registrationIds: string[]
}

export function DraggableDivision({
  divisionId,
  divisionName,
  registrationIds,
}: DraggableDivisionProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const athleteCount = registrationIds.length

  useEffect(() => {
    const element = ref.current
    if (!element) return

    return draggable({
      element,
      getInitialData: () => ({
        type: 'division',
        divisionId,
        divisionName,
        registrationIds,
      }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
      onGenerateDragPreview({nativeSetDragImage}) {
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

            // Division name
            const nameSpan = document.createElement('span')
            nameSpan.style.fontWeight = '600'
            nameSpan.textContent = divisionName
            preview.appendChild(nameSpan)

            // Athlete count in badge
            const badge = document.createElement('span')
            badge.style.cssText = `
							background: hsl(var(--muted));
							color: hsl(var(--muted-foreground));
							border-radius: 6px;
							padding: 2px 6px;
							font-size: 12px;
						`
            badge.textContent = `${athleteCount} athlete${athleteCount !== 1 ? 's' : ''}`
            preview.appendChild(badge)

            container.appendChild(preview)
          },
        })
      },
    })
  }, [divisionId, divisionName, registrationIds, athleteCount])

  return (
    <div
      ref={ref}
      className={`flex items-center gap-2 text-sm px-3 py-2 rounded cursor-grab active:cursor-grabbing transition-colors border ${
        isDragging ? 'opacity-50' : ''
      } bg-muted hover:bg-muted/80 border-muted-foreground/20`}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <span className="flex-1 font-medium">{divisionName}</span>
      <Badge variant="secondary" className="text-xs flex-shrink-0">
        {athleteCount} {athleteCount !== 1 ? 'athletes' : 'athlete'}
      </Badge>
    </div>
  )
}

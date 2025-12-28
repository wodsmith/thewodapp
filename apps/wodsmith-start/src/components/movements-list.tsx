'use client'

import {Search, X} from 'lucide-react'
import {useMemo, useState} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {MOVEMENT_TYPE_VALUES, type Movement} from '@/db/schemas/workouts'

// Flexible movement type that can accept partial Movement data
type MovementData = Pick<Movement, 'id' | 'name' | 'type'>

interface MovementsListProps {
  movements: MovementData[]
  selectedMovements?: string[]
  onMovementToggle?: (movementId: string) => void
  mode?: 'selectable' | 'display'
  variant?: 'default' | 'compact'
  className?: string
  showLabel?: boolean
  containerHeight?: string
}

export function MovementsList({
  movements,
  selectedMovements = [],
  onMovementToggle,
  mode: _mode = 'selectable',
  variant = 'default',
  className = '',
  showLabel = true,
  containerHeight = 'h-[500px]',
}: MovementsListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const filteredMovements = useMemo(() => {
    return movements.filter((movement) => {
      const matchesSearch = movement.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
      const matchesType = typeFilter === 'all' || movement.type === typeFilter
      return matchesSearch && matchesType
    })
  }, [movements, searchQuery, typeFilter])

  const clearFilters = () => {
    setSearchQuery('')
    setTypeFilter('all')
  }

  const hasActiveFilters = searchQuery || typeFilter !== 'all'

  return (
    <div className={className}>
      {showLabel && (
        <Label
          htmlFor="movements-list"
          className="mb-2 block font-bold uppercase"
        >
          Movements
        </Label>
      )}

      {/* Search and Filter Controls */}
      <div className="mb-4 space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search movements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="sm:w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {MOVEMENT_TYPE_VALUES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="icon"
              onClick={clearFilters}
              title="Clear filters"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {hasActiveFilters && (
          <div className="text-sm text-muted-foreground">
            Showing {filteredMovements.length} of {movements.length} movements
          </div>
        )}
      </div>

      {/* Movements List */}
      <div
        id="movements-list"
        className={`${containerHeight} overflow-y-auto sm:p-4`}
      >
        <div className="space-y-2">
          {filteredMovements.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              No movements found
            </div>
          ) : (
            filteredMovements.map((movement) => {
              const isSelected = selectedMovements.includes(movement.id)

              if (variant === 'compact') {
                return (
                  <Button
                    key={movement.id}
                    type="button"
                    variant={isSelected ? 'default' : 'outline'}
                    className="w-full justify-between"
                    onClick={() => onMovementToggle?.(movement.id)}
                  >
                    <span className="font-bold">{movement.name}</span>
                    <span className="text-xs uppercase">{movement.type}</span>
                  </Button>
                )
              }

              // Default variant - custom button styling
              return (
                <button
                  key={movement.id}
                  type="button"
                  onClick={() => onMovementToggle?.(movement.id)}
                  aria-pressed={isSelected}
                  className={`flex w-full cursor-pointer items-center justify-between border px-2 py-1 rounded-md transition-colors ${
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <span className="font-bold">{movement.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase">{movement.type}</span>
                    {isSelected && <span className="text-xs">✓</span>}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

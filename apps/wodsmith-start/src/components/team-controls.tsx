import {RefreshCw} from 'lucide-react'
import {Button} from '@/components/ui/button'

type ViewMode = 'daily' | 'weekly'

interface TeamControlsProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onRefresh: () => void
}

export function TeamControls({
  viewMode,
  onViewModeChange,
  onRefresh,
}: TeamControlsProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
      {/* View Mode Toggle */}
      <div className="flex border rounded-md">
        <Button
          variant={viewMode === 'daily' ? 'default' : 'ghost'}
          onClick={() => onViewModeChange('daily')}
          className="rounded-r-none"
        >
          Today
        </Button>
        <Button
          variant={viewMode === 'weekly' ? 'default' : 'ghost'}
          onClick={() => onViewModeChange('weekly')}
          className="rounded-l-none"
        >
          This Week
        </Button>
      </div>

      {/* Refresh Button */}
      <Button variant="outline" onClick={onRefresh}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Refresh
      </Button>
    </div>
  )
}

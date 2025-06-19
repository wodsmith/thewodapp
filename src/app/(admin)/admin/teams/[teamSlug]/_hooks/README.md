# Workout Selection Modal Refactoring

## Overview

The `WorkoutSelectionModal` has been refactored from a large monolithic component (~570 lines) into a more maintainable architecture using custom hooks. This separation of concerns makes the code more readable, testable, and reusable.

## Architecture

### Original Structure
- Single large component with all logic mixed together
- ~570 lines of code
- Difficult to test individual pieces
- Hard to understand and maintain

### Refactored Structure
- Main component (~240 lines) focused on rendering
- 5 specialized custom hooks handling different concerns
- Each hook is focused on a single responsibility
- Easier to test, debug, and maintain

## Custom Hooks

### 1. `useWorkoutData`
**Purpose**: Manages all data fetching and caching
- Loads team tracks, workouts, and scheduled workouts
- Handles loading states
- Manages data refresh operations
- Provides data reset functionality

### 2. `useWorkoutSelection`
**Purpose**: Manages workout selection state
- Tracks selected track, workout, and standalone workout
- Handles selection change events
- Ensures proper state clearing when switching contexts
- Provides selection reset functionality

### 3. `useWorkoutScheduling`
**Purpose**: Handles all scheduling operations
- Schedule workouts and standalone workouts
- Update scheduled workout details
- Delete scheduled workouts
- Manages scheduling-related loading states

### 4. `useWorkoutEditing`
**Purpose**: Manages workout editing operations
- Loads workout details for editing
- Handles workout updates
- Manages movements and tags data
- Provides editing state management

### 5. `useModalState`
**Purpose**: Manages modal form state
- Form data (class times, team notes, scaling guidance)
- Form reset functionality
- Form data getters and setters
- Centralized form state management

## Benefits of Refactoring

### 1. **Separation of Concerns**
Each hook has a single, well-defined responsibility, making the code easier to understand and reason about.

### 2. **Reusability**
Hooks can be reused in other components that need similar functionality.

### 3. **Testability**
Each hook can be tested independently, making unit testing much easier.

### 4. **Maintainability**
Changes to specific functionality are isolated to their respective hooks.

### 5. **Readability**
The main component is now much more readable, focusing on the UI logic rather than business logic.

### 6. **Type Safety**
Each hook has well-defined interfaces and proper TypeScript types.

## Usage

```tsx
import { WorkoutSelectionModal } from "./workout-selection-modal-refactored-with-hooks"

// Usage remains the same
<WorkoutSelectionModal
  isOpen={isOpen}
  onCloseAction={handleClose}
  selectedDate={selectedDate}
  teamId={teamId}
  onWorkoutScheduledAction={handleWorkoutScheduled}
/>
```

## File Structure

```
_hooks/
├── index.ts                    # Barrel export for hooks
├── useWorkoutData.ts          # Data fetching and management
├── useWorkoutSelection.ts     # Selection state management
├── useWorkoutScheduling.ts    # Scheduling operations
├── useWorkoutEditing.ts       # Workout editing operations
└── useModalState.ts           # Form state management

_components/
├── workout-selection-modal-refactored-with-hooks.tsx  # New refactored component
└── workout-selection-modal-refactored.tsx            # Original component
```

## Migration Guide

The refactored component has the same public API as the original, with one small change:
- `onClose` prop renamed to `onCloseAction` (to comply with Next.js client component requirements)

## Performance Considerations

- Hooks use `useCallback` to prevent unnecessary re-renders
- Data fetching is optimized with proper dependencies
- State updates are batched where possible
- Loading states are managed efficiently

## Testing

Each hook can now be tested independently:

```tsx
import { renderHook } from '@testing-library/react'
import { useWorkoutData } from '../_hooks/useWorkoutData'

test('useWorkoutData loads data correctly', () => {
  const { result } = renderHook(() => useWorkoutData({
    isOpen: true,
    teamId: 'test-team',
    selectedDate: new Date(),
    selectedTrack: null
  }))
  
  // Test hook behavior
})
```

## Future Improvements

1. **Error Boundaries**: Add error boundaries around hook usage
2. **Caching**: Implement more sophisticated caching strategies
3. **Optimistic Updates**: Add optimistic updates for better UX
4. **Background Sync**: Implement background data synchronization
5. **Offline Support**: Add offline capability with local storage

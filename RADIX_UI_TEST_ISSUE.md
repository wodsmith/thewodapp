# Radix UI + React 19 Testing Issue

## Problem

Both `create-workout-client.test.tsx` and `edit-workout-client.test.tsx` fail with:

```
Error: Maximum update depth exceeded. This can happen when a component 
repeatedly calls setState inside componentWillUpdate or componentDidUpdate.
```

## Root Cause

**Not a selector issue** - the original cell description was incorrect.

The issue is a systemic incompatibility between:
- `@radix-ui/react-compose-refs@1.1.2`
- `react@19.2.1` / `react-dom@19.2.1`
- `jsdom` test environment in Vitest

### Stack Trace

```
setRef @radix-ui/react-compose-refs@1.1.2/dist/index.mjs:5:12
dispatchSetStateInternal react-dom@19.2.1/cjs/react-dom-client.development.js:9167:18
```

The `setRef` function in Radix's compose-refs triggers an infinite re-render loop during test environment initialization.

## Affected Components

Any component using Radix UI primitives:
- `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`
- `Button` (with `asChild` prop using Radix Slot)
- `Label`
- Any other Radix primitive with ref composition

## Attempted Fixes (All Failed)

1. ✗ Mocked `@/components/ui/select` with simple divs
2. ✗ Mocked `@/components/ui/button` with basic button element
3. ✗ Mocked `@/components/ui/label` with native label
4. ✗ Mocked `MovementsList` component
5. ✗ Mocked `WorkoutScalingDescriptionsEditor` component
6. ✗ Added server action mocks (`useServerAction`, `getScalingGroupWithLevelsAction`)

**None of these worked** - the infinite loop occurs at render time before any test logic runs.

## Solutions (In Order of Preference)

### Option 1: Upgrade Radix UI (RECOMMENDED)

Check if newer Radix UI versions are React 19 compatible:

```bash
pnpm update @radix-ui/react-select @radix-ui/react-compose-refs
```

Look for versions that explicitly support React 19.

### Option 2: Change Test Environment

Modify `vitest.config.ts` to use a different test environment or configure jsdom differently:

```typescript
export default defineConfig({
  test: {
    environment: 'happy-dom', // Instead of jsdom
    // or configure jsdom differently
  },
})
```

### Option 3: Comprehensive Radix Mock

Create a proper mock in `test/setup.ts` that handles ref composition correctly. This requires understanding Radix's internal ref forwarding mechanism.

### Option 4: React 18 for Tests Only

As a last resort, use React 18 in the test environment while keeping React 19 in production. Not ideal but would unblock tests.

## Files Modified

- `apps/wodsmith/src/app/(main)/workouts/[id]/edit/_components/edit-workout-client.test.tsx`
  - Added mocks for `useServerAction`, `getScalingGroupWithLevelsAction`
  - Added mocks for Radix components (Select, Button, Label)
  - Added mocks for child components (MovementsList, WorkoutScalingDescriptionsEditor)
  - Added comprehensive documentation comment explaining the issue

## Next Steps

1. Research Radix UI + React 19 compatibility
2. Check Radix UI issue tracker for known issues
3. Test with upgraded Radix packages
4. If upgrade doesn't work, try happy-dom instead of jsdom
5. Consider opening issue with Radix UI if not already reported

## Related

- Similar issue in `create-workout-client.test.tsx` (cell: thewodapp-rua)
- Both tests need the same systemic fix

# Code Review: Competition Location Branch

**Branch**: `claude/add-competition-location-cm4Io`
**Date**: 2026-01-28
**Reviewers**: TypeScript (Anders), React Core, TanStack Start

## Summary

This branch adds competition location/address management and video submission features. Overall well-structured and follows established patterns, but several type safety, React patterns, and TanStack-specific issues need addressing.

---

## Critical Issues

### 1. Type Mismatch: AddressType Enum Inconsistency

**Files**: `src/db/schemas/addresses.ts` vs `src/schemas/address.ts`

```typescript
// Database schema defines:
export const ADDRESS_TYPE_ENUM = {
  BILLING: "billing",
  SHIPPING: "shipping",
  VENUE: "venue",
  GYM: "gym",
  OTHER: "other",
} as const

// But Zod schema defines:
addressType: z.enum(["competition", "venue", "gym", "team"]).nullable()
```

These don't match. `"competition"` and `"team"` don't exist in DB enum; `"billing"`, `"shipping"`, `"other"` aren't in Zod schema. Will cause runtime errors.

### 2. Unsafe `as any` Cast

**File**: `src/server-fns/address-fns.ts:57`

```typescript
addressType: (normalized.addressType as any) ?? "venue",
```

Circumvents type safety. Fix by aligning schemas or using proper union type.

### 3. Duplicate Type Definition: `Address`

**Files**:
- `src/db/schemas/addresses.ts` → `export type Address = InferSelectModel<typeof addressesTable>`
- `src/types/address.ts` → `export interface Address { ... }`

Two different `Address` types exist. Components import from `@/types/address.ts` while server code infers from Drizzle. These can drift. Use Drizzle-inferred type as source of truth.

---

## TypeScript Issues

### 4. Weak Typing in Form Components

**File**: `src/components/forms/address-fields.tsx:15`

```typescript
interface AddressFieldsProps {
  form: UseFormReturn<any>  // Loses all type safety
  prefix?: string
}
```

Defeats autocomplete and refactoring. Use a generic:

```typescript
interface AddressFieldsProps<T extends FieldValues> {
  form: UseFormReturn<T>
  prefix?: keyof T & string
}
```

### 5. Magic String for Schema Type

**File**: `src/server-fns/video-submission-fns.ts:368`

```typescript
const scheme = workout.scheme as WorkoutScheme
```

Repeated casting suggests DB query should be typed properly via Drizzle's inferred types.

### 6. Stringly-Typed Competition Type

**File**: `src/components/competition-location-card.tsx:17`

```typescript
competitionType: "in-person" | "online"
```

This literal type appears in multiple places. Extract to shared constant:

```typescript
export const COMPETITION_TYPES = ["in-person", "online"] as const
export type CompetitionType = (typeof COMPETITION_TYPES)[number]
```

### 7. Inconsistent Null Handling

**File**: `src/schemas/address.ts`

```typescript
// addressSchema uses nullable()
name: z.string().max(200).nullable(),

// addressInputSchema uses optional()
name: z.string().max(200).optional(),
```

Pick one pattern. Preferably `optional()` for inputs, handle null at DB layer.

---

## React Issues

### 8. Excessive State in VenueManager

**File**: `src/components/organizer/schedule/venue-manager.tsx:61-70`

```typescript
const [usePrimaryAddress, setUsePrimaryAddress] = useState(!!primaryAddressId)
const [newAddressName, setNewAddressName] = useState("")
const [newAddressCity, setNewAddressCity] = useState("")
const [newAddressState, setNewAddressState] = useState("")
const [newAddressCountry, setNewAddressCountry] = useState("US")
const [editUsePrimaryAddress, setEditUsePrimaryAddress] = useState(false)
const [editAddressName, setEditAddressName] = useState("")
const [editAddressCity, setEditAddressCity] = useState("")
const [editAddressState, setEditAddressState] = useState("")
const [editAddressCountry, setEditAddressCountry] = useState("US")
```

10 separate useState calls for form state = hard to maintain. Extract to custom hook or use `useReducer`/react-hook-form:

```typescript
const createForm = useForm<VenueFormData>({ defaultValues: {...} })
const editForm = useForm<VenueFormData>()
```

### 9. Missing Memoization for Expensive Derivations

**File**: `src/components/compete/athlete-score-submission.tsx`

Component fetches data in `useEffect`, but `parseScore` called on every render. Memoize validation results.

### 10. Imperative Data Fetching Pattern

**File**: `src/components/compete/athlete-score-submission.tsx:130-175`

```typescript
useEffect(() => {
  const fetchData = async () => {
    setIsLoading(true)
    // ... multiple server calls
  }
  fetchData()
}, [competitionId, trackWorkoutId])
```

This is imperative. In TanStack Start, prefer route loaders for data fetching. If client-side fetching needed, use TanStack Query for caching/deduplication.

### 11. Prop Drilling + Mixed Concerns

**File**: `src/components/organizer/schedule/venue-manager.tsx`

Component handles:
- Form state for create
- Form state for edit
- API calls (create, update, delete)
- Address creation
- UI rendering

Extract server mutations to custom hooks. Separate CreateVenueDialog and EditVenueDialog components.

---

## TanStack Start Issues

### 12. Inconsistent Server Function Patterns

**File**: `src/server-fns/address-fns.ts:41`

```typescript
export const createAddressFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createAddressInputSchema.parse(data))
```

Input validator throws on parse error. Consider `.safeParse()` with proper error handling to return structured errors instead of HTTP 500.

### 13. Direct Server Function Calls in Components

**File**: `src/components/organizer/schedule/venue-manager.tsx:95-127`

```typescript
const newAddress = await createAddressFn({ data: {...} })
```

Direct async calls in event handlers work but miss TanStack's `useServerFn` hook pattern. For mutations acceptable, but be consistent.

### 14. Route Data Not Revalidated After Mutations

**File**: `src/routes/compete/organizer/$competitionId/locations.tsx`

After creating/updating venues, page doesn't revalidate loader data. Use `router.invalidate()` after successful mutations.

### 15. Unused "use client" Directive

**File**: `src/components/add-competitions-to-series-dialog.tsx:1`

```typescript
"use client"
```

TanStack Start doesn't use this directive (it's Next.js). Remove it.

---

## Good Patterns Observed

1. **Strong validation schemas** with Zod in `video-url.ts` - comprehensive regex patterns and clear error messages
2. **Utility functions well-tested** - `formatFullAddress`, `normalizeState` have thorough coverage
3. **Server functions properly separated** in `server-fns/` directory
4. **Proper use of `createServerFn`** with input validators
5. **Database relations properly defined** in `competitions.ts`

---

## Recommended Fixes Priority

| Priority | Issue | Files |
|----------|-------|-------|
| P0 | AddressType enum mismatch | addresses.ts, address.ts |
| P0 | Remove `as any` cast | address-fns.ts:57 |
| P1 | Consolidate Address types | types/address.ts, db/schemas |
| P1 | Type AddressFields form prop | address-fields.tsx |
| P2 | Extract form state to hooks | venue-manager.tsx |
| P2 | Remove "use client" | add-competitions-to-series-dialog.tsx |
| P3 | Add route revalidation | locations.tsx |

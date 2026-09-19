# Calculators

The protected training calculators turn an athlete's target into buildable barbell loads or a percentage table. Inputs use named native controls with keyboard access.

## Unit Boundaries

The displayed target and typed input use the selected unit. URL weights remain pounds for compatibility with existing bookmarks; converting units preserves physical target weight.

The bar option remains `45` or `35` in URLs, selecting the standard or lighter bar: 45/35 lb in pound mode and 20/15 kg in metric mode. Changing units selects that mode's bar and plate inventory. Input conversion supports fractional loads; six decimal places avoid noisy display artifacts without rounding to plates. Changing units also calculates a valid unsubmitted draft rather than losing it. Browser history restores the selected units and target.

The search schema accepts finite nonnegative targets up to 10,000 lb and only the two supported bar options. The bound prevents arbitrary URL values from generating an unbounded number of plate elements. Existing workout-tracking access guards remain in place.

## Attainable Loads

The headline is always the selected bar plus both sides of the displayed plates. A difference message identifies unrepresentable targets and targets below the bare-bar minimum.

[[apps/wodsmith-start/src/lib/barbell-calculator.ts#calculatePlates]] keeps the existing descending greedy plate selection and floating-point tolerance. Pound plates are 45, 35, 25, 15, 10, 5, and 2.5; kilogram plates are 25, 20, 15, 10, 5, 2.5, and 1.25. Available denominations are assumed repeatable; this calculator does not track a gym's physical inventory counts. It never silently labels a requested weight as loaded.

## Warm-up Rounding

Warm-ups retain nearest-increment rounding and saved percentages. Pound requests round to 5 lb and metric requests to the 2.5 kg increment supported by a pair of the smallest metric plates.

[[apps/wodsmith-start/src/lib/barbell-calculator.ts#calculateWarmupLoad]] works directly in the selected unit, removing the old double rounding through pounds. Every warm-up reports its actual loaded weight and explains any bare-bar minimum or shortfall. Warm-up chips explicitly list plates per side.

## Calculator Tests

Pure arithmetic, route interactions, and isolated browser tests protect load semantics, accessibility, and existing entry points without calling application services.

The browser fixture renders the real route components with the real TanStack Router and production styles, supplying only workout-tracking context. Run `pnpm --filter wodsmith-start exec playwright test --config test/preview/calculator/playwright.config.ts`. Unit tests cover the actual route gate separately; this fixture is not an authentication integration test.

### Selected units and bookmarked loads

Typed kilogram targets submit as the corresponding pound URL weight, existing links reopen in display units, and toggling both directions preserves the target including fractional values.

### Attainable totals and bar choices

Exact, inexact, and below-bar requests use the selected bar's true inventory weight and show the difference from the requested load in both unit systems.

### Warm-up loads and preferences

Default and edited warm-ups display buildable totals, retain saved percentages, and identify targets below the bar instead of hiding the minimum load.

### Named native calculator controls

Unit and bar options are native radios inside named fieldsets. Each option has an associated label and remains keyboard focusable.

### Input validation and access boundary

Fractional targets remain valid while nonfinite, negative, excessive targets and unsupported bars are rejected. The existing workout-tracking route guard continues to deny missing access.

### Labelled percentage maximum

The percentage calculator has a persistent associated 1RM label, calculates decimal input on Enter, and clears results for invalid nonpositive input.

### Plate inventory arithmetic

Arithmetic tests independently sum both sides and the bar across exact, inexact, fractional, zero, and below-bar targets using both supported plate inventories.

### Conversion precision and standard bars

Physical targets round trip without plate rounding and tiny floating-point errors cannot drop a plate. Standard and lighter bars use explicit 45/35 lb or 20/15 kg weights.

### Warm-up rounding arithmetic

Pure warm-up tests pin pound and metric rounding and verify that the bare-bar minimum has an explicit difference from the rounded percentage target.

### Browser keyboard and mobile flow

Real browser tests use Tab, arrow keys, Space, and Enter to select units and bars, calculate loads, restore history, and verify the mobile page does not overflow or produce runtime errors.

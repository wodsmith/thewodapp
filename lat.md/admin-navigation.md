---
lat:
  require-code-mention: true
---

# Admin Navigation

The Start admin shell delegates active-link matching to TanStack Router so direct SSR loads and client hydration produce identical navigation markup.

The dashboard link matches only `/admin`, while each remaining platform link stays active for its nested routes. Router-owned inactive props keep hover styling off active links. Navigation destinations, authorization, and layout remain route-owned.

## Admin Navigation Hydration Tests

These tests reproduce direct server-rendered loads and verify hydration keeps the router-selected platform link stable without React console errors.

### Dashboard Direct Load Hydrates Stably

This test verifies `/admin` hydrates without an attribute mismatch and marks only the dashboard link active.

### Teams Direct Load Hydrates Stably

This test verifies `/admin/teams` hydrates without an attribute mismatch and marks the teams link active.

### Nested Team Route Preserves Parent Active State

This test verifies a nested team route hydrates without an attribute mismatch while retaining the teams parent link's active styling and semantics.

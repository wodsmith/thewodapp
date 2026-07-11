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

## Admin Dashboard Heading Tests

These tests keep the direct `/admin` page title and section hierarchy available to heading navigation without changing the dashboard actions or layout.

### Direct Dashboard Exposes One Page Heading

This test verifies the visible Admin Dashboard title is the direct page's only level-one heading.

### Dashboard Sections Follow the Page Heading

This test verifies Quick Actions and Recent Activity are level-two headings beneath the dashboard title.

## Demo Competitions Semantic Tests

These tests keep the demo generator's content structure navigable without changing its creation or deletion behavior.

### Page and Card Sections Form a Coherent Heading Outline

This test verifies the page title, card sections, and creation summary use consecutive heading levels.

### Creation Summary Uses Valid Nested Lists

This test verifies workout details are nested within their parent list item so assistive technology receives valid list semantics.

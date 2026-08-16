---
name: WODsmith Compete Benchmark Prototypes
description: Shared visual system for three alternative benchmark-density workout-section prototypes.
colors:
  primary-action: "#f97316"
  primary-action-hover: "#fb8b3d"
  primary-soft: "#3c2012"
  focus: "#fdba74"
  accent-ink: "#1a0d05"
  background: "#0b0a09"
  shell-background: "#0d0c0b"
  surface: "#11100f"
  surface-raised: "#171513"
  surface-soft: "#1d1a17"
  line: "#302b27"
  line-strong: "#484039"
  text: "#f7f4ef"
  text-muted: "#aaa29a"
  text-subtle: "#918981"
  status-published: "#34d399"
  domain-ember: "#f97316"
  domain-ember-soft: "#3d2113"
  domain-sky: "#60a5fa"
  domain-sky-soft: "#172b42"
  domain-lime: "#a3e635"
  domain-lime-soft: "#263315"
  domain-violet: "#c084fc"
  domain-violet-soft: "#31203f"
  domain-sand: "#fbbf24"
  domain-sand-soft: "#392d14"
  domain-cyan: "#22d3ee"
  domain-cyan-soft: "#12323a"
  domain-rose: "#fb7185"
  domain-rose-soft: "#3f1e25"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(36px, 5vw, 54px)"
    fontWeight: 700
    lineHeight: 0.96
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1
  body:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: "0.08em"
rounded:
  indicator: "3px"
  compact: "7px"
  item: "8px"
  control: "9px"
  field: "10px"
  card: "12px"
  panel: "14px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "7": "28px"
components:
  button-primary:
    backgroundColor: "{colors.primary-action}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 15px"
    height: "42px"
  button-primary-hover:
    backgroundColor: "{colors.primary-action-hover}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 15px"
    height: "42px"
  button-secondary:
    backgroundColor: "{colors.text}"
    textColor: "{colors.surface-raised}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 15px"
    height: "38px"
  tab-active:
    backgroundColor: "{colors.primary-action}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.item}"
    padding: "0 16px"
    height: "38px"
  search-field:
    backgroundColor: "{colors.shell-background}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "0 36px 0 40px"
    height: "42px"
    width: "100%"
  content-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
  domain-chip:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 11px"
    height: "34px"
---

# Design System: WODsmith Compete Benchmark Directory

## Overview

**Creative North Star: "The Compact Competition Index"**

The shared system is a dark, compact extension of the incumbent WODsmith Compete shell. Warm neutral surfaces, precise ruled divisions, condensed athletic headings, and sparing orange action states make a large workout library feel operational rather than promotional. Density comes from alignment and hierarchy, never from removing recognition data or interaction clarity.

This system governs the production benchmark workout directory and its comparison artifacts in `docs/mockups/benchmark-density/`. The selected Domain Rail applies only to benchmark competitions; Benchmark Matrix and Domain Board remain non-production references.

**Key Characteristics:**
- Dark warm-neutral Compete shell with restrained one-pixel rules.
- Orange reserved for primary actions, active navigation, and decisive state.
- Condensed display hierarchy paired with compact, readable sans-serif data text.
- Dense scanning through aligned rows, tables, or grouped zones rather than repeated cards.
- Shared responsive shell with variant-specific workout-section adaptations.
- Semantic structure, visible focus, and reduced-motion-safe interactions.

## Colors

The palette is warm and dark at rest, high-contrast for reading, and selective with chroma.

### Primary
- **Competition Orange** (`primary-action`): registration, the active route tab, brand mark, and the strongest selected state.
- **Competition Orange Hover** (`primary-action-hover`): the primary-action hover surface only.
- **Ember Wash** (`primary-soft`): low-emphasis orange context without competing with the action color.
- **Focus Amber** (`focus`): the universal keyboard-focus outline.
- **Accent Ink** (`accent-ink`): dark foreground on orange controls.

### Secondary
- **Domain Spectrum** (`domain-ember`, `domain-sky`, `domain-lime`, `domain-violet`, `domain-sand`, `domain-cyan`, `domain-rose`): categorical markers that distinguish training domains across all three alternatives.
- **Domain Washes** (the corresponding `*-soft` tokens): hover, selected, and zone-heading surfaces tied to each domain color. These are category cues, not competing primary actions.
- **Published Green** (`status-published`): the compact published-status indicator.

### Neutral
- **Competition Background** (`background`): page canvas.
- **Shell Background** (`shell-background`): header and inset field canvas.
- **Base Surface** (`surface`): content panels and data rows.
- **Raised Surface** (`surface-raised`): table headers and slightly lifted regions.
- **Soft Surface** (`surface-soft`): quiet hover and secondary-control states.
- **Rule** (`line`): routine separators and borders.
- **Strong Rule** (`line-strong`): group boundaries, fields, and structural emphasis.
- **Primary Text** (`text`): headings and high-priority content.
- **Muted Text** (`text-muted`): supporting copy and secondary metadata.
- **Subtle Text** (`text-subtle`): low-priority counts, icons, and tertiary metadata.

**The Orange Means Action Rule.** Keep orange scarce and decisive. Domain colors classify content; they do not replace the primary action hierarchy.

## Typography

**Display Font:** Barlow Condensed (with Arial Narrow and sans-serif fallbacks)  
**Body Font:** Public Sans (with UI sans-serif, system UI, and sans-serif fallbacks)

**Character:** Barlow Condensed supplies compact athletic authority without consuming width. Public Sans keeps controls, metadata, and dense workout data legible.

### Hierarchy
- **Display** (700, `clamp(36px, 5vw, 54px)`, 0.96): competition title only.
- **Headline** (700, 34px, 1): workout-section headings; 30px on the narrow shell.
- **Title** (700, 22px, 1): domain and group headings, with nearby counts allowed to use the same condensed family.
- **Body** (400, 14px, 1.45): shell copy and default content; supporting workout-section copy remains constrained to 62 characters where implemented.
- **Label** (700, 12px, 0.08em): compact navigation and uppercase shell labels. Data labels may reduce tracking where rapid scanning matters.

Tabular result values use tabular numerals where alignment is meaningful. Dense metadata ranges from 9px to 13px only when backed by hierarchy, contrast, and an adequately sized interactive row.

**The Condensed Means Structure Rule.** Use the condensed face for competition, section, domain, and count hierarchy; keep descriptive copy and data in Public Sans.

## Layout

The shared desktop shell is centered at a maximum width of 1280px with 20px outer gutters, a flexible content panel, a 300px sidebar, and a 24px gap. Matrix and Board explorations narrow the sidebar to 276px. The shell follows the documented 4px rhythm through the `spacing` scale; 12px, 16px, 20px, and 24px are the dominant component intervals.

At 900px the page becomes one column and registration context moves above the workout panel. At 640px the shell uses 12px outer gutters, the content panel becomes edge-to-edge, tabs scroll horizontally, secondary sidebar content is hidden, and tab/search targets reach at least 44px. Each workout alternative changes its internal structure at 720px: the Rail becomes a horizontal sticky domain strip, the Matrix becomes stacked mobile rows, and the Board becomes a single-column set of zones. The minimum page width is 320px.

Dense display preserves recognition data and stable context: keep names, domain cues, result format, and a clear detail-route action visible; disclose secondary descriptions through grouping, responsive reflow, or expansion. Every alternative represents all 58 workouts and exposes search, a live result count, a guided empty state, and direct workout links.

## Elevation & Depth

The system is flat and line-led. Depth comes primarily from nested warm neutral surfaces, stronger structural rules, and sticky regions with near-opaque surface backgrounds. Two restrained shadows are observed: a published-status glow (`0 2px 8px rgb(52 211 153 / 0.35)`) and Domain Board zone lift (`0 10px 28px rgb(0 0 0 / 0.14)`). Do not generalize either into card-grid decoration.

### Shadow Vocabulary
- **Published Status Glow** (`0 2px 8px rgb(52 211 153 / 0.35)`): the seven-pixel published indicator only.
- **Domain Zone Lift** (`0 10px 28px rgb(0 0 0 / 0.14)`): Domain Board exploration zones only.

**The Flat-by-Default Rule.** Use tonal layering and one-pixel rules before shadow; reserve observed shadows for status emphasis or the Board alternative's grouped zones.

## Shapes

Panels use gently rounded 14px corners; grouped cards and zones use 12px; fields use 10px; ordinary controls use 8px or 9px; compact indicators use 3px or 7px. Domain filter chips alone use the 999px pill silhouette. Borders are one pixel, warm-neutral, and usually visible against the adjacent surface. On the narrow shell, the main content panel drops side borders and corner rounding to meet the viewport cleanly.

## Components

Common primitives feel compact, direct, and instrument-like. Their shared states use surface shifts or stronger rules, never decorative glow. Every keyboard-operable element receives the same 2px `focus` outline with a 3px offset.

### Buttons
- **Shape:** compact controls use the 9px control radius; primary registration is full-width in the sidebar and at least 42px high.
- **Primary:** Competition Orange with Accent Ink, bold label text, and 15px horizontal padding.
- **Hover / Focus:** hover moves to Competition Orange Hover; keyboard focus uses the shared focus outline.
- **Secondary:** light text surface with dark ink for shell sign-up; quiet utility actions use Soft Surface.

### Chips
- **Style:** domain filters are monochrome 34px-high pills with a one-pixel rule, compact label, and count.
- **State:** hover and pressed states use Raised or Soft Surface with a Strong Rule. Mobile filters reach 40px high and remain horizontally scrollable.

### Cards / Containers
- **Corner Style:** 14px content panels and sidebar cards; 12px alternative-specific grouped zones.
- **Background:** Base Surface over Competition Background, with Raised or Soft Surface for hierarchy and state.
- **Shadow Strategy:** flat by default; see Elevation & Depth.
- **Border:** one-pixel Rule; Strong Rule at fields and group boundaries.
- **Internal Padding:** primarily 16px, 20px, or 24px from the shared scale.

### Inputs / Fields
- **Style:** inset Shell Background, Strong Rule, 10px radius, 42px height, leading search icon, and an accessible clear control when populated.
- **Focus:** universal focus outline; matrix select groups also strengthen the border on `focus-within`.
- **Responsive:** search expands to full width and 46px high on the narrow shell.

### Navigation
- Competition tabs sit in a bordered 12px container. The active route uses orange and dark ink; inactive routes use muted text. Tabs scroll horizontally and reach 44px high on mobile.
- Breadcrumbs, route tabs, domain navigation, search labels, result counts, and workout links retain semantic labels. Dynamic counts use polite live regions; decorative SVGs are hidden from assistive technology.

### Benchmark Workout Directory

- **Selected Domain Rail:** benchmark competitions use a sticky 190px monochrome domain rail beside grouped compact rows. The rail collapses to 56px desktop codes, persists that preference locally, and becomes a non-collapsible horizontal strip at 720px.
- **Rows:** every top-level workout retains its track order, domain, movement summary, result format, and direct detail link. Authenticated athletes see `My score` only where a division-scoped score exists; scoreless rows show no score label.
- **Search:** workout name, result format, tags, and movements filter together. Visible workout and domain counts update in a polite live region; zero results provide an explicit clear action.
- **Alternatives:** Benchmark Matrix and Domain Board remain comparison prototypes only. They are not production patterns.

Motion is limited to the 180ms interaction-transform token for rail and chevron transforms, with reduced-motion fallbacks. Smooth domain scrolling becomes instant under `prefers-reduced-motion: reduce`.

## Do's and Don'ts

### Do:
- **Do** preserve the shared Compete header, competition hero, route tabs, and registration context around the benchmark directory.
- **Do** apply the Domain Rail only when `competitionType` is `benchmark`; other competition types retain workout cards.
- **Do** keep every workout navigable with domain cues, result context, and direct detail links.
- **Do** keep viewer scores private, division-scoped, and loaded in one batch.
- **Do** preserve semantic headings and lists, labeled controls, polite live counts, visible focus, 44px mobile targets, and reduced-motion behavior.
- **Do** use alignment, rules, and progressive disclosure to create density.

### Don't:
- **Don't** promote the Domain Rail into a global competition workout pattern.
- **Don't** fetch scores per row or display another athlete's score.
- **Don't** replace the benchmark index with an undifferentiated stack of oversized cards.
- **Don't** use domain colors, decorative dots, or colored rail markers.
- **Don't** hide workouts to shorten the page; filtering and grouping must preserve the full library.

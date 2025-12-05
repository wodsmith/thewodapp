/**
 * WODsmith Compete Design System Tokens
 *
 * Three-level hierarchy:
 * 1. Primitive tokens - Raw color, spacing, and typography values
 * 2. Semantic tokens - Purpose-based mappings (e.g., color-action-primary)
 * 3. Component tokens - Specific component usage (e.g., button-primary-background)
 *
 * @see https://gist.github.com/theianjones/ce06e2e4c1e31d18e48146320780989a
 */

// =============================================================================
// PRIMITIVE TOKENS - Raw values
// =============================================================================

/**
 * Orange Scale - Primary brand color
 * Main brand color for actions, CTAs, and highlights
 */
export const orangeScale = {
  50: "#fff3ed",
  100: "#ffe4d1",
  200: "#ffc9a3",
  300: "#ffa875",
  400: "#ff8c42",
  500: "#ff6b35", // Primary brand color
  600: "#e55a2a",
  700: "#cc4b1f",
  800: "#a33c19",
  900: "#7a2d13",
} as const

/**
 * Neutral Scale - Grays for text, backgrounds, and borders
 */
export const neutralScale = {
  0: "#ffffff",
  50: "#fafafa",
  100: "#f5f5f5",
  200: "#e5e5e5",
  300: "#d4d4d4",
  400: "#a3a3a3",
  500: "#737373",
  600: "#525252",
  700: "#404040",
  800: "#262626",
  900: "#1a1a1a",
  950: "#0a0a0a",
} as const

/**
 * Dark Mode Surface Colors
 * Specific colors for dark mode surfaces following GitHub-style dark theme
 */
export const darkSurfaces = {
  page: "#0a0e14",
  surface: "#161b22",
  surfaceHover: "#1c2128",
  surfaceRecessed: "#0d1117",
  borderDefault: "#30363d",
  borderSubtle: "#21262d",
} as const

/**
 * Semantic Colors - Status and feedback
 */
export const semanticColors = {
  success: {
    50: "#ecfdf5",
    400: "#34d399",
    500: "#10b981",
    600: "#059669",
  },
  error: {
    50: "#fef2f2",
    400: "#f87171",
    500: "#ef4444",
    600: "#dc2626",
  },
  warning: {
    50: "#fffbeb",
    400: "#fbbf24",
    500: "#f59e0b",
    600: "#d97706",
  },
  info: {
    50: "#eff6ff",
    400: "#60a5fa",
    500: "#3b82f6",
    600: "#2563eb",
  },
} as const

/**
 * Typography - Font families
 */
export const fontFamilies = {
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  mono: '"SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
} as const

/**
 * Typography - Font sizes (in pixels)
 */
export const fontSizes = {
  xs: 12,
  sm: 14,
  base: 16, // Minimum body text
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
} as const

/**
 * Typography - Font weights
 */
export const fontWeights = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const

/**
 * Typography - Line heights
 */
export const lineHeights = {
  tight: 1.1,
  snug: 1.3,
  normal: 1.5,
  relaxed: 1.6,
} as const

/**
 * Spacing Scale - Based on 4px unit
 */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const

/**
 * Border radius values
 */
export const borderRadius = {
  none: 0,
  sm: 2,
  DEFAULT: 4,
  md: 6,
  lg: 8,
  xl: 12,
  "2xl": 16,
  full: 9999,
} as const

// =============================================================================
// SEMANTIC TOKENS - Purpose-based mappings
// =============================================================================

export const semanticTokens = {
  // Action colors
  action: {
    primary: orangeScale[500],
    primaryHover: orangeScale[600],
    primaryActive: orangeScale[700],
    secondary: neutralScale[200],
    secondaryHover: neutralScale[300],
  },

  // Text colors
  text: {
    primary: neutralScale[900],
    secondary: neutralScale[600],
    tertiary: neutralScale[500],
    inverse: neutralScale[0],
    link: orangeScale[500],
    linkHover: orangeScale[600],
  },

  // Background colors
  background: {
    page: neutralScale[0],
    surface: neutralScale[0],
    surfaceHover: neutralScale[50],
    muted: neutralScale[100],
    subtle: neutralScale[50],
  },

  // Border colors
  border: {
    default: neutralScale[200],
    subtle: neutralScale[100],
    strong: neutralScale[300],
    focus: orangeScale[500],
  },

  // Status colors
  status: {
    success: semanticColors.success[500],
    successLight: semanticColors.success[50],
    error: semanticColors.error[500],
    errorLight: semanticColors.error[50],
    warning: semanticColors.warning[500],
    warningLight: semanticColors.warning[50],
    info: semanticColors.info[500],
    infoLight: semanticColors.info[50],
  },
} as const

export const semanticTokensDark = {
  // Action colors (same in dark mode)
  action: {
    primary: orangeScale[500],
    primaryHover: orangeScale[400],
    primaryActive: orangeScale[600],
    secondary: darkSurfaces.surface,
    secondaryHover: darkSurfaces.surfaceHover,
  },

  // Text colors
  text: {
    primary: neutralScale[50],
    secondary: neutralScale[400],
    tertiary: neutralScale[500],
    inverse: neutralScale[900],
    link: orangeScale[400],
    linkHover: orangeScale[300],
  },

  // Background colors
  background: {
    page: darkSurfaces.page,
    surface: darkSurfaces.surface,
    surfaceHover: darkSurfaces.surfaceHover,
    muted: darkSurfaces.surfaceRecessed,
    subtle: darkSurfaces.borderSubtle,
  },

  // Border colors
  border: {
    default: darkSurfaces.borderDefault,
    subtle: darkSurfaces.borderSubtle,
    strong: neutralScale[600],
    focus: orangeScale[500],
  },

  // Status colors
  status: {
    success: semanticColors.success[400],
    successLight: "rgba(16, 185, 129, 0.1)",
    error: semanticColors.error[400],
    errorLight: "rgba(239, 68, 68, 0.1)",
    warning: semanticColors.warning[400],
    warningLight: "rgba(245, 158, 11, 0.1)",
    info: semanticColors.info[400],
    infoLight: "rgba(59, 130, 246, 0.1)",
  },
} as const

// =============================================================================
// COMPONENT TOKENS - Specific component usage
// =============================================================================

export const componentTokens = {
  // Button
  button: {
    primary: {
      background: orangeScale[500],
      backgroundHover: orangeScale[600],
      text: neutralScale[0],
      border: "transparent",
    },
    secondary: {
      background: neutralScale[0],
      backgroundHover: neutralScale[50],
      text: neutralScale[900],
      border: neutralScale[300],
    },
    ghost: {
      background: "transparent",
      backgroundHover: neutralScale[100],
      text: neutralScale[600],
      border: "transparent",
    },
    destructive: {
      background: semanticColors.error[500],
      backgroundHover: semanticColors.error[600],
      text: neutralScale[0],
      border: "transparent",
    },
    minHeight: 44, // Accessibility minimum
    paddingX: spacing[5], // 20px
    paddingY: spacing[2], // 8px
  },

  // Input
  input: {
    background: neutralScale[0],
    border: neutralScale[300],
    borderFocus: orangeScale[500],
    text: neutralScale[900],
    placeholder: neutralScale[500],
    paddingX: spacing[3], // 12px
    paddingY: 10, // 10px
  },

  // Card
  card: {
    background: neutralScale[0],
    border: neutralScale[200],
    borderHover: orangeScale[500],
    padding: spacing[5], // 20px
    gap: spacing[4], // 16px
  },

  // Badge
  badge: {
    paddingX: spacing[2], // 8px
    paddingY: 2,
    borderRadius: borderRadius.DEFAULT, // 4px
    fontSize: fontSizes.xs, // 12px
    fontWeight: fontWeights.medium, // 500
  },

  // Table
  table: {
    cellPaddingX: spacing[5], // 20px
    cellPaddingY: spacing[4], // 16px
    headerBackground: neutralScale[50],
    rowHover: neutralScale[50],
  },
} as const

// =============================================================================
// LAYOUT TOKENS
// =============================================================================

export const layout = {
  container: {
    maxWidth: 1280, // max-w-7xl
    paddingX: spacing[6], // 24px
    paddingY: spacing[12], // 48px
  },

  breakpoints: {
    mobile: 375, // Minimum mobile width
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    "2xl": 1536,
  },
} as const

// =============================================================================
// ACCESSIBILITY
// =============================================================================

export const accessibility = {
  minTouchTarget: 44, // 44x44px minimum
  contrastRatios: {
    normalText: 4.5, // WCAG AA
    largeText: 3, // 18px+ or 14px bold
    uiComponents: 3,
  },
  focusRingWidth: 2,
  focusRingOffset: 2,
} as const

// =============================================================================
// TRANSITIONS
// =============================================================================

export const transitions = {
  fast: "150ms",
  default: "200ms",
  slow: "300ms",
  easing: {
    default: "ease-in-out",
    enter: "ease-out",
    exit: "ease-in",
  },
} as const

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type OrangeScale = typeof orangeScale
export type NeutralScale = typeof neutralScale
export type SemanticColors = typeof semanticColors
export type Spacing = typeof spacing
export type FontSizes = typeof fontSizes
export type FontWeights = typeof fontWeights
export type LineHeights = typeof lineHeights

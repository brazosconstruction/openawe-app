/**
 * OpenAwe Design System
 * Perplexity-inspired: dark, monochromatic, cinematic, ethereal
 */

export const darkColors = {
  // Core surfaces
  background: '#0A0A0A',
  surface: '#111111',
  surfaceElevated: '#1A1A1A',
  surfaceHover: '#222222',

  // Text hierarchy
  textPrimary: '#F5F5F5',
  textSecondary: '#A0A0A0',
  textTertiary: '#666666',
  textMuted: '#444444',

  // Accent — used extremely sparingly (send button, active indicators)
  accent: '#FFFFFF',
  accentDim: 'rgba(255, 255, 255, 0.12)',
  accentSubtle: 'rgba(255, 255, 255, 0.06)',

  // Status
  connected: '#4ADE80',
  connecting: '#FBBF24',
  disconnected: '#F87171',
  error: '#EF4444',

  // Borders & dividers
  border: 'rgba(255, 255, 255, 0.08)',
  borderSubtle: 'rgba(255, 255, 255, 0.04)',
  borderFocus: 'rgba(255, 255, 255, 0.20)',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.6)',
  shimmer: 'rgba(255, 255, 255, 0.03)',

  // Transparent variants
  white05: 'rgba(255, 255, 255, 0.05)',
  white10: 'rgba(255, 255, 255, 0.10)',
  white15: 'rgba(255, 255, 255, 0.15)',
  white20: 'rgba(255, 255, 255, 0.20)',
  white40: 'rgba(255, 255, 255, 0.40)',
  white60: 'rgba(255, 255, 255, 0.60)',
} as const;

export const lightColors = {
  // Core surfaces
  background: '#F7F7F7',
  surface: '#EEEEEE',
  surfaceElevated: '#E4E4E4',
  surfaceHover: '#D8D8D8',

  // Text hierarchy
  textPrimary: '#111111',
  textSecondary: '#555555',
  textTertiary: '#888888',
  textMuted: '#BBBBBB',

  // Accent
  accent: '#000000',
  accentDim: 'rgba(0, 0, 0, 0.10)',
  accentSubtle: 'rgba(0, 0, 0, 0.05)',

  // Status
  connected: '#16A34A',
  connecting: '#D97706',
  disconnected: '#DC2626',
  error: '#DC2626',

  // Borders & dividers
  border: 'rgba(0, 0, 0, 0.08)',
  borderSubtle: 'rgba(0, 0, 0, 0.04)',
  borderFocus: 'rgba(0, 0, 0, 0.20)',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.4)',
  shimmer: 'rgba(0, 0, 0, 0.02)',

  // Transparent variants (dark on light)
  white05: 'rgba(0, 0, 0, 0.05)',
  white10: 'rgba(0, 0, 0, 0.10)',
  white15: 'rgba(0, 0, 0, 0.15)',
  white20: 'rgba(0, 0, 0, 0.20)',
  white40: 'rgba(0, 0, 0, 0.40)',
  white60: 'rgba(0, 0, 0, 0.60)',
} as const;

export type ThemeColors = typeof darkColors;

const makeTypography = (colors: ThemeColors) => ({
  // Display — app name on pairing screen
  display: {
    fontSize: 36,
    fontWeight: '200' as const,
    letterSpacing: 4,
    color: colors.textPrimary,
  },
  // Title — screen headers
  title: {
    fontSize: 20,
    fontWeight: '300' as const,
    letterSpacing: 1.5,
    color: colors.textPrimary,
  },
  // Subtitle
  subtitle: {
    fontSize: 16,
    fontWeight: '300' as const,
    letterSpacing: 0.3,
    color: colors.textSecondary,
  },
  // Body — message text
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  // Body light — AI responses
  bodyLight: {
    fontSize: 16,
    fontWeight: '300' as const,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  // Caption — timestamps, metadata
  caption: {
    fontSize: 12,
    fontWeight: '300' as const,
    letterSpacing: 0.2,
    color: colors.textTertiary,
  },
  // Label — settings labels
  label: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: colors.textPrimary,
  },
  // Small — fine print
  small: {
    fontSize: 13,
    fontWeight: '300' as const,
    color: colors.textSecondary,
  },
  // Mono — codes, relay IDs
  mono: {
    fontSize: 14,
    fontWeight: '400' as const,
    fontFamily: 'monospace' as const,
    color: colors.textTertiary,
  },
});

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  round: 999,
} as const;

export const animation = {
  // Timing
  fast: 150,
  normal: 250,
  slow: 400,
  glacial: 800,
} as const;

export const layout = {
  screenPadding: spacing.lg,
  messagePadding: spacing.md,
  inputHeight: 44,
  headerHeight: 56,
  maxMessageWidth: 0.80, // 80% of screen width
} as const;

const makeTheme = (colors: ThemeColors) => ({
  colors,
  typography: makeTypography(colors),
  spacing,
  radius,
  animation,
  layout,
});

export const darkTheme = makeTheme(darkColors);
export const lightTheme = makeTheme(lightColors);

export type Theme = typeof darkTheme;

// Default export — kept for backward compat; ThemeContext is the live source
const theme = darkTheme;
export default theme;

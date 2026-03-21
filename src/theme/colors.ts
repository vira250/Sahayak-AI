/**
 * App color palette - Clean White + Navy Blue theme
 * Professional, minimal, and accessible design
 */
export const AppColors = {
  // Primary backgrounds - White and light surfaces
  primaryDark: '#FFFFFF',
  primaryMid: '#F8FAFC',
  surfaceCard: '#F0F4F8',
  surfaceElevated: '#E2E8F0',

  // Accent colors - Navy blue palette
  accentCyan: '#1B3A5C',
  accentViolet: '#2B5F8E',
  accentPink: '#EC4899',
  accentGreen: '#10B981',
  accentOrange: '#F59E0B',

  // Text colors - Dark text on light backgrounds
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',

  // Status colors
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Navy blue specific
  navyDark: '#0F2544',
  navyMid: '#1B3A5C',
  navyLight: '#2B5F8E',
  navyPale: '#E8EEF4',
} as const;

export type AppColorsType = typeof AppColors;

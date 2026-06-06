/**
 * PrintBuddy light theme tokens (matches the web app).
 */
export const Colors = {
  background: '#E8F4FA',
  card: '#FFFFFF',
  accent: '#4DB8E8',
  accentDark: '#3AA0D0',
  textPrimary: '#1A2B3C',
  textSecondary: '#5A6B7C',
  textMuted: '#8A99A8',
  hero: '#3D4754',
  heroText: '#FFFFFF',

  // Status
  online: '#27AE60',
  warning: '#F2994A',
  offline: '#9CA3AF',
  error: '#EB5757',

  border: '#D6E6F0',
  pillBg: '#F0F7FB',
  white: '#FFFFFF',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  card: 20,
  pill: 9999,
};

export const Shadow = {
  card: {
    shadowColor: '#1A2B3C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
};

export const Typography = {
  h1: { fontSize: 28, fontWeight: '800' as const, color: Colors.textPrimary },
  h2: { fontSize: 22, fontWeight: '700' as const, color: Colors.textPrimary },
  h3: { fontSize: 18, fontWeight: '700' as const, color: Colors.textPrimary },
  body: { fontSize: 15, fontWeight: '400' as const, color: Colors.textPrimary },
  bodySecondary: { fontSize: 14, fontWeight: '400' as const, color: Colors.textSecondary },
  label: { fontSize: 13, fontWeight: '600' as const, color: Colors.textSecondary },
  caption: { fontSize: 12, fontWeight: '400' as const, color: Colors.textMuted },
};

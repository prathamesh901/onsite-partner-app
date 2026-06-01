export const Colors = {
  // Core palette from Stitch design
  primary: '#006688',
  primaryContainer: '#4db8e8',
  primaryFixed: '#c1e8ff',
  primaryFixedDim: '#75d1ff',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#00465f',
  onPrimaryFixed: '#001e2b',

  secondary: '#555f6d',
  secondaryContainer: '#d9e3f4',
  onSecondary: '#ffffff',
  onSecondaryContainer: '#5b6573',

  tertiary: '#885200',
  tertiaryContainer: '#ea9c3e',
  tertiaryFixed: '#ffdcbc',
  tertiaryFixedDim: '#ffb86a',
  onTertiary: '#ffffff',
  onTertiaryContainer: '#5f3700',

  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onError: '#ffffff',
  onErrorContainer: '#93000a',

  background: '#f6fafe',
  onBackground: '#171c1f',

  surface: '#f6fafe',
  surfaceBright: '#f6fafe',
  surfaceContainer: '#eaeef2',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f0f4f8',
  surfaceContainerHigh: '#e5e9ed',
  surfaceContainerHighest: '#dfe3e7',
  surfaceDim: '#d6dade',
  onSurface: '#171c1f',
  onSurfaceVariant: '#3e484e',

  outline: '#6e787f',
  outlineVariant: '#bec8cf',

  inverseSurface: '#2c3134',
  inverseOnSurface: '#edf1f5',
  inversePrimary: '#75d1ff',
  surfaceTint: '#006688',

  // Status
  online: '#27AE60',
  alert: '#F2994A',
  offline: '#9CA3AF',

  // Ink
  ink: {
    black: '#171c1f',
    cyan: '#00BFBF',
    magenta: '#E84D8A',
    yellow: '#F2C94C',
  },

  // Zone colors
  zoneGood: '#166534',
  zoneGoodBg: '#F0FDF4',
  zoneLow: '#991B1B',
  zoneLowBg: '#FEF2F2',
  zoneWarning: '#F2994A',
  zoneWarningBg: '#FFF7ED',
};

export const Spacing = {
  xs: 4,
  base: 8,
  sm: 12,
  md: 24,
  gutter: 24,
  marginMobile: 16,
  lg: 40,
  xl: 64,
};

export const Radius = {
  sm: 4,
  lg: 8,
  xl: 12,
  card: 20,
  pill: 9999,
};

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
};

export const Typography = {
  displayLg: { fontSize: 40, fontWeight: '700' as const, lineHeight: 48, letterSpacing: -0.8 },
  headlineLg: { fontSize: 32, fontWeight: '700' as const, lineHeight: 40, letterSpacing: -0.32 },
  headlineMd: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
  headlineSm: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
  bodyLg: { fontSize: 18, fontWeight: '400' as const, lineHeight: 28 },
  bodyMd: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodySm: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  labelMd: { fontSize: 14, fontWeight: '600' as const, lineHeight: 16 },
  labelSm: { fontSize: 12, fontWeight: '600' as const, lineHeight: 16 },
};

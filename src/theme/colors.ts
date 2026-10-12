// ─── FH Design System – Color Tokens ──────────────────────────────────────────
// A single source-of-truth for the entire app palette.
// Dark-mode first with an indigo/violet accent.

export const Colors = {
  // Backgrounds
  bg: '#0F1117',          // deepest background
  bgCard: '#181C27',      // card surfaces
  bgElevated: '#1E2333',  // elevated / modal surfaces
  bgInput: '#232940',     // text input fill

  // Primary accent – vivid indigo-violet
  primary: '#6366F1',
  primaryLight: '#818CF8',
  primaryDark: '#4F46E5',
  primaryMuted: '#312E81',

  // Secondary accent – emerald for success states
  success: '#10B981',
  successLight: '#A7F3D0',
  successBg: '#064E3B',

  // Warning
  warning: '#F59E0B',
  warningLight: '#FDE68A',
  warningBg: '#78350F',

  // Danger / error
  danger: '#EF4444',
  dangerLight: '#FCA5A5',
  dangerBg: '#7F1D1D',

  // Text
  textPrimary: '#F1F5F9',   // headings
  textSecondary: '#94A3B8', // body / sublabels
  textMuted: '#64748B',     // placeholders / hints
  textInverse: '#0F172A',   // text on light surfaces

  // Borders
  border: '#2D3748',
  borderLight: '#3D4A63',

  // Misc
  overlay: 'rgba(0,0,0,0.65)',
  white: '#FFFFFF',
  transparent: 'transparent',
};

export default Colors;

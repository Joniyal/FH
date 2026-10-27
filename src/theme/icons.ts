// ─── FH Design System – Icon Reference ──────────────────────────────────────
// All icons come from @expo/vector-icons (MaterialCommunityIcons + Ionicons).
// This file documents the icon names used across the app for consistency.
//
// Usage example:
//   import { MaterialCommunityIcons } from '@expo/vector-icons';
//   <MaterialCommunityIcons name="camera" size={22} color={Colors.textPrimary} />
//
// We keep icon size constants here so all screens share the same sizing.

export const IconSize = {
  /** Tiny inline icons in badges, pills */
  xs: 14,
  /** Small icons inside cards, list items */
  sm: 18,
  /** Default icon size for buttons, nav, fields */
  md: 22,
  /** Large icons for feature cards, modals */
  lg: 26,
  /** Hero icons for onboarding, empty states */
  xl: 34,
  /** Giant icons for hero/splash */
  xxl: 48,
};

// ─── Icon name map (MaterialCommunityIcons) ─────────────────────────────────
// Provides a single source of truth for icon names used across the app.
export const IconNames = {
  // Navigation
  home: 'home',
  camera: 'camera',
  vault: 'shield-lock',
  history: 'clipboard-text-clock',

  // Actions
  scan: 'line-scan',
  upload: 'file-upload',
  pdf: 'file-document',
  templates: 'lightning-bolt',
  quickFill: 'lightning-bolt',
  gallery: 'image',

  // Vault fields
  person: 'account',
  address: 'map-marker',
  phone: 'phone',
  calendar: 'calendar',

  // Form operations
  checkCircle: 'check-circle',
  check: 'check',
  close: 'close',
  edit: 'pencil',
  copy: 'content-copy',
  share: 'share-variant',
  save: 'content-save',
  reload: 'refresh',
  delete: 'delete-outline',
  arrowRight: 'chevron-right',

  // Voice
  mic: 'microphone',
  micOff: 'microphone-off',
  speaker: 'volume-high',
  speakerOff: 'volume-off',

  // Status
  lock: 'lock',
  shield: 'shield-check',
  info: 'information',
  warning: 'alert',
  error: 'alert-circle',
  success: 'check-circle',

  // Document
  document: 'file-document-outline',
  documentScan: 'text-recognition',
  filter: 'tune-variant',
  magic: 'auto-fix',
  sharpen: 'image-filter-hdr',
  bw: 'invert-colors',

  // Misc
  help: 'help-circle-outline',
  settings: 'cog',
  eye: 'eye',
  eyeOff: 'eye-off',
  star: 'star',

  // Templates
  education: 'school',
  government: 'passport',
  employment: 'briefcase',
  transport: 'car',
  banking: 'bank',
} as const;

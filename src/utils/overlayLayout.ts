import { PersonalFieldKey } from '../types/app';

export type OverlayPosition = {
  xRatio: number;
  yRatio: number;
};

// Approximate field positions on common form layouts.
export const DEFAULT_FIELD_POSITIONS: Record<PersonalFieldKey, OverlayPosition> = {
  name: { xRatio: 0.2, yRatio: 0.18 },
  address: { xRatio: 0.2, yRatio: 0.31 },
  phone: { xRatio: 0.2, yRatio: 0.49 },
  dob: { xRatio: 0.2, yRatio: 0.62 },
};

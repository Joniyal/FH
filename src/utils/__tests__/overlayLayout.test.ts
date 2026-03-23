import { DEFAULT_FIELD_POSITIONS } from '../overlayLayout';
import { PersonalFieldKey } from '../../types/app';

describe('DEFAULT_FIELD_POSITIONS', () => {
  const allFields: PersonalFieldKey[] = ['name', 'address', 'phone', 'dob'];

  it('should have positions defined for all 4 personal fields', () => {
    allFields.forEach((field) => {
      expect(DEFAULT_FIELD_POSITIONS[field]).toBeDefined();
    });
  });

  it.each(allFields)('xRatio for %s should be between 0 and 1', (field) => {
    const pos = DEFAULT_FIELD_POSITIONS[field];
    expect(pos.xRatio).toBeGreaterThanOrEqual(0);
    expect(pos.xRatio).toBeLessThanOrEqual(1);
  });

  it.each(allFields)('yRatio for %s should be between 0 and 1', (field) => {
    const pos = DEFAULT_FIELD_POSITIONS[field];
    expect(pos.yRatio).toBeGreaterThanOrEqual(0);
    expect(pos.yRatio).toBeLessThanOrEqual(1);
  });

  it('fields should be in top-to-bottom order (name < address < phone < dob)', () => {
    expect(DEFAULT_FIELD_POSITIONS.name.yRatio).toBeLessThan(DEFAULT_FIELD_POSITIONS.address.yRatio);
    expect(DEFAULT_FIELD_POSITIONS.address.yRatio).toBeLessThan(DEFAULT_FIELD_POSITIONS.phone.yRatio);
    expect(DEFAULT_FIELD_POSITIONS.phone.yRatio).toBeLessThan(DEFAULT_FIELD_POSITIONS.dob.yRatio);
  });
});

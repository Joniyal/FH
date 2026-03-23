import {
  matchFormFields,
  getMalayalamFieldPrompt,
  getFieldExplanation,
  getMalayalamFieldExplanation,
} from '../fieldMatcher';
import { PersonalFieldKey, PersonalVaultData } from '../../types/app';

const SAMPLE_PERSONAL_DATA: PersonalVaultData = {
  name: 'Arun Kumar',
  address: 'House No 12, MG Road, Kochi',
  phone: '9876543210',
  dob: '15/08/1990',
};

const EMPTY_PERSONAL_DATA: PersonalVaultData = {
  name: '',
  address: '',
  phone: '',
  dob: '',
};

describe('matchFormFields', () => {
  it('should match all 4 fields when OCR text contains relevant labels', () => {
    const ocrText = 'Name: ________\nAddress: ________\nPhone Number: ________\nDate of Birth: ________';
    const result = matchFormFields(ocrText, SAMPLE_PERSONAL_DATA);

    expect(result.requiredFields).toContain('name');
    expect(result.requiredFields).toContain('address');
    expect(result.requiredFields).toContain('phone');
    expect(result.requiredFields).toContain('dob');
    expect(result.matchedFields.name).toBe('Arun Kumar');
    expect(result.matchedFields.address).toBe('House No 12, MG Road, Kochi');
    expect(result.matchedFields.phone).toBe('9876543210');
    expect(result.matchedFields.dob).toBe('15/08/1990');
  });

  it('should match partial fields when OCR text has only some labels', () => {
    const ocrText = 'Full Name: ________\nMobile Number: ________';
    const result = matchFormFields(ocrText, SAMPLE_PERSONAL_DATA);

    expect(result.requiredFields).toContain('name');
    expect(result.requiredFields).toContain('phone');
    expect(result.requiredFields).not.toContain('address');
    expect(result.matchedFields.name).toBe('Arun Kumar');
    expect(result.matchedFields.phone).toBe('9876543210');
  });

  it('should return empty results for unrecognized text', () => {
    const ocrText = 'This is some random text without form labels xyz abc 123';
    const result = matchFormFields(ocrText, SAMPLE_PERSONAL_DATA);

    expect(result.requiredFields).toHaveLength(0);
    expect(Object.keys(result.matchedFields)).toHaveLength(0);
  });

  it('should mark fields as required but not matched when personal data is empty', () => {
    const ocrText = 'Applicant Name: ________\nResidential Address: ________';
    const result = matchFormFields(ocrText, EMPTY_PERSONAL_DATA);

    expect(result.requiredFields).toContain('name');
    expect(result.requiredFields).toContain('address');
    expect(result.matchedFields.name).toBeUndefined();
    expect(result.matchedFields.address).toBeUndefined();
  });

  it('should be case-insensitive in label matching', () => {
    const ocrText = 'NAME: ________\nADDRESS: ________\nPHONE: ________\nDOB: ________';
    const result = matchFormFields(ocrText, SAMPLE_PERSONAL_DATA);

    expect(result.requiredFields).toHaveLength(4);
    expect(result.matchedFields.name).toBe('Arun Kumar');
  });

  it('should match synonym "candidate name"', () => {
    const ocrText = 'Candidate Name: ________';
    const result = matchFormFields(ocrText, SAMPLE_PERSONAL_DATA);

    expect(result.requiredFields).toContain('name');
    expect(result.matchedFields.name).toBe('Arun Kumar');
  });

  it('should match synonym "permanent address"', () => {
    const ocrText = 'Permanent Address: ________';
    const result = matchFormFields(ocrText, SAMPLE_PERSONAL_DATA);

    expect(result.requiredFields).toContain('address');
    expect(result.matchedFields.address).toBe('House No 12, MG Road, Kochi');
  });

  it('should match synonym "contact number"', () => {
    const ocrText = 'Contact Number: ________';
    const result = matchFormFields(ocrText, SAMPLE_PERSONAL_DATA);

    expect(result.requiredFields).toContain('phone');
  });

  it('should match synonym "birth date"', () => {
    const ocrText = 'Birth Date: ________';
    const result = matchFormFields(ocrText, SAMPLE_PERSONAL_DATA);

    expect(result.requiredFields).toContain('dob');
    expect(result.matchedFields.dob).toBe('15/08/1990');
  });
});

describe('getMalayalamFieldPrompt', () => {
  const allFields: PersonalFieldKey[] = ['name', 'address', 'phone', 'dob'];

  it.each(allFields)('should return a non-empty Malayalam prompt for %s', (field) => {
    const prompt = getMalayalamFieldPrompt(field);
    expect(prompt).toBeTruthy();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(5);
  });
});

describe('getFieldExplanation', () => {
  const allFields: PersonalFieldKey[] = ['name', 'address', 'phone', 'dob'];

  it.each(allFields)('should return a non-empty explanation for %s', (field) => {
    const explanation = getFieldExplanation(field);
    expect(explanation).toBeTruthy();
    expect(typeof explanation).toBe('string');
  });
});

describe('getMalayalamFieldExplanation', () => {
  const allFields: PersonalFieldKey[] = ['name', 'address', 'phone', 'dob'];

  it.each(allFields)('should return a non-empty Malayalam explanation for %s', (field) => {
    const explanation = getMalayalamFieldExplanation(field);
    expect(explanation).toBeTruthy();
    expect(typeof explanation).toBe('string');
  });
});

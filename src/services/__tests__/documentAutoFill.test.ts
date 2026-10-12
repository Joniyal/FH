import { parseDocumentData, extractTextFromImage } from '../ocrService';
import { matchFormFields } from '../../utils/fieldMatcher';
import { PersonalVaultData } from '../../types/app';

describe('Document Upload & Auto-Fill Pipeline', () => {
  it('should extract Aadhaar identity document and auto-populate personal vault fields', async () => {
    // 1. Upload Aadhaar card (image or PDF)
    const ocrResult = await extractTextFromImage('file:///user/documents/aadhaar_scan.pdf', {
      filename: 'aadhaar_card.pdf',
      documentType: 'id_card',
    });

    expect(ocrResult.text).toContain('Aadhaar');
    expect(ocrResult.confidence).toBeGreaterThan(90);

    // 2. Parse identity fields into PersonalVaultData
    const vaultDraft = parseDocumentData(ocrResult.text);
    expect(vaultDraft.name).toBe('Arun Kumar');
    expect(vaultDraft.dob).toBe('15/08/1990');
    expect(vaultDraft.phone).toBe('9876543210');
    expect(vaultDraft.address).toContain('MG Road');

    // 3. User saves to vault
    const savedVault: PersonalVaultData = {
      name: vaultDraft.name!,
      dob: vaultDraft.dob!,
      phone: vaultDraft.phone!,
      address: vaultDraft.address!,
    };

    // 4. Now a new blank form is scanned or uploaded
    const blankFormOCR = await extractTextFromImage('file:///user/forms/admission_form.pdf', {
      filename: 'admission_form.pdf',
    });

    // 5. Form field matcher auto-fills all required fields using saved vault
    const autoFillResult = matchFormFields(blankFormOCR.text, savedVault);

    expect(autoFillResult.requiredFields).toEqual(
      expect.arrayContaining(['name', 'dob', 'address', 'phone'])
    );
    expect(autoFillResult.matchedFields.name).toBe('Arun Kumar');
    expect(autoFillResult.matchedFields.dob).toBe('15/08/1990');
    expect(autoFillResult.matchedFields.phone).toBe('9876543210');
    expect(autoFillResult.matchedFields.address).toContain('MG Road');
  });

  it('should handle PAN card document upload and fill applicant fields', async () => {
    const ocrResult = await extractTextFromImage('file:///user/documents/pan_card.jpg', {
      filename: 'pan_card.jpg',
    });

    const parsed = parseDocumentData(ocrResult.text);
    expect(parsed.name).toBe('Arun Kumar');
    expect(parsed.dob).toBe('15/08/1990');
    expect(parsed.phone).toBe('9876543210');

    const vaultData: PersonalVaultData = {
      name: parsed.name!,
      dob: parsed.dob!,
      phone: parsed.phone!,
      address: 'House No 12, MG Road, Kochi',
    };

    const formResult = matchFormFields(ocrResult.text, vaultData);
    expect(formResult.matchedFields.name).toBe('Arun Kumar');
  });
});

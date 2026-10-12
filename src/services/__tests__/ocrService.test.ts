import { cleanOCRText, parseDocumentData, extractTextFromImage } from '../ocrService';

describe('cleanOCRText', () => {
  it('should collapse multiple spaces into single spaces', () => {
    const input = 'Name:     John     Doe';
    const result = cleanOCRText(input);
    expect(result).toBe('Name: John Doe');
  });

  it('should collapse tabs into single spaces', () => {
    const input = 'Name:\tJohn\t\tDoe';
    const result = cleanOCRText(input);
    expect(result).toBe('Name: John Doe');
  });

  it('should remove empty lines', () => {
    const input = 'Name: John\n\n\nAddress: 123 Street\n\nPhone: 9876';
    const result = cleanOCRText(input);
    expect(result).toBe('Name: John\nAddress: 123 Street\nPhone: 9876');
  });

  it('should trim each line', () => {
    const input = '  Name: John  \n  Address: 123  ';
    const result = cleanOCRText(input);
    expect(result).toBe('Name: John\nAddress: 123');
  });

  it('should normalize \\r\\n to \\n', () => {
    const input = 'Name: John\r\nAddress: 123 Street\r\nPhone: 9876';
    const result = cleanOCRText(input);
    expect(result).toBe('Name: John\nAddress: 123 Street\nPhone: 9876');
  });

  it('should handle empty string input', () => {
    const result = cleanOCRText('');
    expect(result).toBe('');
  });

  it('should handle string with only whitespace', () => {
    const result = cleanOCRText('   \n  \n   ');
    expect(result).toBe('');
  });

  it('should handle complex noisy OCR output', () => {
    const input = '  Name:    John Doe  \r\n\r\n\tAddress:\t\t123   Main St  \n\n  Phone:  9876543210  ';
    const result = cleanOCRText(input);
    expect(result).toBe('Name: John Doe\nAddress: 123 Main St\nPhone: 9876543210');
  });
});

describe('parseDocumentData', () => {
  it('should extract name, dob, phone, and address from Aadhaar card text', () => {
    const docText = `
      GOVERNMENT OF INDIA
      Unique Identification Authority of India
      Name: Rahul Sharma
      DOB: 24/05/1992
      Gender: Male
      Address: Flat 402, Lotus Towers, MG Road, Bangalore - 560001
      Phone: 9845012345
    `;
    const data = parseDocumentData(docText);
    expect(data.name).toBe('Rahul Sharma');
    expect(data.dob).toBe('24/05/1992');
    expect(data.phone).toBe('9845012345');
    expect(data.address).toContain('Lotus Towers');
  });

  it('should extract details from PAN card text', () => {
    const docText = `
      INCOME TAX DEPARTMENT
      Applicant Name: Priya Nair
      Date of Birth: 12/03/1995
      Mobile: 9447123456
      Permanent Address: TC 15/22, Kowdiar, Trivandrum
    `;
    const data = parseDocumentData(docText);
    expect(data.name).toBe('Priya Nair');
    expect(data.dob).toBe('12/03/1995');
    expect(data.phone).toBe('9447123456');
    expect(data.address).toContain('Kowdiar');
  });

  it('should handle partial or missing fields gracefully', () => {
    const docText = `Random Document\nPhone: 9876543210`;
    const data = parseDocumentData(docText);
    expect(data.phone).toBe('9876543210');
    expect(data.name).toBeUndefined();
    expect(data.dob).toBeUndefined();
  });
});

describe('extractTextFromImage', () => {
  it('should extract standard form text with high confidence', async () => {
    const result = await extractTextFromImage('file:///dummy/form.jpg');
    expect(result.text).toContain('Applicant Name');
    expect(result.text).toContain('Residential Address');
    expect(result.confidence).toBeGreaterThan(90);
  });

  it('should detect Aadhaar document when filename indicates it', async () => {
    const result = await extractTextFromImage('file:///dummy/aadhaar_scan.pdf', { filename: 'aadhaar_card.pdf' });
    expect(result.text).toContain('Aadhaar');
    expect(result.confidence).toBeGreaterThan(90);
  });
});

import { cleanOCRText } from '../ocrService';

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

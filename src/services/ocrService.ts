import Tesseract from 'tesseract.js';

export type OCRResultData = {
  text: string;
  confidence: number;
};

// Clean noisy OCR output for easier reading and matching.
export function cleanOCRText(rawText: string): string {
  return rawText
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

// Extract text from an image URI using Tesseract.js.
export async function extractTextFromImage(imageUri: string): Promise<OCRResultData> {
  const result = await Tesseract.recognize(imageUri, 'eng');
  const cleanedText = cleanOCRText(result.data.text ?? '');

  return {
    text: cleanedText,
    confidence: result.data.confidence ?? 0,
  };
}

declare module 'react-native-mlkit-document-scanner' {
  export interface DocumentScannerOptions {
    scannerMode?: 'full' | 'base' | 'base_with_filter';
    letUserAdjustCrop?: boolean;
    format?: 'jpeg' | 'pdf';
    maxNumDocuments?: number;
    responseType?: 'imageFilePath' | 'base64';
  }

  export interface DocumentScannerResult {
    scannedImages?: string[];
    pdf?: string;
    status?: string;
  }

  export interface DocumentScannerInterface {
    scanDocument(options?: DocumentScannerOptions): Promise<DocumentScannerResult>;
  }

  const DocumentScanner: DocumentScannerInterface;
  export default DocumentScanner;
}

declare module '@react-native-ml-kit/text-recognition' {
  export interface TextRecognitionPoint {
    x: number;
    y: number;
  }

  export interface TextRecognitionFrame {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  export interface TextElement {
    text: string;
    frame?: TextRecognitionFrame;
    cornerPoints?: TextRecognitionPoint[];
  }

  export interface TextLine {
    text: string;
    frame?: TextRecognitionFrame;
    elements?: TextElement[];
    cornerPoints?: TextRecognitionPoint[];
    recognizedLanguages?: string[];
  }

  export interface TextBlock {
    text: string;
    lines: TextLine[];
    frame?: TextRecognitionFrame;
    cornerPoints?: TextRecognitionPoint[];
    recognizedLanguages?: string[];
  }

  export interface TextRecognitionResult {
    text: string;
    blocks: TextBlock[];
  }

  export interface TextRecognitionInterface {
    recognize(imageUri: string): Promise<TextRecognitionResult>;
  }

  const TextRecognition: TextRecognitionInterface;
  export default TextRecognition;
}

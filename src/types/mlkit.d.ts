
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

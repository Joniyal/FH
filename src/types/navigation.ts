import { PersonalFieldKey } from './app';

export type RootStackParamList = {
  Home: undefined;
  ScanForm: undefined;
  OCRResult:
    | {
        imageUri?: string;
        filter?: 'original' | 'magic' | 'sharpen' | 'bw' | 'grayscale';
        docSize?: 'a4' | 'id_card' | 'receipt' | 'custom';
        cropBox?: { x: number; y: number; width: number; height: number };
      }
    | undefined;
  PersonalVault: undefined;
  FilledFormPreview:
    | {
        imageUri?: string;
        filledFields?: Partial<Record<PersonalFieldKey, string>>;
      }
    | undefined;
  FormHistory: undefined;
};

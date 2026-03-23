import { PersonalFieldKey } from './app';

export type RootStackParamList = {
  Home: undefined;
  ScanForm: undefined;
  OCRResult:
    | {
        imageUri?: string;
      }
    | undefined;
  PersonalVault: undefined;
  FilledFormPreview:
    | {
        imageUri?: string;
        filledFields?: Partial<Record<PersonalFieldKey, string>>;
      }
    | undefined;
};

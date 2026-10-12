import { MatchResult, PersonalFieldKey, PersonalVaultData } from '../types/app';

type SupportedLanguage = 'en' | 'ml';

const FIELD_SYNONYMS: Record<PersonalFieldKey, string[]> = {
  name: ['name', 'full name', 'applicant name', 'candidate name'],
  address: ['address', 'residence', 'residential address', 'permanent address'],
  phone: ['phone', 'mobile', 'mobile number', 'phone number', 'contact number'],
  dob: ['dob', 'date of birth', 'birth date', 'birth'],
};

export function getFieldPrompt(
  field: PersonalFieldKey,
  language: SupportedLanguage = 'ml'
): string {
  const map: Record<SupportedLanguage, Record<PersonalFieldKey, string>> = {
    en: {
      name: 'Please say your name',
      address: 'Please say your address',
      phone: 'Please say your phone number',
      dob: 'Please say your date of birth',
    },
    ml: {
      name: 'ദയവായി നിങ്ങളുടെ പേര് പറയൂ',
      address: 'ദയവായി നിങ്ങളുടെ വിലാസം പറയൂ',
      phone: 'ദയവായി നിങ്ങളുടെ ഫോൺ നമ്പർ പറയൂ',
      dob: 'ദയവായി നിങ്ങളുടെ ജനനതീയതി പറയൂ',
    },
  };

  return map[language][field];
}

export function getMalayalamFieldPrompt(field: PersonalFieldKey): string {
  return getFieldPrompt(field, 'ml');
}

// Simple explanation text for each field.
export function getFieldExplanation(
  field: PersonalFieldKey,
  language: SupportedLanguage = 'ml'
): string {
  const map: Record<SupportedLanguage, Record<PersonalFieldKey, string>> = {
    en: {
      name: 'Field to write your official full name in the form.',
      address: 'Field to write your complete current residential address.',
      phone: 'Field to write a reachable contact number.',
      dob: 'Field to write date of birth (DD/MM/YYYY).',
    },
    ml: {
      name: 'ഫോമിൽ നിങ്ങളുടെ ഔദ്യോഗിക പൂർണ്ണ പേര് എഴുതേണ്ട ഭാഗം.',
      address: 'ഇപ്പോൾ നിങ്ങൾ താമസിക്കുന്ന മുഴുവൻ വിലാസം എഴുതേണ്ട ഭാഗം.',
      phone: 'ബന്ധപ്പെടാൻ കഴിയുന്ന ഫോൺ നമ്പർ എഴുതേണ്ട ഭാഗം.',
      dob: 'ജനനത്തീയതി (DD/MM/YYYY) എഴുതേണ്ട ഭാഗം.',
    },
  };

  return map[language][field];
}

// Voice explanation line for Malayalam text-to-speech.
export function getFieldSpeechExplanation(
  field: PersonalFieldKey,
  language: SupportedLanguage = 'ml'
): string {
  const map: Record<SupportedLanguage, Record<PersonalFieldKey, string>> = {
    en: {
      name: 'This is the field for your full name.',
      address: 'This is the field for your address.',
      phone: 'This is the field for your phone number.',
      dob: 'This is the field for your date of birth.',
    },
    ml: {
      name: 'ഇത് നിങ്ങളുടെ പൂർണ്ണ പേര് എഴുതാനുള്ള ഫീൽഡ് ആണ്.',
      address: 'ഇത് നിങ്ങളുടെ വിലാസം എഴുതാനുള്ള ഫീൽഡ് ആണ്.',
      phone: 'ഇത് നിങ്ങളുടെ ഫോൺ നമ്പർ എഴുതാനുള്ള ഫീൽഡ് ആണ്.',
      dob: 'ഇത് നിങ്ങളുടെ ജനനത്തീയതി എഴുതാനുള്ള ഫീൽഡ് ആണ്.',
    },
  };

  return map[language][field];
}

export function getMalayalamFieldExplanation(field: PersonalFieldKey): string {
  return getFieldSpeechExplanation(field, 'ml');
}

// Match OCR-detected field labels with known personal data fields.
export function matchFormFields(
  ocrText: string,
  personalData: PersonalVaultData
): MatchResult {
  const normalizedText = ocrText.toLowerCase();
  const requiredFields: PersonalFieldKey[] = [];
  const matchedFields: Partial<Record<PersonalFieldKey, string>> = {};

  (Object.keys(FIELD_SYNONYMS) as PersonalFieldKey[]).forEach((fieldKey) => {
    const synonyms = FIELD_SYNONYMS[fieldKey];
    const labelFound = synonyms.some((label) => normalizedText.includes(label));

    if (!labelFound) {
      return;
    }

    requiredFields.push(fieldKey);

    const value = personalData[fieldKey]?.trim();
    if (value) {
      matchedFields[fieldKey] = value;
    }
  });

  return {
    matchedFields,
    requiredFields,
  };
}

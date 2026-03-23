import { MatchResult, PersonalFieldKey, PersonalVaultData } from '../types/app';

const FIELD_SYNONYMS: Record<PersonalFieldKey, string[]> = {
  name: ['name', 'full name', 'applicant name', 'candidate name'],
  address: ['address', 'residence', 'residential address', 'permanent address'],
  phone: ['phone', 'mobile', 'mobile number', 'phone number', 'contact number'],
  dob: ['dob', 'date of birth', 'birth date', 'birth'],
};

export function getMalayalamFieldPrompt(field: PersonalFieldKey): string {
  const map: Record<PersonalFieldKey, string> = {
    name: 'ദയവായി നിങ്ങളുടെ പേര് പറയൂ',
    address: 'ദയവായി നിങ്ങളുടെ വിലാസം പറയൂ',
    phone: 'ദയവായി നിങ്ങളുടെ ഫോൺ നമ്പർ പറയൂ',
    dob: 'ദയവായി നിങ്ങളുടെ ജനനതീയതി പറയൂ',
  };

  return map[field];
}

// Simple explanation text for each field.
export function getFieldExplanation(field: PersonalFieldKey): string {
  const map: Record<PersonalFieldKey, string> = {
    name: 'ഫോമിൽ നിങ്ങളുടെ ഔദ്യോഗിക പൂർണ്ണ പേര് എഴുതേണ്ട ഭാഗം.',
    address: 'ഇപ്പോൾ നിങ്ങൾ താമസിക്കുന്ന മുഴുവൻ വിലാസം എഴുതേണ്ട ഭാഗം.',
    phone: 'ബന്ധപ്പെടാൻ കഴിയുന്ന ഫോൺ നമ്പർ എഴുതേണ്ട ഭാഗം.',
    dob: 'ജനനത്തീയതി (DD/MM/YYYY) എഴുതേണ്ട ഭാഗം.',
  };

  return map[field];
}

// Voice explanation line for Malayalam text-to-speech.
export function getMalayalamFieldExplanation(field: PersonalFieldKey): string {
  const map: Record<PersonalFieldKey, string> = {
    name: 'ഇത് നിങ്ങളുടെ പൂർണ്ണ പേര് എഴുതാനുള്ള ഫീൽഡ് ആണ്.',
    address: 'ഇത് നിങ്ങളുടെ വിലാസം എഴുതാനുള്ള ഫീൽഡ് ആണ്.',
    phone: 'ഇത് നിങ്ങളുടെ ഫോൺ നമ്പർ എഴുതാനുള്ള ഫീൽഡ് ആണ്.',
    dob: 'ഇത് നിങ്ങളുടെ ജനനത്തീയതി എഴുതാനുള്ള ഫീൽഡ് ആണ്.',
  };

  return map[field];
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

export type PersonalFieldKey = 'name' | 'address' | 'phone' | 'dob';

export type PersonalVaultData = {
  name: string;
  address: string;
  phone: string;
  dob: string;
};

export type MatchResult = {
  matchedFields: Partial<Record<PersonalFieldKey, string>>;
  requiredFields: PersonalFieldKey[];
};

export const EMPTY_PERSONAL_VAULT: PersonalVaultData = {
  name: '',
  address: '',
  phone: '',
  dob: '',
};

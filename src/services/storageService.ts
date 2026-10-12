import AsyncStorage from '@react-native-async-storage/async-storage';
import { EMPTY_PERSONAL_VAULT, PersonalVaultData } from '../types/app';

const PERSONAL_VAULT_KEY = 'fh.personalVault.v1';

// Save personal data in local device storage.
export async function savePersonalVaultData(data: PersonalVaultData): Promise<void> {
  await AsyncStorage.setItem(PERSONAL_VAULT_KEY, JSON.stringify(data));
}

// Read personal data from local device storage.
export async function getPersonalVaultData(): Promise<PersonalVaultData> {
  const raw = await AsyncStorage.getItem(PERSONAL_VAULT_KEY);

  if (!raw) {
    return EMPTY_PERSONAL_VAULT;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersonalVaultData>;
    const readText = (value: unknown): string =>
      typeof value === 'string' ? value : '';

    return {
      name: readText(parsed.name),
      address: readText(parsed.address),
      phone: readText(parsed.phone),
      dob: readText(parsed.dob),
    };
  } catch {
    return EMPTY_PERSONAL_VAULT;
  }
}

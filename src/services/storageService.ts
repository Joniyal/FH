import AsyncStorage from '@react-native-async-storage/async-storage';
import { EMPTY_PERSONAL_VAULT, FormHistoryEntry, PersonalVaultData } from '../types/app';

// ── Personal Vault ──────────────────────────────────────────────────────────

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

// ── Form History ────────────────────────────────────────────────────────────

const FORM_HISTORY_KEY = 'fh.formHistory.v1';
const MAX_HISTORY_ENTRIES = 50;

/** Generate a simple unique ID. */
function generateId(): string {
  return `fh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Retrieve all saved form history entries (newest first). */
export async function getFormHistory(): Promise<FormHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(FORM_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as FormHistoryEntry[];
  } catch {
    return [];
  }
}

/** Add a new entry to form history. Caps at MAX_HISTORY_ENTRIES. */
export async function addFormHistoryEntry(
  entry: Omit<FormHistoryEntry, 'id' | 'timestamp'>
): Promise<FormHistoryEntry> {
  const existing = await getFormHistory();
  const newEntry: FormHistoryEntry = {
    ...entry,
    id: generateId(),
    timestamp: Date.now(),
  };
  // Prepend (newest first) and cap
  const updated = [newEntry, ...existing].slice(0, MAX_HISTORY_ENTRIES);
  await AsyncStorage.setItem(FORM_HISTORY_KEY, JSON.stringify(updated));
  return newEntry;
}

/** Delete a single history entry by ID. */
export async function deleteFormHistoryEntry(id: string): Promise<void> {
  const existing = await getFormHistory();
  const filtered = existing.filter((e) => e.id !== id);
  await AsyncStorage.setItem(FORM_HISTORY_KEY, JSON.stringify(filtered));
}

/** Clear all form history. */
export async function clearFormHistory(): Promise<void> {
  await AsyncStorage.removeItem(FORM_HISTORY_KEY);
}

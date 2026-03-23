import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { EMPTY_PERSONAL_VAULT, PersonalVaultData } from '../types/app';
import { getPersonalVaultData, savePersonalVaultData } from '../services/storageService';

export default function PersonalVaultScreen() {
  const [form, setForm] = useState<PersonalVaultData>(EMPTY_PERSONAL_VAULT);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [screenError, setScreenError] = useState<string>('');

  // Load saved data when screen opens.
  useEffect(() => {
    getPersonalVaultData()
      .then((data) => setForm(data))
      .finally(() => setLoading(false));
  }, []);

  const updateField = (key: keyof PersonalVaultData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const normalized: PersonalVaultData = {
      name: form.name.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
      dob: form.dob.trim(),
    };

    if (!normalized.name) {
      setScreenError('ദയവായി പേര് നൽകുക.');
      return;
    }

    setScreenError('');
    setSaving(true);
    try {
      await savePersonalVaultData(normalized);
      setForm(normalized);
      Alert.alert('സേവ് ചെയ്തു', 'വ്യക്തിഗത വിവരങ്ങൾ ഫോണിൽ സേവ് ചെയ്തു.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'ഡാറ്റ സേവ് ചെയ്യുമ്പോൾ പിശക് സംഭവിച്ചു.';
      setScreenError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleReload = async () => {
    setLoading(true);
    setScreenError('');
    try {
      const data = await getPersonalVaultData();
      setForm(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'ഡാറ്റ വായിക്കുമ്പോൾ പിശക് സംഭവിച്ചു.';
      setScreenError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.heading}>👤 വ്യക്തിഗത വിവരങ്ങൾ</Text>

      <Text style={styles.subText}>ഈ വിവരങ്ങൾ ഉപയോഗിച്ച് ഫോം സ്വയം പൂരിപ്പിക്കാൻ സഹായിക്കും.</Text>

      {screenError ? (
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>{screenError}</Text>
        </View>
      ) : null}

      <View style={styles.inputGroup}>
        <Text style={styles.label}>🪪 പേര്</Text>
        <TextInput
          style={styles.input}
          value={form.name}
          onChangeText={(value) => updateField('name', value)}
          placeholder="നിങ്ങളുടെ പേര്"
          placeholderTextColor="#94A3B8"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>🏠 വിലാസം</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={form.address}
          onChangeText={(value) => updateField('address', value)}
          placeholder="നിങ്ങളുടെ വിലാസം"
          placeholderTextColor="#94A3B8"
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>📱 ഫോൺ നമ്പർ</Text>
        <TextInput
          style={styles.input}
          value={form.phone}
          onChangeText={(value) => updateField('phone', value)}
          keyboardType="phone-pad"
          placeholder="നിങ്ങളുടെ ഫോൺ നമ്പർ"
          placeholderTextColor="#94A3B8"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>🎂 ജനനത്തീയതി</Text>
        <TextInput
          style={styles.input}
          value={form.dob}
          onChangeText={(value) => updateField('dob', value)}
          placeholder="DD/MM/YYYY"
          placeholderTextColor="#94A3B8"
        />
      </View>

      <Pressable
        style={[styles.primaryButton, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.primaryButtonText}>
          {saving ? 'സേവ് ചെയ്യുന്നു...' : '💾 ഫോണിൽ സേവ് ചെയ്യുക'}
        </Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={handleReload}>
        <Text style={styles.secondaryButtonText}>
          {loading ? 'ലോഡ് ചെയ്യുന്നു...' : '↻ സേവ് ചെയ്ത ഡാറ്റ വീണ്ടും കാണിക്കുക'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 28,
  },
  heading: {
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 6,
    color: '#0F172A',
  },
  subText: {
    fontSize: 20,
    color: '#334155',
    marginBottom: 14,
    lineHeight: 30,
  },
  inputGroup: {
    marginBottom: 12,
  },
  errorBlock: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 16,
    fontWeight: '600',
  },
  label: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    color: '#1E293B',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 22,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  multilineInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: '#1D4ED8',
    paddingVertical: 18,
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '700',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 16,
    borderRadius: 16,
  },
  secondaryButtonText: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
});

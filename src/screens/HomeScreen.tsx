import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import LargeActionButton from '../components/LargeActionButton';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      {/* App title and short helper text */}
      <Text style={styles.title}>FH (ഫോം ഹെൽപ്പ്)</Text>
      <Text style={styles.subtitle}>സ്വന്തമായി ഫോം പൂരിപ്പിക്കാൻ ലളിതമായ മലയാളം സഹായി</Text>

      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>🔒 നിങ്ങളുടെ ഡാറ്റ നിങ്ങളുടെ ഫോണിൽ മാത്രം</Text>
        <Text style={styles.noticeText}>ഇത് ഓഫ്‌ലൈൻ ആപ്പ് ആണ്. സർവർ ആവശ്യമില്ല.</Text>
      </View>

      {/* Main navigation actions */}
      <View style={styles.buttonGroup}>
        <LargeActionButton
          label="📷 ഫോം സ്കാൻ ചെയ്യുക"
          subLabel="ക്യാമറ തുറന്ന് ഫോം ചിത്രം എടുക്കുക"
          onPress={() => navigation.navigate('ScanForm')}
        />
        <LargeActionButton
          label="🧾 OCR ഫലം കാണുക"
          subLabel="ചിത്രത്തിൽ നിന്നുള്ള എഴുത്ത് വായിക്കുക"
          onPress={() => navigation.navigate('OCRResult')}
        />
        <LargeActionButton
          label="👤 വ്യക്തിഗത വിവരങ്ങൾ"
          subLabel="പേര്, വിലാസം, ഫോൺ, ജനനത്തീയതി സംരക്ഷിക്കുക"
          onPress={() => navigation.navigate('PersonalVault')}
        />
        <LargeActionButton
          label="✅ പൂരിപ്പിച്ച ഫോം പ്രിവ്യൂ"
          subLabel="അവസാനമായി പൂരിപ്പിച്ച മാതൃക കാണുക"
          onPress={() => navigation.navigate('FilledFormPreview')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 18,
    paddingTop: 22,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 22,
    color: '#334155',
    marginBottom: 14,
    lineHeight: 32,
  },
  noticeCard: {
    backgroundColor: '#E0E7FF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  noticeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E3A8A',
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 16,
    color: '#1E3A8A',
  },
  buttonGroup: {
    marginTop: 4,
  },
});

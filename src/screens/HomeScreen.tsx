import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import LargeActionButton from '../components/LargeActionButton';
import { RootStackParamList } from '../types/navigation';
import { useLanguage } from '../i18n/LanguageContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { t } = useLanguage();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      {/* App title and short helper text */}
      <Text style={styles.title}>{t('home.title')}</Text>
      <Text style={styles.subtitle}>{t('home.subtitle')}</Text>

      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>{t('home.noticeTitle')}</Text>
        <Text style={styles.noticeText}>{t('home.noticeText')}</Text>
      </View>

      {/* Main navigation actions */}
      <View style={styles.buttonGroup}>
        <LargeActionButton
          label={t('home.scanLabel')}
          subLabel={t('home.scanSubLabel')}
          onPress={() => navigation.navigate('ScanForm')}
        />
        <LargeActionButton
          label={t('home.ocrLabel')}
          subLabel={t('home.ocrSubLabel')}
          onPress={() => navigation.navigate('OCRResult')}
        />
        <LargeActionButton
          label={t('home.vaultLabel')}
          subLabel={t('home.vaultSubLabel')}
          onPress={() => navigation.navigate('PersonalVault')}
        />
        <LargeActionButton
          label={t('home.previewLabel')}
          subLabel={t('home.previewSubLabel')}
          onPress={() => navigation.navigate('FilledFormPreview')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 24,
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

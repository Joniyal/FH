import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import LargeActionButton from '../components/LargeActionButton';
import { RootStackParamList } from '../types/navigation';
import { useLanguage } from '../i18n/LanguageContext';
import Colors from '../theme/colors';
import { Radius, Shadow, Spacing, Typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const FEATURES = [
  { key: 'scan', icon: '📷', labelKey: 'home.scanLabel', subKey: 'home.scanSubLabel', route: 'ScanForm' as const },
  { key: 'ocr', icon: '🧾', labelKey: 'home.ocrLabel', subKey: 'home.ocrSubLabel', route: 'OCRResult' as const },
  { key: 'vault', icon: '🔐', labelKey: 'home.vaultLabel', subKey: 'home.vaultSubLabel', route: 'PersonalVault' as const },
  { key: 'preview', icon: '✅', labelKey: 'home.previewLabel', subKey: 'home.previewSubLabel', route: 'FilledFormPreview' as const },
];

export default function HomeScreen({ navigation }: Props) {
  const { t } = useLanguage();

  // Staggered entry animations for cards
  const anims = useRef(FEATURES.map(() => new Animated.Value(0))).current;
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    Animated.stagger(
      90,
      anims.map((anim) =>
        Animated.spring(anim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 120,
          friction: 9,
        })
      )
    ).start();
  }, []);

  const handleQuickUploadPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        navigation.navigate('OCRResult', { imageUri: result.assets[0].uri });
      }
    } catch {
      navigation.navigate('ScanForm');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Animated.View
        style={[
          styles.headerBlock,
          {
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
          },
        ]}
      >
        <View style={styles.logoRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>FH</Text>
          </View>
          <View style={styles.logoMeta}>
            <Text style={styles.appName}>Form Help</Text>
            <Text style={styles.tagline}>{t('home.subtitle')}</Text>
          </View>
        </View>
      </Animated.View>

      {/* Quick Shortcuts Bar */}
      <View style={styles.quickActionsRow}>
        <Pressable
          style={styles.quickActionBtn}
          onPress={() => navigation.navigate('ScanForm')}
        >
          <Text style={styles.quickActionIcon}>📷</Text>
          <Text style={styles.quickActionText}>Adobe Scan</Text>
        </Pressable>

        <Pressable
          style={[styles.quickActionBtn, styles.quickActionBtnPrimary]}
          onPress={handleQuickUploadPdf}
        >
          <Text style={styles.quickActionIcon}>📂</Text>
          <Text style={[styles.quickActionText, styles.quickActionTextPrimary]}>Upload PDF / Doc</Text>
        </Pressable>

        <Pressable
          style={styles.quickActionBtn}
          onPress={() => navigation.navigate('PersonalVault')}
        >
          <Text style={styles.quickActionIcon}>🪪</Text>
          <Text style={styles.quickActionText}>My ID Vault</Text>
        </Pressable>
      </View>

      {/* Privacy notice card */}
      <Animated.View
        style={[
          styles.noticeCard,
          {
            opacity: headerAnim,
            transform: [{ scale: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
          },
        ]}
      >
        <View style={styles.noticeRow}>
          <Text style={styles.noticeIcon}>🔒</Text>
          <View style={styles.noticeTextBlock}>
            <Text style={styles.noticeTitle}>{t('home.noticeTitle')}</Text>
            <Text style={styles.noticeText}>{t('home.noticeText')}</Text>
          </View>
        </View>
      </Animated.View>

      {/* Step indicator */}
      <Text style={styles.sectionLabel}>How it works</Text>
      <View style={styles.stepsRow}>
        {['Scan', 'OCR', 'Vault', 'Preview'].map((step, i) => (
          <View key={step} style={styles.stepItem}>
            <View style={[styles.stepDot, i === 0 && styles.stepDotActive]}>
              <Text style={styles.stepNum}>{i + 1}</Text>
            </View>
            {i < 3 && <View style={styles.stepLine} />}
          </View>
        ))}
      </View>

      {/* Main action buttons */}
      <Text style={styles.sectionLabel}>Features</Text>
      <View style={styles.buttonGroup}>
        {FEATURES.map((feature, index) => (
          <Animated.View
            key={feature.key}
            style={{
              opacity: anims[index],
              transform: [
                {
                  translateY: anims[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
              ],
            }}
          >
            <LargeActionButton
              label={t(feature.labelKey)}
              subLabel={t(feature.subKey)}
              icon={feature.icon}
              onPress={() => navigation.navigate(feature.route as any)}
              variant={index === 0 ? 'primary' : 'secondary'}
            />
          </Animated.View>
        ))}
      </View>

      {/* Footer */}
      <Text style={styles.footer}>v1.0 · Fast & Offline · {new Date().getFullYear()}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  contentContainer: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing['2xl'],
  },
  headerBlock: {
    marginBottom: Spacing.md,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  logoBadge: {
    width: 54,
    height: 54,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryDark,
    borderWidth: 1,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.lg,
  },
  logoText: {
    color: Colors.white,
    fontSize: Typography.lg,
    fontWeight: Typography.extrabold,
    letterSpacing: 1,
  },
  logoMeta: {
    flex: 1,
  },
  appName: {
    fontSize: Typography['2xl'],
    fontWeight: Typography.extrabold,
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  quickActionBtn: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  quickActionBtnPrimary: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  quickActionIcon: {
    fontSize: 22,
  },
  quickActionText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.semibold,
    textAlign: 'center',
  },
  quickActionTextPrimary: {
    color: Colors.primaryLight,
    fontWeight: Typography.bold,
  },
  noticeCard: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  noticeIcon: {
    fontSize: 20,
    lineHeight: 28,
  },
  noticeTextBlock: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.primaryLight,
    marginBottom: 2,
  },
  noticeText: {
    fontSize: Typography.sm,
    color: '#A5B4FC',
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.base,
    paddingHorizontal: Spacing.sm,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primary,
  },
  stepNum: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    color: Colors.textSecondary,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.border,
    marginHorizontal: 2,
  },
  buttonGroup: {
    marginTop: Spacing.xs,
  },
  footer: {
    textAlign: 'center',
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: Spacing.lg,
  },
});

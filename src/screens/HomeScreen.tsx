import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import BottomNavBar from '../components/BottomNavBar';
import QuickFillTemplatesModal, { FormTemplate } from '../components/QuickFillTemplatesModal';
import OnboardingModal from '../components/OnboardingModal';
import { useToast } from '../components/Toast';
import { RootStackParamList } from '../types/navigation';
import { FormHistoryEntry, PersonalFieldKey } from '../types/app';
import { getFormHistory, getPersonalVaultData } from '../services/storageService';
import { useLanguage } from '../i18n/LanguageContext';
import Colors from '../theme/colors';
import { Radius, Shadow, Spacing, Typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

type FeatureItem = {
  key: string;
  icon: string;
  labelKey: string;
  subKey: string;
  route: 'ScanForm' | 'OCRResult' | 'PersonalVault' | 'FilledFormPreview';
};

const FEATURES: FeatureItem[] = [
  { key: 'scan', icon: '📷', labelKey: 'home.scanLabel', subKey: 'home.scanSubLabel', route: 'ScanForm' },
  { key: 'ocr', icon: '🧾', labelKey: 'home.ocrLabel', subKey: 'home.ocrSubLabel', route: 'OCRResult' },
  { key: 'vault', icon: '🔐', labelKey: 'home.vaultLabel', subKey: 'home.vaultSubLabel', route: 'PersonalVault' },
  { key: 'preview', icon: '✅', labelKey: 'home.previewLabel', subKey: 'home.previewSubLabel', route: 'FilledFormPreview' },
];

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function HomeScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [recentHistory, setRecentHistory] = useState<FormHistoryEntry[]>([]);
  const [showTemplates, setShowTemplates] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

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

  // Load recent form history on focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      getFormHistory()
        .then((history) => setRecentHistory(history.slice(0, 3)))
        .catch(() => {});
    });
    return unsubscribe;
  }, [navigation]);

  const handleQuickUploadPdf = useCallback(async () => {
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
  }, [navigation]);

  const handleSelectTemplate = async (template: FormTemplate) => {
    setShowTemplates(false);
    try {
      const vault = await getPersonalVaultData();
      const filled: Partial<Record<PersonalFieldKey, string>> = {};
      template.requiredFields.forEach((field) => {
        if (vault[field]?.trim()) {
          filled[field] = vault[field].trim();
        }
      });
      showToast(`Auto-filled: ${template.title}! ⚡`, 'success');
      navigation.navigate('FilledFormPreview', {
        imageUri: 'template.pdf',
        filledFields: filled,
      });
    } catch {
      showToast('Error loading template', 'error');
    }
  };

  return (
    <View style={styles.rootContainer}>
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
          <Pressable
            style={styles.guideBadgeBtn}
            onPress={() => setShowOnboarding(true)}
          >
            <Text style={styles.guideBadgeText}>❓ Guide</Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Quick Shortcuts Bar */}
      <View style={styles.quickActionsRow}>
        <Pressable
          style={styles.quickActionBtn}
          onPress={() => navigation.navigate('ScanForm')}
        >
          <Text style={styles.quickActionIcon}>📷</Text>
          <Text style={styles.quickActionText}>Scan</Text>
        </Pressable>

        <Pressable
          style={[styles.quickActionBtn, styles.quickActionBtnPrimary]}
          onPress={handleQuickUploadPdf}
        >
          <Text style={styles.quickActionIcon}>📂</Text>
          <Text style={[styles.quickActionText, styles.quickActionTextPrimary]}>PDF</Text>
        </Pressable>

        <Pressable
          style={styles.quickActionBtn}
          onPress={() => setShowTemplates(true)}
        >
          <Text style={styles.quickActionIcon}>⚡</Text>
          <Text style={styles.quickActionText}>Templates</Text>
        </Pressable>

        <Pressable
          style={styles.quickActionBtn}
          onPress={() => navigation.navigate('PersonalVault')}
        >
          <Text style={styles.quickActionIcon}>🪪</Text>
          <Text style={styles.quickActionText}>Vault</Text>
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

      {/* Recent form history */}
      {recentHistory.length > 0 && (
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={styles.sectionLabel}>Recent Forms</Text>
            <Pressable onPress={() => navigation.navigate('FormHistory')}>
              <Text style={styles.seeAllBtn}>See all →</Text>
            </Pressable>
          </View>
          {recentHistory.map((entry) => {
            const filledCount = Object.values(entry.filledFields).filter((v) => v?.trim()).length;
            return (
              <Pressable key={entry.id} style={styles.historyCard}>
                <View style={styles.historyIconWrap}>
                  <Text style={styles.historyIcon}>
                    {entry.formType === 'scan' ? '📷' : entry.formType === 'upload' ? '📄' : '✍️'}
                  </Text>
                </View>
                <View style={styles.historyMeta}>
                  <Text style={styles.historyTitle} numberOfLines={1}>
                    {entry.formType === 'scan' ? 'Scanned Form' : entry.formType === 'upload' ? 'Uploaded Document' : 'Manual Entry'}
                  </Text>
                  <Text style={styles.historySub}>{filledCount}/4 fields · {formatTimeAgo(entry.timestamp)}</Text>
                </View>
                <View style={styles.historyBadge}>
                  <Text style={styles.historyBadgeText}>{filledCount}/4</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Step indicator */}
      <Text style={styles.sectionLabel}>How it works</Text>
      <View style={styles.stepsRow}>
        {['Scan', 'Read', 'Fill', 'Done'].map((step, i) => (
          <View key={step} style={styles.stepItem}>
            <View style={[styles.stepDot, i === 0 && styles.stepDotActive]}>
              <Text style={[styles.stepNum, i === 0 && styles.stepNumActive]}>{i + 1}</Text>
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
              onPress={() => navigation.navigate(feature.route)}
              variant={index === 0 ? 'primary' : 'secondary'}
            />
          </Animated.View>
        ))}
      </View>

      {/* Form History link */}
      <Pressable
        style={styles.historyLinkBtn}
        onPress={() => navigation.navigate('FormHistory')}
      >
        <Text style={styles.historyLinkIcon}>📋</Text>
        <Text style={styles.historyLinkText}>View Form History</Text>
        <Text style={styles.historyLinkArrow}>→</Text>
      </Pressable>

      {/* Footer */}
      <Text style={styles.footer}>v1.0 · Fast & Offline · {new Date().getFullYear()}</Text>
    </ScrollView>

    {/* Bottom navigation bar */}
    <BottomNavBar
      activeTab="Home"
      onNavigate={(tab) => {
        if (tab === 'Home') return;
        navigation.navigate(tab);
      }}
    />

    {/* Quick fill templates modal */}
    <QuickFillTemplatesModal
      visible={showTemplates}
      onClose={() => setShowTemplates(false)}
      onSelectTemplate={handleSelectTemplate}
    />

    {/* Onboarding walkthrough modal */}
    <OnboardingModal
      visible={showOnboarding}
      onDismiss={() => setShowOnboarding(false)}
    />
  </View>
);
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  contentContainer: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: 88,
  },
  guideBadgeBtn: {
    backgroundColor: Colors.bgElevated,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  guideBadgeText: {
    fontSize: Typography.xs,
    color: Colors.textWarm,
    fontWeight: Typography.bold,
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
    borderWidth: 1.5,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.glow,
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
    borderColor: Colors.borderAccent,
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
    backgroundColor: Colors.accentMuted,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.accentDark,
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
    color: Colors.accent,
    marginBottom: 2,
  },
  noticeText: {
    fontSize: Typography.sm,
    color: Colors.accentLight,
    lineHeight: 18,
  },
  recentSection: {
    marginBottom: Spacing.md,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  seeAllBtn: {
    fontSize: Typography.sm,
    color: Colors.primary,
    fontWeight: Typography.semibold,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  historyIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyIcon: {
    fontSize: 18,
  },
  historyMeta: {
    flex: 1,
  },
  historyTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  historySub: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  historyBadge: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
  },
  historyBadgeText: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    color: Colors.primaryLight,
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
  stepNumActive: {
    color: Colors.white,
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
  historyLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.sm,
  },
  historyLinkIcon: {
    fontSize: 20,
  },
  historyLinkText: {
    flex: 1,
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
  },
  historyLinkArrow: {
    fontSize: Typography.lg,
    color: Colors.textMuted,
  },
  footer: {
    textAlign: 'center',
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: Spacing.lg,
  },
});

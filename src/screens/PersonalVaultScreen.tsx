import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { EMPTY_PERSONAL_VAULT, PersonalVaultData } from '../types/app';
import { getPersonalVaultData, savePersonalVaultData } from '../services/storageService';
import { extractTextFromImage, parseDocumentData } from '../services/ocrService';
import { useLanguage } from '../i18n/LanguageContext';
import Colors from '../theme/colors';
import { Radius, Shadow, Spacing, Typography } from '../theme/tokens';

const FIELD_CONFIG: {
  key: keyof PersonalVaultData;
  icon: string;
  labelKey: string;
  placeholderKey: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'phone-pad';
  hint?: string;
}[] = [
  { key: 'name', icon: '🪪', labelKey: 'vault.name', placeholderKey: 'vault.placeholderName', hint: 'Full name as on ID' },
  { key: 'address', icon: '🏠', labelKey: 'vault.address', placeholderKey: 'vault.placeholderAddress', multiline: true, hint: 'Door no, street, city, PIN' },
  { key: 'phone', icon: '📱', labelKey: 'vault.phone', placeholderKey: 'vault.placeholderPhone', keyboardType: 'phone-pad', hint: '10-digit mobile number' },
  { key: 'dob', icon: '🎂', labelKey: 'vault.dob', placeholderKey: 'vault.dob', hint: 'DD/MM/YYYY format' },
];

function FieldCard({
  icon,
  label,
  placeholder,
  value,
  hint,
  onChangeText,
  multiline,
  keyboardType,
  focused,
  onFocus,
  onBlur,
}: {
  icon: string;
  label: string;
  placeholder: string;
  value: string;
  hint?: string;
  onChangeText: (v: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'phone-pad';
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const isFilled = value.trim().length > 0;

  return (
    <View style={[styles.fieldCard, focused && styles.fieldCardFocused]}>
      <View style={styles.fieldHeader}>
        <View style={styles.fieldIconWrap}>
          <Text style={styles.fieldIcon}>{icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>{label}</Text>
          {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
        </View>
        {isFilled && (
          <View style={styles.filledBadge}>
            <Text style={styles.filledBadgeText}>✓</Text>
          </View>
        )}
      </View>
      <TextInput
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          focused && styles.inputFocused,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        keyboardType={keyboardType ?? 'default'}
        textAlignVertical={multiline ? 'top' : 'center'}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </View>
  );
}

export default function PersonalVaultScreen() {
  const { t } = useLanguage();
  const [form, setForm] = useState<PersonalVaultData>(EMPTY_PERSONAL_VAULT);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [analyzingDoc, setAnalyzingDoc] = useState<boolean>(false);
  const [docFeedback, setDocFeedback] = useState<string>('');
  const [screenError, setScreenError] = useState<string>('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const successAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getPersonalVaultData()
      .then((data) => setForm(data))
      .catch((e) => setScreenError(e instanceof Error ? e.message : t('vault.errorRead')))
      .finally(() => setLoading(false));
  }, [t]);

  const updateField = (key: keyof PersonalVaultData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleProcessDocument = async (uri: string, filename: string) => {
    setAnalyzingDoc(true);
    setScreenError('');
    setDocFeedback('');
    try {
      const ocrResult = await extractTextFromImage(uri, { filename });
      const extracted = parseDocumentData(ocrResult.text);

      let count = 0;
      setForm((prev) => {
        const next = { ...prev };
        if (extracted.name?.trim()) {
          next.name = extracted.name.trim();
          count++;
        }
        if (extracted.address?.trim()) {
          next.address = extracted.address.trim();
          count++;
        }
        if (extracted.phone?.trim()) {
          next.phone = extracted.phone.trim();
          count++;
        }
        if (extracted.dob?.trim()) {
          next.dob = extracted.dob.trim();
          count++;
        }
        return next;
      });

      if (count > 0) {
        setDocFeedback(`🎉 Extracted ${count} field(s) from "${filename}"! Review and save.`);
      } else {
        setDocFeedback(`Document processed. Please review or fill remaining fields.`);
      }
    } catch (e) {
      setScreenError(e instanceof Error ? e.message : 'Failed to parse document');
    } finally {
      setAnalyzingDoc(false);
    }
  };

  const handleUploadDocumentPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        const file = result.assets[0];
        await handleProcessDocument(file.uri, file.name || 'document.pdf');
      }
    } catch (e) {
      setScreenError(e instanceof Error ? e.message : 'Error picking document');
    }
  };

  const handleUploadDocumentPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setScreenError('Gallery permission required to select document photo');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        await handleProcessDocument(result.assets[0].uri, result.assets[0].fileName || 'id_card.jpg');
      }
    } catch (e) {
      setScreenError(e instanceof Error ? e.message : 'Error picking image');
    }
  };

  const filledCount = Object.values(form).filter((v) => v.trim()).length;
  const progressRatio = filledCount / 4;

  const handleSave = async () => {
    const normalized: PersonalVaultData = {
      name: form.name.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
      dob: form.dob.trim(),
    };

    if (!normalized.name) {
      setScreenError(t('vault.errorNameRequired'));
      return;
    }

    setScreenError('');
    setSaving(true);
    try {
      await savePersonalVaultData(normalized);
      setForm(normalized);
      setSaveSuccess(true);
      Animated.sequence([
        Animated.timing(successAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(1800),
        Animated.timing(successAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setSaveSuccess(false));
    } catch (e) {
      setScreenError(e instanceof Error ? e.message : t('vault.errorSave'));
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
      setScreenError(e instanceof Error ? e.message : t('vault.errorRead'));
    } finally {
      setLoading(false);
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
      <Text style={styles.heading}>{t('vault.heading')}</Text>
      <Text style={styles.subText}>{t('vault.subText')}</Text>

      {/* Auto-Fill from Document Card */}
      <View style={styles.docAutoFillCard}>
        <View style={styles.docAutoFillHeader}>
          <Text style={styles.docAutoFillIcon}>⚡</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.docAutoFillTitle}>{t('vault.uploadMyDoc')}</Text>
            <Text style={styles.docAutoFillSub}>
              Scan or upload Aadhaar, PAN card, or ID to auto-populate vault
            </Text>
          </View>
        </View>

        <View style={styles.docButtonsRow}>
          <Pressable
            style={styles.docUploadBtn}
            onPress={handleUploadDocumentPdf}
            disabled={analyzingDoc}
          >
            <Text style={styles.docUploadBtnText}>📁 Upload PDF</Text>
          </Pressable>

          <Pressable
            style={[styles.docUploadBtn, styles.docUploadBtnSecondary]}
            onPress={handleUploadDocumentPhoto}
            disabled={analyzingDoc}
          >
            <Text style={styles.docUploadBtnTextSecondary}>🖼️ Upload ID Photo</Text>
          </Pressable>
        </View>

        {analyzingDoc && (
          <View style={styles.docLoadingRow}>
            <ActivityIndicator size="small" color={Colors.primaryLight} />
            <Text style={styles.docLoadingText}>Analyzing document & extracting details...</Text>
          </View>
        )}

        {docFeedback ? (
          <View style={styles.docFeedbackBadge}>
            <Text style={styles.docFeedbackText}>{docFeedback}</Text>
          </View>
        ) : null}
      </View>

      {/* Progress bar */}
      <View style={styles.progressBlock}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Profile completion</Text>
          <Text style={styles.progressPercent}>{Math.round(progressRatio * 100)}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressRatio * 100}%` as any }]} />
        </View>
        <Text style={styles.progressSub}>{filledCount} of 4 fields filled</Text>
      </View>

      {/* Error block */}
      {screenError ? (
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>⚠️  {screenError}</Text>
        </View>
      ) : null}

      {/* Loading state */}
      {loading ? (
        <View style={styles.loadingBlock}>
          <Text style={styles.loadingText}>⏳  {t('vault.loading')}</Text>
        </View>
      ) : null}

      {/* Fields */}
      {FIELD_CONFIG.map((field) => (
        <FieldCard
          key={field.key}
          icon={field.icon}
          label={t(field.labelKey)}
          placeholder={field.placeholderKey === 'vault.dob' ? 'DD/MM/YYYY' : t(field.placeholderKey)}
          value={form[field.key]}
          hint={field.hint}
          onChangeText={(v) => updateField(field.key, v)}
          multiline={field.multiline}
          keyboardType={field.keyboardType}
          focused={focusedField === field.key}
          onFocus={() => setFocusedField(field.key)}
          onBlur={() => setFocusedField(null)}
        />
      ))}

      {/* Save success banner */}
      <Animated.View
        style={[
          styles.successBanner,
          { opacity: successAnim, transform: [{ translateY: successAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.successBannerText}>✅  Details saved successfully!</Text>
      </Animated.View>

      {/* Save button */}
      <Pressable
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving || loading}
        accessibilityRole="button"
      >
        <Text style={styles.saveBtnText}>
          {saving ? '⏳  ' + t('vault.saving') : '💾  ' + t('vault.save')}
        </Text>
      </Pressable>

      {/* Reload button */}
      <Pressable
        style={styles.reloadBtn}
        onPress={handleReload}
        disabled={loading}
        accessibilityRole="button"
      >
        <Text style={styles.reloadBtnText}>
          {loading ? t('vault.loading') : t('vault.reload')}
        </Text>
      </Pressable>

      {/* Privacy note */}
      <View style={styles.privacyNote}>
        <Text style={styles.privacyText}>🔒  Your data is stored only on this device. Never uploaded.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  contentContainer: {
    padding: Spacing.base,
    paddingBottom: Spacing['2xl'],
  },
  heading: {
    fontSize: Typography['2xl'],
    fontWeight: Typography.extrabold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subText: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.base,
    lineHeight: 26,
  },
  docAutoFillCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.primary,
    ...Shadow.sm,
  },
  docAutoFillHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  docAutoFillIcon: {
    fontSize: 22,
    lineHeight: 26,
  },
  docAutoFillTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.primaryLight,
  },
  docAutoFillSub: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  docButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  docUploadBtn: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  docUploadBtnSecondary: {
    backgroundColor: Colors.bgElevated,
    borderColor: Colors.border,
  },
  docUploadBtnText: {
    color: Colors.white,
    fontWeight: Typography.bold,
    fontSize: Typography.xs,
  },
  docUploadBtnTextSecondary: {
    color: Colors.textSecondary,
    fontWeight: Typography.semibold,
    fontSize: Typography.xs,
  },
  docLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  docLoadingText: {
    fontSize: Typography.xs,
    color: Colors.primaryLight,
    fontWeight: Typography.medium,
  },
  docFeedbackBadge: {
    backgroundColor: Colors.successBg,
    borderColor: Colors.success,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.xs,
    marginTop: Spacing.sm,
  },
  docFeedbackText: {
    color: Colors.success,
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    textAlign: 'center',
  },
  progressBlock: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  progressLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  progressPercent: {
    fontSize: Typography.sm,
    color: Colors.primaryLight,
    fontWeight: Typography.bold,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
  },
  progressSub: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
  },
  errorBlock: {
    backgroundColor: Colors.dangerBg,
    borderColor: Colors.danger,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  errorText: {
    color: Colors.dangerLight,
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    lineHeight: 22,
  },
  loadingBlock: {
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  loadingText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
  },
  fieldCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fieldCardFocused: {
    borderColor: Colors.primary,
    ...Shadow.md,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  fieldIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldIcon: {
    fontSize: 18,
  },
  fieldLabel: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  fieldHint: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  filledBadge: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    backgroundColor: Colors.successBg,
    borderColor: Colors.success,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filledBadgeText: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: Typography.bold,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.lg,
    color: Colors.textPrimary,
    backgroundColor: Colors.bgInput,
    minHeight: 48,
  },
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  inputFocused: {
    borderColor: Colors.primary,
  },
  successBanner: {
    backgroundColor: Colors.successBg,
    borderColor: Colors.success,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  successBannerText: {
    color: Colors.success,
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    textAlign: 'center',
  },
  saveBtn: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primary,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.base,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
    ...Shadow.lg,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: Colors.white,
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    textAlign: 'center',
  },
  reloadBtn: {
    backgroundColor: Colors.bgCard,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  reloadBtnText: {
    color: Colors.textSecondary,
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    textAlign: 'center',
  },
  privacyNote: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderColor: Colors.primary,
    borderWidth: 1,
  },
  privacyText: {
    color: '#A5B4FC',
    fontSize: Typography.sm,
    textAlign: 'center',
    lineHeight: 18,
  },
});

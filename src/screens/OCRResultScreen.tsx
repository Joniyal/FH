import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  DimensionValue,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { extractTextFromImage } from '../services/ocrService';
import { getPersonalVaultData, savePersonalVaultData } from '../services/storageService';
import { MatchResult, PersonalFieldKey, PersonalVaultData } from '../types/app';
import {
  getFieldPrompt,
  getFieldExplanation,
  getFieldSpeechExplanation,
  matchFormFields,
} from '../utils/fieldMatcher';
import { speakText } from '../services/speechService';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { useLanguage } from '../i18n/LanguageContext';
import Colors from '../theme/colors';
import { Radius, Shadow, Spacing, Typography } from '../theme/tokens';
import { useToast } from '../components/Toast';
import ProgressRing from '../components/ProgressRing';
import SkeletonItem, { SkeletonCard } from '../components/SkeletonLoader';

type Props = NativeStackScreenProps<RootStackParamList, 'OCRResult'>;

const OCR_CONFIDENCE_THRESHOLD = 70;

type VoiceMode = 'field' | 'confidence' | null;

const FIELD_ICONS: Record<PersonalFieldKey, string> = {
  name: '🪪',
  address: '🏠',
  phone: '📱',
  dob: '🎂',
};

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.header}>
        {icon ? <Text style={cardStyles.icon}>{icon}</Text> : null}
        <Text style={cardStyles.title}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  icon: {
    fontSize: 20,
    lineHeight: 26,
  },
  title: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
});

function ActionBtn({
  label,
  onPress,
  disabled,
  variant = 'primary',
  small,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  small?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={[
          btnStyles.btn,
          variant === 'primary' && btnStyles.primary,
          variant === 'secondary' && btnStyles.secondary,
          variant === 'ghost' && btnStyles.ghost,
          small && btnStyles.small,
          disabled && btnStyles.disabled,
        ]}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, tension: 200, friction: 10 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 10 }).start()}
        disabled={disabled}
      >
        <Text style={[btnStyles.text, variant === 'secondary' && btnStyles.textSecondary, variant === 'ghost' && btnStyles.textGhost]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const btnStyles = StyleSheet.create({
  btn: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  primary: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primary,
    ...Shadow.lg,
  },
  secondary: {
    backgroundColor: Colors.bgElevated,
    borderColor: Colors.border,
  },
  ghost: {
    backgroundColor: Colors.transparent,
    borderColor: Colors.borderLight,
  },
  small: {
    paddingVertical: Spacing.sm,
  },
  disabled: { opacity: 0.45 },
  text: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  textSecondary: {
    color: Colors.textSecondary,
    fontWeight: Typography.semibold,
  },
  textGhost: {
    color: Colors.textMuted,
    fontSize: Typography.base,
  },
});

export default function OCRResultScreen({ route, navigation }: Props) {
  const { t, language } = useLanguage();
  const recognitionLanguage = language === 'ml' ? 'ml-IN' : 'en-IN';
  const speechLanguage = language === 'ml' ? 'ml-IN' : 'en-IN';

  const fieldLabels: Record<PersonalFieldKey, string> = {
    name: t('field.name'),
    address: t('field.address'),
    phone: t('field.phone'),
    dob: t('field.dob'),
  };

  const { showToast } = useToast();
  const [currentImageUri, setCurrentImageUri] = useState<string>(route.params?.imageUri || '');
  const [selectedFilter, setSelectedFilter] = useState<'magic' | 'sharpen' | 'bw' | 'grayscale' | 'original'>(
    route.params?.filter || 'magic'
  );

  const [loadingOCR, setLoadingOCR] = useState<boolean>(false);
  const [ocrProgressStep, setOcrProgressStep] = useState<number>(1);
  const [ocrText, setOcrText] = useState<string>('');
  const [ocrConfidence, setOcrConfidence] = useState<number>(0);
  const [ocrError, setOcrError] = useState<string>('');
  const [ocrDone, setOcrDone] = useState<boolean>(false);

  // Edit text modal
  const [editingText, setEditingText] = useState<boolean>(false);
  const [editedTextValue, setEditedTextValue] = useState<string>('');

  const [personalData, setPersonalData] = useState<PersonalVaultData>({
    name: '', address: '', phone: '', dob: '',
  });
  const [voiceFilledFields, setVoiceFilledFields] = useState<Partial<Record<PersonalFieldKey, string>>>({});
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(null);
  const [selectedField, setSelectedField] = useState<PersonalFieldKey | null>(null);
  const [confidenceConfirmed, setConfidenceConfirmed] = useState<boolean | null>(null);
  const [speechAvailable, setSpeechAvailable] = useState<boolean>(true);
  const [speechServiceName, setSpeechServiceName] = useState<string>('');

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  const { transcript, listening, error: speechError, startListening, stopListening, clearTranscript } =
    useSpeechToText(recognitionLanguage);

  useEffect(() => {
    if (route.params?.imageUri) {
      setCurrentImageUri(route.params.imageUri);
    }
    if (route.params?.filter) {
      setSelectedFilter(route.params.filter);
    }
  }, [route.params?.filter, route.params?.imageUri]);

  useEffect(() => {
    getPersonalVaultData()
      .then(setPersonalData)
      .catch((error) => setOcrError(error instanceof Error ? error.message : t('vault.errorRead')));
  }, [t]);

  useEffect(() => {
    try {
      const available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
      setSpeechAvailable(available);
      if (Platform.OS === 'android') {
        const service = ExpoSpeechRecognitionModule.getDefaultRecognitionService();
        setSpeechServiceName(service?.packageName ?? '');
      }
    } catch {
      setSpeechAvailable(false);
    }
  }, []);

  useEffect(() => {
    if (listening) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [listening]);

  const handleRunOCR = async (
    targetUri?: string,
    filterOverride?: 'magic' | 'sharpen' | 'bw' | 'grayscale' | 'original'
  ) => {
    const uriToProcess = targetUri || currentImageUri;
    if (loadingOCR) return;
    if (!uriToProcess) {
      return;
    }

    const activeFilterToUse = filterOverride || selectedFilter;
    setLoadingOCR(true);
    setOcrError('');
    setOcrDone(false);
    setOcrProgressStep(1);

    // Multi-step scanning feedback
    const timer1 = setTimeout(() => setOcrProgressStep(2), 350);
    const timer2 = setTimeout(() => setOcrProgressStep(3), 750);

    try {
      const result = await extractTextFromImage(uriToProcess, {
        filter: activeFilterToUse,
        docSize: route.params?.docSize,
      });
      setOcrText(result.text);
      setOcrConfidence(result.confidence);
      setConfidenceConfirmed(null);
      setOcrDone(true);
      showToast('Document text recognized & clarified! 🎯', 'success');
    } catch (error) {
      setOcrError(error instanceof Error ? error.message : t('ocr.errorGeneric'));
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setLoadingOCR(false);
    }
  };

  useEffect(() => {
    if (currentImageUri && !ocrDone && !loadingOCR && !ocrText) {
      handleRunOCR(currentImageUri);
    }
  }, [currentImageUri]);

  const handlePickFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast('Gallery permission required', 'warning');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        const uri = result.assets[0].uri;
        setCurrentImageUri(uri);
        handleRunOCR(uri);
        showToast('Document image selected!', 'info');
      }
    } catch {
      showToast('Error picking image', 'error');
    }
  };

  const handleUploadDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        const uri = result.assets[0].uri;
        setCurrentImageUri(uri);
        handleRunOCR(uri);
        showToast('Document uploaded!', 'info');
      }
    } catch {
      showToast('Error selecting document', 'error');
    }
  };

  const handleAutoFillAll = () => {
    const filled: Partial<Record<PersonalFieldKey, string>> = {};
    (['name', 'address', 'phone', 'dob'] as PersonalFieldKey[]).forEach((k) => {
      if (personalData[k]?.trim()) {
        filled[k] = personalData[k].trim();
      }
    });
    setVoiceFilledFields((prev) => ({ ...prev, ...filled }));
    showToast('Auto-filled from Vault! ⚡', 'success');
  };

  const matchResult: MatchResult = useMemo(() => {
    if (!ocrText) return { matchedFields: {}, requiredFields: [] };
    return matchFormFields(ocrText, personalData);
  }, [ocrText, personalData]);

  const finalFilledFields = useMemo(
    () => ({ ...matchResult.matchedFields, ...voiceFilledFields }),
    [matchResult.matchedFields, voiceFilledFields]
  );

  const pendingRequiredFields = useMemo(
    () => matchResult.requiredFields.filter((key) => !finalFilledFields[key]?.trim()),
    [finalFilledFields, matchResult.requiredFields]
  );

  useEffect(() => {
    if (!transcript.trim()) return;

    if (voiceMode === 'confidence') {
      const normalized = transcript.trim().toLowerCase();
      const isYes = normalized.includes('അതെ') || normalized.includes('ശരി') || normalized.includes('yes') || normalized.includes('ok');
      const isNo = normalized.includes('ഇല്ല') || normalized.includes('വേണ്ട') || normalized.includes('no');
      if (isYes) setConfidenceConfirmed(true);
      else if (isNo) setConfidenceConfirmed(false);
      setVoiceMode(null);
      return;
    }

    if (voiceMode !== 'field') return;
    const missingField = pendingRequiredFields[0];
    if (!missingField) return;
    setVoiceFilledFields((prev) => ({ ...prev, [missingField]: transcript.trim() }));
    setVoiceMode(null);
  }, [pendingRequiredFields, transcript, voiceMode]);

  const isLowConfidence = ocrConfidence > 0 && ocrConfidence < OCR_CONFIDENCE_THRESHOLD;
  const filledCount = Object.values(finalFilledFields).filter((v) => v?.trim()).length;

  const handleSpeakPrompt = () => {
    const field = pendingRequiredFields[0] ?? 'name';
    speakText(getFieldPrompt(field, language), speechLanguage);
  };

  const handleStartFieldVoiceInput = async () => {
    if (!speechAvailable) { setOcrError(t('ocr.errorSpeechUnavailable')); return; }
    setVoiceMode('field');
    clearTranscript();
    const started = await startListening();
    if (!started) setVoiceMode(null);
  };

  const handleAskConfidenceByVoice = () => speakText(t('ocr.confirmQuestion'), speechLanguage);

  const handleStartConfidenceConfirmation = async () => {
    if (!speechAvailable) { setOcrError(t('ocr.errorSpeechUnavailable')); return; }
    setVoiceMode('confidence');
    clearTranscript();
    const started = await startListening();
    if (!started) setVoiceMode(null);
  };

  const handleSpeakFieldExplanation = () => {
    if (!selectedField) return;
    speakText(getFieldSpeechExplanation(selectedField, language), speechLanguage);
  };

  const handleGoToFilledPreview = () => {
    if (!currentImageUri) { setOcrError(t('ocr.errorPreviewNoImage')); return; }
    if (!ocrText.trim()) { setOcrError(t('ocr.errorPreviewNoText')); return; }
    navigation.navigate('FilledFormPreview', { imageUri: currentImageUri, filledFields: finalFilledFields });
  };

  const getConfidenceColor = () => {
    if (ocrConfidence >= 85) return Colors.success;
    if (ocrConfidence >= OCR_CONFIDENCE_THRESHOLD) return Colors.warning;
    return Colors.danger;
  };

  // 1. Copy All Text to Clipboard / Share Sheet
  const handleCopyAllText = () => {
    if (!ocrText) return;
    Share.share({
      message: ocrText,
      title: 'Scanned Document OCR Text',
    });
    showToast('Text ready to copy or share! 📋', 'success');
  };

  // 2. Export as PDF or Structured Document
  const handleShareDocument = () => {
    if (!ocrText) return;
    const filterName =
      selectedFilter === 'magic'
        ? 'Magic Color (Sharpened)'
        : selectedFilter === 'sharpen'
        ? 'Ultra Crisp Text'
        : selectedFilter === 'bw'
        ? 'Clean B&W'
        : selectedFilter === 'grayscale'
        ? 'Grayscale'
        : 'Original';

    const exportText = `📄 SCANNED DOCUMENT OCR REPORT\nAccuracy: ${ocrConfidence.toFixed(1)}%\nClarity Filter: ${filterName}\n\n==================================\nRECOGNIZED DOCUMENT TEXT:\n==================================\n${ocrText}\n\n==================================\nEXTRACTED FORM FIELDS:\n==================================\n• Name: ${finalFilledFields.name || 'N/A'}\n• DOB: ${finalFilledFields.dob || 'N/A'}\n• Phone: ${finalFilledFields.phone || 'N/A'}\n• Address: ${finalFilledFields.address || 'N/A'}\n\nGenerated by FH Document Scanner`;

    Share.share({
      message: exportText,
      title: 'Export Scanned Document',
    });
  };

  // 3. Save extracted fields to Vault
  const handleSaveExtractedToVault = async () => {
    try {
      await savePersonalVaultData({
        name: finalFilledFields.name || personalData.name,
        address: finalFilledFields.address || personalData.address,
        phone: finalFilledFields.phone || personalData.phone,
        dob: finalFilledFields.dob || personalData.dob,
      });
      showToast('Extracted details saved to your profile vault! 🪪', 'success');
    } catch {
      showToast('Error saving to vault', 'error');
    }
  };

  // 4. Edit Text Modal
  const handleOpenEditModal = () => {
    setEditedTextValue(ocrText);
    setEditingText(true);
  };

  const handleSaveEditedText = () => {
    setOcrText(editedTextValue);
    setEditingText(false);
    showToast('Recognized text updated! ✏️', 'success');
  };

  // Statistics
  const wordCount = useMemo(() => (ocrText.trim() ? ocrText.trim().split(/\s+/).length : 0), [ocrText]);
  const charCount = ocrText.length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.heading}>{t('ocr.heading')}</Text>
      <Text style={styles.helperText}>{t('ocr.helper')}</Text>

      {/* If no document selected yet, offer instant source options */}
      {!currentImageUri ? (
        <View style={styles.documentPickerCard}>
          <Text style={styles.documentPickerTitle}>Select Form to Process</Text>
          <Text style={styles.documentPickerSub}>
            Scan with camera or upload an existing image/PDF to auto-extract fields
          </Text>
          <View style={styles.pickerBtnsRow}>
            <Pressable
              style={styles.pickerBtn}
              onPress={() => navigation.navigate('ScanForm')}
            >
              <Text style={styles.pickerBtnIcon}>📷</Text>
              <Text style={styles.pickerBtnText}>Camera</Text>
            </Pressable>
            <Pressable style={styles.pickerBtn} onPress={handlePickFromGallery}>
              <Text style={styles.pickerBtnIcon}>🖼️</Text>
              <Text style={styles.pickerBtnText}>Gallery</Text>
            </Pressable>
            <Pressable style={styles.pickerBtn} onPress={handleUploadDocument}>
              <Text style={styles.pickerBtnIcon}>📁</Text>
              <Text style={styles.pickerBtnText}>PDF / Doc</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Multi-step scanning & image sharpening progress HUD */}
      {loadingOCR ? (
        <View style={styles.scanningProgressCard}>
          <View style={styles.scanningProgressHeader}>
            <ActivityIndicator size="small" color={Colors.accent} />
            <Text style={styles.scanningProgressTitle}>Recognizing & Sharpening Document...</Text>
          </View>

          <View style={styles.scanningStepsList}>
            <View style={[styles.scanningStepItem, ocrProgressStep >= 1 && styles.scanningStepItemActive]}>
              <Text style={styles.scanningStepIcon}>{ocrProgressStep > 1 ? '✓' : '1'}</Text>
              <Text style={[styles.scanningStepText, ocrProgressStep >= 1 && styles.scanningStepTextActive]}>
                ✨ Sharpening image contrast & clarifying blurry edges
              </Text>
            </View>

            <View style={[styles.scanningStepItem, ocrProgressStep >= 2 && styles.scanningStepItemActive]}>
              <Text style={styles.scanningStepIcon}>{ocrProgressStep > 2 ? '✓' : '2'}</Text>
              <Text style={[styles.scanningStepText, ocrProgressStep >= 2 && styles.scanningStepTextActive]}>
                ⚡ Neural OCR scanning text characters & word lines
              </Text>
            </View>

            <View style={[styles.scanningStepItem, ocrProgressStep >= 3 && styles.scanningStepItemActive]}>
              <Text style={styles.scanningStepIcon}>3</Text>
              <Text style={[styles.scanningStepText, ocrProgressStep >= 3 && styles.scanningStepTextActive]}>
                📑 Extracting form fields, applicant details & table data
              </Text>
            </View>
          </View>

          <View style={{ marginTop: Spacing.sm }}>
            <SkeletonCard lines={3} />
          </View>
        </View>
      ) : null}

      {/* Error block */}
      {ocrError ? (
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>⚠️  {ocrError}</Text>
        </View>
      ) : null}

      {/* Speech unavailable warning */}
      {!speechAvailable ? (
        <View style={styles.warningBlock}>
          <Text style={styles.warningTitle}>{t('ocr.speechUnavailableTitle')}</Text>
          <Text style={styles.warningText}>{t('ocr.speechUnavailableText')}</Text>
          {speechServiceName ? <Text style={styles.warningText}>Service: {speechServiceName}</Text> : null}
        </View>
      ) : null}

      {/* Low confidence warning */}
      {isLowConfidence ? (
        <View style={styles.warningBlock}>
          <Text style={styles.warningTitle}>{t('ocr.lowConfidenceTitle')}</Text>
          <Text style={styles.warningText}>
            {t('ocr.lowConfidenceText', { confidence: ocrConfidence.toFixed(1) })}
          </Text>
          <ActionBtn label={t('ocr.listenQuestion')} onPress={handleAskConfidenceByVoice} variant="secondary" small />
          <ActionBtn label={t('ocr.sayYesNo')} onPress={handleStartConfidenceConfirmation} variant="primary" small />
          {confidenceConfirmed !== null ? (
            <View style={[styles.confirmBadge, confidenceConfirmed ? styles.confirmBadgeYes : styles.confirmBadgeNo]}>
              <Text style={styles.confirmBadgeText}>
                {confidenceConfirmed ? t('ocr.confirmedYes') : t('ocr.confirmedNo')}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Document Clarity & Thumbnail Header Card */}
      {currentImageUri && (
        <View style={styles.docOverviewCard}>
          <View style={styles.docOverviewRow}>
            {currentImageUri.toLowerCase().endsWith('.pdf') ? (
              <View style={styles.docOverviewPdfBox}>
                <Text style={{ fontSize: 24 }}>📑</Text>
              </View>
            ) : (
              <Image source={{ uri: currentImageUri }} style={styles.docThumbnail} />
            )}

            <View style={styles.docOverviewMeta}>
              <View style={styles.docOverviewTags}>
                <View style={styles.clarityBadge}>
                  <Text style={styles.clarityBadgeText}>
                    ✨ {selectedFilter === 'magic' ? 'Magic Color' : selectedFilter === 'sharpen' ? 'Ultra Crisp' : selectedFilter === 'bw' ? 'Clean B&W' : 'Original'}
                  </Text>
                </View>
                {ocrConfidence > 0 && (
                  <View style={[styles.accuracyBadge, { backgroundColor: getConfidenceColor() }]}>
                    <Text style={styles.accuracyBadgeText}>{ocrConfidence.toFixed(1)}% Accuracy</Text>
                  </View>
                )}
              </View>

              <Text style={styles.docStatsText}>
                {ocrDone ? `${wordCount} words · ${charCount} characters` : 'Document Loaded'}
              </Text>
            </View>

            <Pressable
              style={styles.reScanBtn}
              onPress={() => handleRunOCR()}
              disabled={loadingOCR}
            >
              <Text style={styles.reScanBtnText}>↻ Re-Scan</Text>
            </Pressable>
          </View>

          {/* Quick Filter Switcher */}
          <View style={styles.filterSwitcherRow}>
            <Text style={styles.filterSwitcherLabel}>Sharpen Filter:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {[
                { key: 'magic', label: '✨ Magic' },
                { key: 'sharpen', label: '🔍 Ultra Crisp' },
                { key: 'bw', label: '📄 B&W' },
                { key: 'original', label: '📷 Raw' },
              ].map((f) => (
                <Pressable
                  key={f.key}
                  style={[
                    styles.miniFilterChip,
                    selectedFilter === f.key && styles.miniFilterChipActive,
                  ]}
                  onPress={() => {
                    const next = f.key as 'magic' | 'sharpen' | 'bw' | 'grayscale' | 'original';
                    setSelectedFilter(next);
                    handleRunOCR(currentImageUri, next);
                  }}
                >
                  <Text
                    style={[
                      styles.miniFilterChipText,
                      selectedFilter === f.key && styles.miniFilterChipTextActive,
                    ]}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Recognized Document Text Section (Core Feature) */}
      <SectionCard title="Recognized Document Text (OCR)" icon="📄">
        {/* Confidence meter */}
        {ocrConfidence > 0 && (
          <View style={styles.confidenceBlock}>
            <View style={styles.confidenceRow}>
              <Text style={styles.confidenceLabel}>
                {t('ocr.confidence', { confidence: ocrConfidence.toFixed(1) })}
              </Text>
              <View style={[styles.confidenceDot, { backgroundColor: getConfidenceColor() }]} />
            </View>
            <View style={styles.confidenceTrack}>
              <View
                style={[
                  styles.confidenceFill,
                  {
                    width: `${Math.round(ocrConfidence)}%` as DimensionValue,
                    backgroundColor: getConfidenceColor(),
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* Text Box with Selectable Text */}
        <View style={styles.ocrTextBox}>
          <ScrollView nestedScrollEnabled style={{ maxHeight: 240 }} showsVerticalScrollIndicator>
            <Text selectable style={styles.ocrText}>
              {ocrText || (loadingOCR ? 'Analyzing and reading text contours...' : t('ocr.emptyResult'))}
            </Text>
          </ScrollView>
        </View>

        {/* Text Actions Toolbar: Copy, Edit, Export */}
        {ocrDone && ocrText.length > 0 && (
          <View style={styles.textActionsBar}>
            <Pressable style={styles.textActionBtn} onPress={handleCopyAllText}>
              <Text style={styles.textActionBtnIcon}>📋</Text>
              <Text style={styles.textActionBtnText}>Copy Text</Text>
            </Pressable>

            <Pressable style={styles.textActionBtn} onPress={handleOpenEditModal}>
              <Text style={styles.textActionBtnIcon}>✏️</Text>
              <Text style={styles.textActionBtnText}>Edit Text</Text>
            </Pressable>

            <Pressable style={styles.textActionBtn} onPress={handleShareDocument}>
              <Text style={styles.textActionBtnIcon}>📤</Text>
              <Text style={styles.textActionBtnText}>Export / Share</Text>
            </Pressable>
          </View>
        )}
      </SectionCard>

      {/* Matched fields */}
      <SectionCard title={t('ocr.matchedFields')} icon="🎯">
        {ocrDone && (
          <View style={{ marginBottom: Spacing.sm, gap: Spacing.xs }}>
            <ActionBtn
              label={t('ocr.autoFillBtn')}
              onPress={handleAutoFillAll}
              variant="primary"
              small
            />

            {filledCount > 0 && (
              <Pressable style={styles.saveToVaultBtn} onPress={handleSaveExtractedToVault}>
                <Text style={styles.saveToVaultBtnText}>
                  💾 Save Extracted Details to My Profile Vault
                </Text>
              </Pressable>
            )}

            {filledCount > 0 && (
              <View style={styles.filledCountBadge}>
                <Text style={styles.filledCountText}>✓ {filledCount}/4 fields matched from profile</Text>
              </View>
            )}
          </View>
        )}

        {(Object.keys(fieldLabels) as PersonalFieldKey[]).map((key) => {
          const isFilled = Boolean(finalFilledFields[key]?.trim());
          return (
            <Pressable
              key={key}
              style={[styles.fieldRow, isFilled && styles.fieldRowFilled]}
              onPress={() => setSelectedField(key)}
              accessibilityRole="button"
            >
              <Text style={styles.fieldRowIcon}>{FIELD_ICONS[key]}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>{fieldLabels[key]}</Text>
                <Text style={[styles.fieldValue, !isFilled && styles.fieldValueEmpty]}>
                  {finalFilledFields[key] || t('common.empty')}
                </Text>
              </View>
              {isFilled ? (
                <View style={styles.filledBadge}><Text style={styles.filledBadgeText}>✓</Text></View>
              ) : (
                <Text style={styles.fieldHint}>{t('ocr.fieldHint')}</Text>
              )}
            </Pressable>
          );
        })}
      </SectionCard>

      {/* Voice assistant */}
      <SectionCard title={t('ocr.voiceAssistant')} icon="🎙️">
        {/* Listening pulse indicator */}
        {listening && (
          <View style={styles.listeningBanner}>
            <Animated.View style={[styles.listeningDot, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={styles.listeningText}>Listening... speak now</Text>
          </View>
        )}

        <ActionBtn label={t('ocr.listenPrompt')} onPress={handleSpeakPrompt} variant="secondary" small />

        {!listening ? (
          <ActionBtn
            label={t('ocr.startSpeaking')}
            onPress={handleStartFieldVoiceInput}
            disabled={!speechAvailable}
            variant="primary"
            small
          />
        ) : (
          <ActionBtn label={t('ocr.stopSpeaking')} onPress={stopListening} variant="ghost" small />
        )}

        <ActionBtn label={t('ocr.clearTranscript')} onPress={clearTranscript} variant="ghost" small />

        {/* Transcript display */}
        <View style={styles.transcriptBox}>
          <Text style={styles.transcriptLabel}>{t('ocr.transcriptLabel')}</Text>
          <Text style={styles.transcriptText}>{transcript || t('ocr.transcriptEmpty')}</Text>
        </View>

        {speechError ? (
          <Text style={styles.speechErrorText}>⚠️  {speechError}</Text>
        ) : null}
      </SectionCard>

      {/* Generate preview button */}
      <ActionBtn
        label={t('ocr.generatePreview')}
        onPress={handleGoToFilledPreview}
        disabled={!ocrText.trim() || loadingOCR}
      />

      {/* Edit Recognized Text Modal */}
      <Modal
        visible={editingText}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingText(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalIcon}>✏️</Text>
              <Text style={styles.modalTitle}>Edit Recognized Text</Text>
            </View>
            <Text style={styles.modalDescription}>
              Make any manual corrections if blurry text was misread.
            </Text>

            <TextInput
              style={styles.editTextInput}
              multiline
              value={editedTextValue}
              onChangeText={setEditedTextValue}
              textAlignVertical="top"
              placeholder="Document text..."
              placeholderTextColor={Colors.textMuted}
            />

            <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md }}>
              <Pressable
                style={[styles.modalBtn, { flex: 1, backgroundColor: Colors.bgElevated }]}
                onPress={() => setEditingText(false)}
              >
                <Text style={styles.modalBtnTextSecondary}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.modalBtn, { flex: 2, backgroundColor: Colors.primaryDark }]}
                onPress={handleSaveEditedText}
              >
                <Text style={styles.modalBtnTextPrimary}>Save Text 💾</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Field explanation modal */}
      <Modal
        visible={selectedField !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedField(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalIcon}>{selectedField ? FIELD_ICONS[selectedField] : ''}</Text>
              <Text style={styles.modalTitle}>{selectedField ? fieldLabels[selectedField] : ''}</Text>
            </View>

            <Text style={styles.modalDescription}>
              {selectedField ? getFieldExplanation(selectedField, language) : ''}
            </Text>

            {selectedField && finalFilledFields[selectedField] ? (
              <View style={styles.modalValueBlock}>
                <Text style={styles.modalValueLabel}>Current value:</Text>
                <Text style={styles.modalValue}>{finalFilledFields[selectedField]}</Text>
              </View>
            ) : null}

            <ActionBtn label={t('ocr.voiceExplain')} onPress={handleSpeakFieldExplanation} />
            <ActionBtn label={t('ocr.close')} onPress={() => setSelectedField(null)} variant="secondary" />
          </View>
        </View>
      </Modal>
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
  helperText: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: Spacing.md,
  },
  noImageBanner: {
    backgroundColor: Colors.warningBg,
    borderColor: Colors.warning,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  noImageText: {
    color: Colors.warningLight,
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
  },
  loadingBlock: {
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  loadingText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
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
  warningBlock: {
    backgroundColor: Colors.warningBg,
    borderColor: Colors.warning,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  warningTitle: {
    color: Colors.warning,
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    marginBottom: Spacing.xs,
  },
  warningText: {
    color: Colors.warningLight,
    fontSize: Typography.sm,
    lineHeight: 20,
    marginBottom: Spacing.xs,
  },
  confirmBadge: {
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
  },
  confirmBadgeYes: {
    backgroundColor: Colors.successBg,
    borderColor: Colors.success,
    borderWidth: 1,
  },
  confirmBadgeNo: {
    backgroundColor: Colors.dangerBg,
    borderColor: Colors.danger,
    borderWidth: 1,
  },
  confirmBadgeText: {
    color: Colors.textPrimary,
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    textAlign: 'center',
  },
  confidenceBlock: {
    marginBottom: Spacing.md,
  },
  confidenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  confidenceLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  confidenceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  confidenceTrack: {
    height: 5,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  ocrText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    lineHeight: 26,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  filledCountBadge: {
    backgroundColor: Colors.successBg,
    borderColor: Colors.success,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
  },
  filledCountText: {
    color: Colors.success,
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  fieldRowFilled: {
    borderColor: Colors.success,
    backgroundColor: Colors.successBg,
  },
  fieldRowIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  fieldLabel: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
    color: Colors.textSecondary,
  },
  fieldValue: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  fieldValueEmpty: {
    color: Colors.textMuted,
    fontStyle: 'italic',
    fontWeight: Typography.normal,
    fontSize: Typography.sm,
  },
  filledBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filledBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: Typography.bold,
  },
  fieldHint: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    maxWidth: 80,
    textAlign: 'right',
  },
  listeningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  listeningDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.danger,
  },
  listeningText: {
    fontSize: Typography.base,
    color: Colors.primaryLight,
    fontWeight: Typography.semibold,
  },
  transcriptBox: {
    backgroundColor: Colors.bgInput,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 70,
  },
  transcriptLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  transcriptText: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    lineHeight: 24,
  },
  speechErrorText: {
    fontSize: Typography.sm,
    color: Colors.dangerLight,
    marginTop: Spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.bgElevated,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    padding: Spacing.base,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  modalIcon: {
    fontSize: 28,
  },
  modalTitle: {
    fontSize: Typography['2xl'],
    fontWeight: Typography.extrabold,
    color: Colors.textPrimary,
  },
  modalDescription: {
    fontSize: Typography.md,
    lineHeight: 28,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  modalValueBlock: {
    backgroundColor: Colors.bgInput,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalValueLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  modalValue: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  documentPickerCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.base,
    ...Shadow.sm,
  },
  documentPickerTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  documentPickerSub: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  pickerBtnsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  pickerBtn: {
    flex: 1,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickerBtnIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  pickerBtnText: {
    fontSize: Typography.xs,
    color: Colors.textPrimary,
    fontWeight: Typography.bold,
  },
  scanningProgressCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    marginBottom: Spacing.md,
    ...Shadow.glow,
  },
  scanningProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  scanningProgressTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  scanningStepsList: {
    gap: Spacing.sm,
  },
  scanningStepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    opacity: 0.45,
  },
  scanningStepItemActive: {
    opacity: 1,
  },
  scanningStepIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.accent,
    color: Colors.accentLight,
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    textAlign: 'center',
    lineHeight: 20,
  },
  scanningStepText: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
  },
  scanningStepTextActive: {
    color: Colors.textPrimary,
    fontWeight: Typography.semibold,
  },
  docOverviewCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  docOverviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  docThumbnail: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    backgroundColor: '#050810',
  },
  docOverviewPdfBox: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docOverviewMeta: {
    flex: 1,
    gap: 4,
  },
  docOverviewTags: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  clarityBadge: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
  },
  clarityBadgeText: {
    color: Colors.primaryLight,
    fontSize: 11,
    fontWeight: Typography.bold,
  },
  accuracyBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  accuracyBadgeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: Typography.bold,
  },
  docStatsText: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  reScanBtn: {
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reScanBtnText: {
    color: Colors.textSecondary,
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
  },
  filterSwitcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  filterSwitcherLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: Typography.bold,
    textTransform: 'uppercase',
  },
  miniFilterChip: {
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  miniFilterChipActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryLight,
  },
  miniFilterChipText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: Typography.medium,
  },
  miniFilterChipTextActive: {
    color: Colors.white,
    fontWeight: Typography.bold,
  },
  ocrTextBox: {
    backgroundColor: '#070C18',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  textActionsBar: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  textActionBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textActionBtnIcon: {
    fontSize: 14,
  },
  textActionBtnText: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  saveToVaultBtn: {
    backgroundColor: Colors.bgElevated,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.accentDark,
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  saveToVaultBtnText: {
    color: Colors.accentLight,
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
  },
  editTextInput: {
    backgroundColor: Colors.bgInput,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    color: Colors.textPrimary,
    fontSize: Typography.base,
    lineHeight: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 180,
    maxHeight: 260,
  },
  modalBtn: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalBtnTextPrimary: {
    color: Colors.white,
    fontWeight: Typography.bold,
    fontSize: Typography.base,
  },
  modalBtnTextSecondary: {
    color: Colors.textMuted,
    fontWeight: Typography.semibold,
    fontSize: Typography.base,
  },
});

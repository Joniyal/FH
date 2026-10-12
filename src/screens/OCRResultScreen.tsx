import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { extractTextFromImage } from '../services/ocrService';
import { getPersonalVaultData } from '../services/storageService';
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

  const imageUri = route.params?.imageUri;

  const [loadingOCR, setLoadingOCR] = useState<boolean>(false);
  const [ocrText, setOcrText] = useState<string>('');
  const [ocrConfidence, setOcrConfidence] = useState<number>(0);
  const [ocrError, setOcrError] = useState<string>('');
  const [ocrDone, setOcrDone] = useState<boolean>(false);

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

  useEffect(() => {
    if (imageUri && !ocrDone && !loadingOCR && !ocrText) {
      handleRunOCR();
    }
  }, [imageUri]);

  const handleAutoFillAll = () => {
    const filled: Partial<Record<PersonalFieldKey, string>> = {};
    (['name', 'address', 'phone', 'dob'] as PersonalFieldKey[]).forEach((k) => {
      if (personalData[k]?.trim()) {
        filled[k] = personalData[k].trim();
      }
    });
    setVoiceFilledFields((prev) => ({ ...prev, ...filled }));
  };

  const handleRunOCR = async () => {
    if (loadingOCR) return;
    if (!imageUri) { setOcrError(t('ocr.errorSelectImage')); return; }

    setLoadingOCR(true);
    setOcrError('');
    setOcrDone(false);
    try {
      const result = await extractTextFromImage(imageUri);
      setOcrText(result.text);
      setOcrConfidence(result.confidence);
      setConfidenceConfirmed(null);
      setOcrDone(true);
    } catch (error) {
      setOcrError(error instanceof Error ? error.message : t('ocr.errorGeneric'));
    } finally {
      setLoadingOCR(false);
    }
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
    if (!imageUri) { setOcrError(t('ocr.errorPreviewNoImage')); return; }
    if (!ocrText.trim()) { setOcrError(t('ocr.errorPreviewNoText')); return; }
    navigation.navigate('FilledFormPreview', { imageUri, filledFields: finalFilledFields });
  };

  const getConfidenceColor = () => {
    if (ocrConfidence >= 85) return Colors.success;
    if (ocrConfidence >= OCR_CONFIDENCE_THRESHOLD) return Colors.warning;
    return Colors.danger;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.heading}>{t('ocr.heading')}</Text>
      <Text style={styles.helperText}>{t('ocr.helper')}</Text>

      {/* Run OCR button */}
      <ActionBtn
        label={loadingOCR ? '⏳  ' + t('ocr.reading') : '📘  ' + t('ocr.run')}
        onPress={handleRunOCR}
        disabled={loadingOCR || !imageUri}
      />

      {!imageUri && (
        <View style={styles.noImageBanner}>
          <Text style={styles.noImageText}>📷  No image selected. Go to Scan Form first.</Text>
        </View>
      )}

      {/* Loading indicator */}
      {loadingOCR ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>{t('ocr.reading')}</Text>
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

      {/* OCR Text result */}
      <SectionCard title={t('ocr.extractedText')} icon="📄">
        {/* Confidence meter */}
        {ocrConfidence > 0 && (
          <View style={styles.confidenceBlock}>
            <View style={styles.confidenceRow}>
              <Text style={styles.confidenceLabel}>{t('ocr.confidence', { confidence: ocrConfidence.toFixed(1) })}</Text>
              <View style={[styles.confidenceDot, { backgroundColor: getConfidenceColor() }]} />
            </View>
            <View style={styles.confidenceTrack}>
              <View style={[styles.confidenceFill, { width: `${ocrConfidence}%` as any, backgroundColor: getConfidenceColor() }]} />
            </View>
          </View>
        )}
        <Text style={styles.ocrText}>{ocrText || t('ocr.emptyResult')}</Text>
      </SectionCard>

      {/* Matched fields */}
      <SectionCard title={t('ocr.matchedFields')} icon="🎯">
        {ocrDone && (
          <View style={{ marginBottom: Spacing.sm }}>
            <ActionBtn
              label={t('ocr.autoFillBtn')}
              onPress={handleAutoFillAll}
              variant="primary"
              small
            />
            {filledCount > 0 && (
              <View style={styles.filledCountBadge}>
                <Text style={styles.filledCountText}>✓ {filledCount}/4 fields auto-filled from your profile</Text>
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
              {isFilled
                ? <View style={styles.filledBadge}><Text style={styles.filledBadgeText}>✓</Text></View>
                : <Text style={styles.fieldHint}>{t('ocr.fieldHint')}</Text>
              }
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
});

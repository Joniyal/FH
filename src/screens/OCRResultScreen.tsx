import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

type Props = NativeStackScreenProps<RootStackParamList, 'OCRResult'>;

const OCR_CONFIDENCE_THRESHOLD = 70;

type VoiceMode = 'field' | 'confidence' | null;

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

  const [personalData, setPersonalData] = useState<PersonalVaultData>({
    name: '',
    address: '',
    phone: '',
    dob: '',
  });

  const [voiceFilledFields, setVoiceFilledFields] = useState<
    Partial<Record<PersonalFieldKey, string>>
  >({});
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(null);

  const [selectedField, setSelectedField] = useState<PersonalFieldKey | null>(null);
  const [confidenceConfirmed, setConfidenceConfirmed] = useState<boolean | null>(null);
  const [speechAvailable, setSpeechAvailable] = useState<boolean>(true);
  const [speechServiceName, setSpeechServiceName] = useState<string>('');

  const {
    transcript,
    listening,
    error: speechError,
    startListening,
    stopListening,
    clearTranscript,
  } = useSpeechToText(recognitionLanguage);

  // Load personal vault data for auto-fill mapping.
  useEffect(() => {
    getPersonalVaultData()
      .then(setPersonalData)
      .catch((error) => {
        const message = error instanceof Error ? error.message : t('vault.errorRead');
        setOcrError(message);
      });
  }, [t]);

  // Detect speech recognizer availability and default service information.
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

  // Run OCR extraction for the selected image.
  const handleRunOCR = async () => {
    if (loadingOCR) {
      return;
    }

    if (!imageUri) {
      setOcrError(t('ocr.errorSelectImage'));
      return;
    }

    setLoadingOCR(true);
    setOcrError('');
    try {
      const result = await extractTextFromImage(imageUri);
      setOcrText(result.text);
      setOcrConfidence(result.confidence);
      setConfidenceConfirmed(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('ocr.errorGeneric');
      setOcrError(message);
    } finally {
      setLoadingOCR(false);
    }
  };

  // Create mapping between OCR labels and stored vault values.
  const matchResult: MatchResult = useMemo(() => {
    if (!ocrText) {
      return {
        matchedFields: {},
        requiredFields: [],
      };
    }
    return matchFormFields(ocrText, personalData);
  }, [ocrText, personalData]);

  // Final merged fields: vault-matched values + speech-filled values.
  const finalFilledFields = useMemo(
    () => ({
      ...matchResult.matchedFields,
      ...voiceFilledFields,
    }),
    [matchResult.matchedFields, voiceFilledFields]
  );

  // Determine which required fields are still missing.
  const pendingRequiredFields = useMemo(
    () =>
      matchResult.requiredFields.filter((key) => {
        const value = finalFilledFields[key]?.trim();
        return !value;
      }),
    [finalFilledFields, matchResult.requiredFields]
  );

  // Fill the first missing required field using voice transcript.
  useEffect(() => {
    if (!transcript.trim()) {
      return;
    }

    if (voiceMode === 'confidence') {
      const normalized = transcript.trim().toLowerCase();
      const isYes =
        normalized.includes('അതെ') ||
        normalized.includes('ശരി') ||
        normalized.includes('yes') ||
        normalized.includes('ok');
      const isNo =
        normalized.includes('ഇല്ല') ||
        normalized.includes('വേണ്ട') ||
        normalized.includes('no');

      if (isYes) {
        setConfidenceConfirmed(true);
      } else if (isNo) {
        setConfidenceConfirmed(false);
      }

      setVoiceMode(null);
      return;
    }

    if (voiceMode !== 'field') {
      return;
    }

    const missingField = pendingRequiredFields[0];
    if (!missingField) {
      return;
    }

    setVoiceFilledFields((prev) => ({
      ...prev,
      [missingField]: transcript.trim(),
    }));
    setVoiceMode(null);
  }, [pendingRequiredFields, transcript, voiceMode]);

  const isLowConfidence = ocrConfidence > 0 && ocrConfidence < OCR_CONFIDENCE_THRESHOLD;

  const handleSpeakPrompt = () => {
    const field = pendingRequiredFields[0] ?? 'name';
    const prompt = getFieldPrompt(field, language);
    speakText(prompt, speechLanguage);
  };

  const handleStartFieldVoiceInput = async () => {
    if (!speechAvailable) {
      setOcrError(t('ocr.errorSpeechUnavailable'));
      return;
    }

    setVoiceMode('field');
    clearTranscript();
    const started = await startListening();
    if (!started) {
      setVoiceMode(null);
    }
  };

  const handleAskConfidenceByVoice = () => {
    speakText(t('ocr.confirmQuestion'), speechLanguage);
  };

  const handleStartConfidenceConfirmation = async () => {
    if (!speechAvailable) {
      setOcrError(t('ocr.errorSpeechUnavailable'));
      return;
    }

    setVoiceMode('confidence');
    clearTranscript();
    const started = await startListening();
    if (!started) {
      setVoiceMode(null);
    }
  };

  const handleSpeakFieldExplanation = () => {
    if (!selectedField) {
      return;
    }

    speakText(getFieldSpeechExplanation(selectedField, language), speechLanguage);
  };

  const handleGoToFilledPreview = () => {
    if (!imageUri) {
      setOcrError(t('ocr.errorPreviewNoImage'));
      return;
    }

    if (!ocrText.trim()) {
      setOcrError(t('ocr.errorPreviewNoText'));
      return;
    }

    navigation.navigate('FilledFormPreview', {
      imageUri,
      filledFields: finalFilledFields,
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.heading}>{t('ocr.heading')}</Text>
      <Text style={styles.helperText}>{t('ocr.helper')}</Text>

      <Pressable
        style={[styles.primaryButton, loadingOCR && styles.buttonDisabled]}
        onPress={handleRunOCR}
        disabled={loadingOCR}
      >
        <Text style={styles.primaryButtonText}>{t('ocr.run')}</Text>
      </Pressable>

      {!speechAvailable ? (
        <View style={styles.warningBlock}>
          <Text style={styles.warningTitle}>{t('ocr.speechUnavailableTitle')}</Text>
          <Text style={styles.warningText}>{t('ocr.speechUnavailableText')}</Text>
          {speechServiceName ? (
            <Text style={styles.warningText}>Service: {speechServiceName}</Text>
          ) : null}
        </View>
      ) : null}

      {/* Confidence check for unclear OCR results */}
      {isLowConfidence ? (
        <View style={styles.warningBlock}>
          <Text style={styles.warningTitle}>{t('ocr.lowConfidenceTitle')}</Text>
          <Text style={styles.warningText}>
            {t('ocr.lowConfidenceText', { confidence: ocrConfidence.toFixed(1) })}
          </Text>

          <Pressable style={styles.secondaryButton} onPress={handleAskConfidenceByVoice}>
            <Text style={styles.secondaryButtonText}>{t('ocr.listenQuestion')}</Text>
          </Pressable>

          <Pressable style={styles.primaryButton} onPress={handleStartConfidenceConfirmation}>
            <Text style={styles.primaryButtonText}>{t('ocr.sayYesNo')}</Text>
          </Pressable>

          {confidenceConfirmed !== null ? (
            <Text style={styles.confirmStatusText}>
              {confidenceConfirmed ? t('ocr.confirmedYes') : t('ocr.confirmedNo')}
            </Text>
          ) : null}
        </View>
      ) : null}

      {loadingOCR ? (
        <View style={styles.block}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.text}>{t('ocr.reading')}</Text>
        </View>
      ) : null}

      {ocrError ? (
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>{ocrError}</Text>
        </View>
      ) : null}

      {/* OCR output section */}
      <View style={styles.block}>
        <Text style={styles.sectionTitle}>{t('ocr.extractedText')}</Text>
        <Text style={styles.confidenceText}>
          {t('ocr.confidence', { confidence: ocrConfidence.toFixed(1) })}
        </Text>
        <Text style={styles.ocrText}>{ocrText || t('ocr.emptyResult')}</Text>
      </View>

      {/* Field matching section */}
      <View style={styles.block}>
        <Text style={styles.sectionTitle}>{t('ocr.matchedFields')}</Text>
        {(Object.keys(fieldLabels) as PersonalFieldKey[]).map((key) => (
          <Pressable
            key={key}
            style={styles.fieldRow}
            onPress={() => setSelectedField(key)}
            accessibilityRole="button"
          >
            <Text style={styles.fieldLabel}>{fieldLabels[key]}</Text>
            <Text style={styles.fieldValue}>{finalFilledFields[key] || t('common.empty')}</Text>
            <Text style={styles.fieldHint}>{t('ocr.fieldHint')}</Text>
          </Pressable>
        ))}
      </View>

      {/* Voice assistant section */}
      <View style={styles.block}>
        <Text style={styles.sectionTitle}>{t('ocr.voiceAssistant')}</Text>

        <Pressable style={styles.secondaryButton} onPress={handleSpeakPrompt}>
          <Text style={styles.secondaryButtonText}>{t('ocr.listenPrompt')}</Text>
        </Pressable>

        {!listening ? (
          <Pressable
            style={[styles.primaryButton, !speechAvailable && styles.buttonDisabled]}
            onPress={handleStartFieldVoiceInput}
            disabled={!speechAvailable}
          >
            <Text style={styles.primaryButtonText}>{t('ocr.startSpeaking')}</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.secondaryButton} onPress={stopListening}>
            <Text style={styles.secondaryButtonText}>{t('ocr.stopSpeaking')}</Text>
          </Pressable>
        )}

        <Pressable style={styles.clearButton} onPress={clearTranscript}>
          <Text style={styles.clearButtonText}>{t('ocr.clearTranscript')}</Text>
        </Pressable>

        <Text style={styles.transcriptLabel}>{t('ocr.transcriptLabel')}</Text>
        <Text style={styles.transcriptText}>{transcript || t('ocr.transcriptEmpty')}</Text>

        {speechError ? <Text style={styles.errorText}>{speechError}</Text> : null}
      </View>

      {/* Step 5 output generation trigger */}
      <Pressable
        style={[styles.primaryButton, (!ocrText.trim() || loadingOCR) && styles.buttonDisabled]}
        onPress={handleGoToFilledPreview}
        disabled={!ocrText.trim() || loadingOCR}
      >
        <Text style={styles.primaryButtonText}>{t('ocr.generatePreview')}</Text>
      </Pressable>

      {/* Explain Field modal */}
      <Modal
        visible={selectedField !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedField(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {selectedField ? fieldLabels[selectedField] : ''}
            </Text>

            <Text style={styles.modalDescription}>
              {selectedField ? getFieldExplanation(selectedField, language) : ''}
            </Text>

            <Pressable style={styles.primaryButton} onPress={handleSpeakFieldExplanation}>
              <Text style={styles.primaryButtonText}>{t('ocr.voiceExplain')}</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => setSelectedField(null)}
            >
              <Text style={styles.secondaryButtonText}>{t('ocr.close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 32,
  },
  heading: {
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 6,
  },
  helperText: {
    fontSize: 18,
    color: '#334155',
    lineHeight: 26,
    marginBottom: 10,
  },
  block: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
  },
  errorBlock: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  warningBlock: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  warningTitle: {
    color: '#92400E',
    fontSize: 21,
    fontWeight: '700',
    marginBottom: 6,
  },
  warningText: {
    color: '#78350F',
    fontSize: 17,
    lineHeight: 24,
    marginBottom: 10,
  },
  confirmStatusText: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '700',
    color: '#78350F',
  },
  errorText: {
    color: '#991B1B',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    color: '#0F172A',
  },
  confidenceText: {
    fontSize: 16,
    color: '#334155',
    marginBottom: 8,
  },
  ocrText: {
    fontSize: 18,
    color: '#0F172A',
    lineHeight: 28,
  },
  fieldRow: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#334155',
  },
  fieldValue: {
    fontSize: 22,
    fontWeight: '600',
    color: '#111827',
  },
  fieldHint: {
    marginTop: 4,
    fontSize: 14,
    color: '#64748B',
  },
  primaryButton: {
    backgroundColor: '#1D4ED8',
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 10,
  },
  secondaryButtonText: {
    color: '#0F172A',
    textAlign: 'center',
    fontSize: 21,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  clearButtonText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#334155',
    fontWeight: '600',
  },
  transcriptLabel: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
    color: '#334155',
  },
  transcriptText: {
    fontSize: 20,
    color: '#111827',
    lineHeight: 30,
    marginBottom: 8,
  },
  text: {
    marginTop: 10,
    fontSize: 18,
    lineHeight: 26,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 20,
    lineHeight: 30,
    color: '#334155',
    marginBottom: 12,
  },
});

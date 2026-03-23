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
  getFieldExplanation,
  getMalayalamFieldExplanation,
  getMalayalamFieldPrompt,
  matchFormFields,
} from '../utils/fieldMatcher';
import { speakMalayalam } from '../services/speechService';
import { useSpeechToText } from '../hooks/useSpeechToText';

type Props = NativeStackScreenProps<RootStackParamList, 'OCRResult'>;

const FIELD_LABELS: Record<PersonalFieldKey, string> = {
  name: 'പേര്',
  address: 'വിലാസം',
  phone: 'ഫോൺ',
  dob: 'ജനനത്തീയതി',
};

const OCR_CONFIDENCE_THRESHOLD = 70;

type VoiceMode = 'field' | 'confidence' | null;

export default function OCRResultScreen({ route, navigation }: Props) {
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
  } = useSpeechToText('ml-IN');

  // Load personal vault data for auto-fill mapping.
  useEffect(() => {
    getPersonalVaultData().then(setPersonalData);
  }, []);

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
      setOcrError('ആദ്യം ഫോം സ്കാൻ സ്ക്രീനിൽ നിന്ന് ഒരു ചിത്രം തിരഞ്ഞെടുക്കുക.');
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
      const message =
        error instanceof Error ? error.message : 'OCR പ്രവർത്തനത്തിൽ പിശക് സംഭവിച്ചു.';
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
    const prompt = getMalayalamFieldPrompt(field);
    speakMalayalam(prompt);
  };

  const handleStartFieldVoiceInput = async () => {
    if (!speechAvailable) {
      setOcrError('ഈ ഫോണിൽ ശബ്ദം തിരിച്ചറിയൽ സേവനം ലഭ്യമല്ല.');
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
    speakMalayalam('OCR വ്യക്തത കുറവാണ്. ഇത് ശരിയാണോ? അതെ അല്ലെങ്കിൽ ഇല്ല എന്ന് പറയൂ');
  };

  const handleStartConfidenceConfirmation = async () => {
    if (!speechAvailable) {
      setOcrError('ഈ ഫോണിൽ ശബ്ദം തിരിച്ചറിയൽ സേവനം ലഭ്യമല്ല.');
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

    speakMalayalam(getMalayalamFieldExplanation(selectedField));
  };

  const handleGoToFilledPreview = () => {
    if (!imageUri) {
      setOcrError('പ്രിവ്യൂ കാണാൻ ആദ്യം ഫോം സ്കാൻ സ്ക്രീനിൽ നിന്ന് ചിത്രം തിരഞ്ഞെടുക്കുക.');
      return;
    }

    if (!ocrText.trim()) {
      setOcrError('ആദ്യം OCR ടെക്സ്റ്റ് എടുക്കുക, ശേഷം പ്രിവ്യൂ സൃഷ്ടിക്കുക.');
      return;
    }

    navigation.navigate('FilledFormPreview', {
      imageUri,
      filledFields: finalFilledFields,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.heading}>🧾 OCR ഫലം</Text>
      <Text style={styles.helperText}>ആദ്യം OCR എടുക്കുക. ശേഷം മാച്ച് ചെയ്ത ഫീൽഡുകൾ പരിശോധിക്കുക.</Text>

      <Pressable
        style={[styles.primaryButton, loadingOCR && styles.buttonDisabled]}
        onPress={handleRunOCR}
        disabled={loadingOCR}
      >
        <Text style={styles.primaryButtonText}>📘 OCR ടെക്സ്റ്റ് എടുക്കുക</Text>
      </Pressable>

      {!speechAvailable ? (
        <View style={styles.warningBlock}>
          <Text style={styles.warningTitle}>🎤 ശബ്ദ സേവനം ലഭ്യമല്ല</Text>
          <Text style={styles.warningText}>
            ശബ്ദ ഇൻപുട്ട് ഉപയോഗിക്കാൻ ഫോണിൽ ശബ്ദം തിരിച്ചറിയൽ സേവനം വേണം.
          </Text>
          {speechServiceName ? (
            <Text style={styles.warningText}>സേവനം: {speechServiceName}</Text>
          ) : null}
        </View>
      ) : null}

      {/* Confidence check for unclear OCR results */}
      {isLowConfidence ? (
        <View style={styles.warningBlock}>
          <Text style={styles.warningTitle}>⚠️ OCR വ്യക്തത കുറവാണ്</Text>
          <Text style={styles.warningText}>
            വിശ്വാസ്യത {ocrConfidence.toFixed(1)}% ആണ്. ദയവായി ശബ്ദം ഉപയോഗിച്ച് സ്ഥിരീകരിക്കുക.
          </Text>

          <Pressable style={styles.secondaryButton} onPress={handleAskConfidenceByVoice}>
            <Text style={styles.secondaryButtonText}>🔊 സ്ഥിരീകരണ ചോദ്യം കേൾക്കുക</Text>
          </Pressable>

          <Pressable style={styles.primaryButton} onPress={handleStartConfidenceConfirmation}>
            <Text style={styles.primaryButtonText}>🎤 അതെ / ഇല്ല പറയുക</Text>
          </Pressable>

          {confidenceConfirmed !== null ? (
            <Text style={styles.confirmStatusText}>
              {confidenceConfirmed
                ? '✅ ഉപയോക്താവ് സ്ഥിരീകരിച്ചു'
                : '❌ ഉപയോക്താവ് വീണ്ടും പരിശോധിക്കാൻ പറഞ്ഞു'}
            </Text>
          ) : null}
        </View>
      ) : null}

      {loadingOCR ? (
        <View style={styles.block}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.text}>ടെക്സ്റ്റ് വായിക്കുന്നു...</Text>
        </View>
      ) : null}

      {ocrError ? (
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>{ocrError}</Text>
        </View>
      ) : null}

      {/* OCR output section */}
      <View style={styles.block}>
        <Text style={styles.sectionTitle}>എടുത്തെടുത്ത എഴുത്ത്</Text>
        <Text style={styles.confidenceText}>വിശ്വാസ്യത: {ocrConfidence.toFixed(1)}%</Text>
        <Text style={styles.ocrText}>{ocrText || 'OCR ഫലം ഇവിടെ കാണിക്കും.'}</Text>
      </View>

      {/* Field matching section */}
      <View style={styles.block}>
        <Text style={styles.sectionTitle}>മാച്ച് ചെയ്ത ഫീൽഡുകൾ</Text>
        {(Object.keys(FIELD_LABELS) as PersonalFieldKey[]).map((key) => (
          <Pressable
            key={key}
            style={styles.fieldRow}
            onPress={() => setSelectedField(key)}
            accessibilityRole="button"
          >
            <Text style={styles.fieldLabel}>{FIELD_LABELS[key]}</Text>
            <Text style={styles.fieldValue}>{finalFilledFields[key] || '---'}</Text>
            <Text style={styles.fieldHint}>ഫീൽഡിന്റെ അർത്ഥം അറിയാൻ ഇവിടെ അമർത്തുക</Text>
          </Pressable>
        ))}
      </View>

      {/* Voice assistant section */}
      <View style={styles.block}>
        <Text style={styles.sectionTitle}>ശബ്ദ സഹായി (മലയാളം)</Text>

        <Pressable style={styles.secondaryButton} onPress={handleSpeakPrompt}>
          <Text style={styles.secondaryButtonText}>🔊 നിർദ്ദേശം കേൾക്കുക</Text>
        </Pressable>

        {!listening ? (
          <Pressable
            style={[styles.primaryButton, !speechAvailable && styles.buttonDisabled]}
            onPress={handleStartFieldVoiceInput}
            disabled={!speechAvailable}
          >
            <Text style={styles.primaryButtonText}>🎤 പറയാൻ തുടങ്ങുക</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.secondaryButton} onPress={stopListening}>
            <Text style={styles.secondaryButtonText}>⏹️ ശബ്ദ ഇൻപുട്ട് നിർത്തുക</Text>
          </Pressable>
        )}

        <Pressable style={styles.clearButton} onPress={clearTranscript}>
          <Text style={styles.clearButtonText}>ട്രാൻസ്ക്രിപ്റ്റ് മായ്ക്കുക</Text>
        </Pressable>

        <Text style={styles.transcriptLabel}>ശബ്ദ ട്രാൻസ്ക്രിപ്റ്റ്:</Text>
        <Text style={styles.transcriptText}>{transcript || 'ഇവിടെ ശബ്ദ ഇൻപുട്ട് കാണിക്കും.'}</Text>

        {speechError ? <Text style={styles.errorText}>{speechError}</Text> : null}
      </View>

      {/* Step 5 output generation trigger */}
      <Pressable
        style={[styles.primaryButton, (!ocrText.trim() || loadingOCR) && styles.buttonDisabled]}
        onPress={handleGoToFilledPreview}
        disabled={!ocrText.trim() || loadingOCR}
      >
        <Text style={styles.primaryButtonText}>✅ പൂരിപ്പിച്ച ഫോം പ്രിവ്യൂ സൃഷ്ടിക്കുക</Text>
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
              {selectedField ? FIELD_LABELS[selectedField] : ''}
            </Text>

            <Text style={styles.modalDescription}>
              {selectedField ? getFieldExplanation(selectedField) : ''}
            </Text>

            <Pressable style={styles.primaryButton} onPress={handleSpeakFieldExplanation}>
              <Text style={styles.primaryButtonText}>🔊 ശബ്ദത്തിൽ വിശദീകരിക്കുക</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => setSelectedField(null)}
            >
              <Text style={styles.secondaryButtonText}>അടയ്ക്കുക</Text>
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

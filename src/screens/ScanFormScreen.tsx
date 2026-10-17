import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
// Safely resolve native DocumentScanner module in runtime / test environments
let DocumentScanner: any = null;
try {
  const mod = require('react-native-mlkit-document-scanner');
  DocumentScanner = mod?.default ?? mod;
} catch {
  // Handled gracefully in test / dev environments
}
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { useLanguage } from '../i18n/LanguageContext';
import Colors from '../theme/colors';
import { Radius, Shadow, Spacing, Typography } from '../theme/tokens';
import { useToast } from '../components/Toast';
import { extractTextFromImage, OCRResultData } from '../services/ocrService';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanForm'>;

/**
 * REFACTORED SCAN FORM SCREEN:
 * 
 * 1. REMOVED OLD CUSTOM IMPLEMENTATION:
 *    - Deleted custom 8-point magnetic crop handles (4 corners + 4 edge pills).
 *    - Deleted custom aspect ratio presets (Fit A4, ID Card, Receipt, No Crop).
 *    - Deleted manual software image sharpening filters (Magic Color, Ultra Crisp Text, Clean B&W).
 *    - Deleted custom camera overlay viewfinders and manual gesture drag responders.
 * 
 * 2. INTEGRATED GOOGLE ML KIT DOCUMENT SCANNER:
 *    - Calls `DocumentScanner.scanDocument()` with:
 *        `scannerMode: 'full'` (handles perspective correction, shadow removal, and contrast filters natively)
 *        `letUserAdjustCrop: true` (lets users adjust edges using Google's native ML Kit crop UI)
 *        `format: 'jpeg'`
 *    - When scanned images are returned, passes the first image URI directly to
 *      `extractTextFromImage(firstImageUri)` in `ocrService.ts`.
 *    - Seamlessly navigates to OCRResultScreen with extracted data.
 */
export default function ScanFormScreen({ navigation }: Props) {
  const { t, language } = useLanguage();
  const { width: windowWidth } = useWindowDimensions();
  const { showToast } = useToast();

  const previewWidth = Math.min(windowWidth - Spacing.base * 2, 420);
  const previewHeight = Math.round(previewWidth * 1.35);

  const [selectedImageUri, setSelectedImageUri] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [screenError, setScreenError] = useState<string>('');
  const [showSettingsButton, setShowSettingsButton] = useState<boolean>(false);
  const [lastOcrResult, setLastOcrResult] = useState<OCRResultData | null>(null);

  /**
   * STEP 2: NATIVE GOOGLE ML KIT DOCUMENT SCANNER TRIGGER
   * Launches Google's native ML Kit Document Scanner activity.
   */
  const handleScanDocument = useCallback(async () => {
    try {
      setScreenError('');
      setIsScanning(true);

      if (!DocumentScanner || typeof DocumentScanner.scanDocument !== 'function') {
        throw new Error('Google ML Kit DocumentScanner native module is not initialized or linked.');
      }

      // Trigger ML Kit Native Document Scanner
      const result = await DocumentScanner.scanDocument({
        scannerMode: 'full',
        letUserAdjustCrop: true,
        format: 'jpeg',
      });

      if (result?.scannedImages && result.scannedImages.length > 0) {
        const firstImageUri = result.scannedImages[0];
        setSelectedImageUri(firstImageUri);
        setFileName('Scanned_Document.jpg');

        showToast('Document scanned with Google ML Kit! 📄', 'success');

        // Pass first image URI directly to extractTextFromImage in ocrService
        setIsProcessing(true);
        const ocrData = await extractTextFromImage(firstImageUri);
        setIsProcessing(false);
        setLastOcrResult(ocrData);

        // Seamlessly navigate to OCR & Auto-Fill screen
        navigation.navigate('OCRResult', {
          imageUri: firstImageUri,
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to launch Google ML Kit scanner';
      // Do not display an aggressive error if user simply tapped back/cancelled
      if (!errorMsg.toLowerCase().includes('cancel') && !errorMsg.toLowerCase().includes('user canceled')) {
        setScreenError(errorMsg);
        showToast(errorMsg, 'error');
      }
    } finally {
      setIsScanning(false);
      setIsProcessing(false);
    }
  }, [navigation, showToast]);

  /**
   * Pick document or form image from device gallery
   */
  const handlePickFromGallery = useCallback(async () => {
    try {
      setScreenError('');
      setShowSettingsButton(false);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        if (!permission.canAskAgain) {
          setScreenError(t('scan.errorGallerySettings'));
          setShowSettingsButton(true);
        } else {
          setScreenError(t('scan.errorGalleryDenied'));
        }
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        const asset = result.assets[0];
        setSelectedImageUri(asset.uri);
        setFileName(asset.fileName || 'Gallery_Image.jpg');

        setIsProcessing(true);
        const ocrData = await extractTextFromImage(asset.uri);
        setIsProcessing(false);
        setLastOcrResult(ocrData);

        navigation.navigate('OCRResult', {
          imageUri: asset.uri,
        });
      }
    } catch (e) {
      setScreenError(e instanceof Error ? e.message : t('scan.errorGallery'));
    } finally {
      setIsProcessing(false);
    }
  }, [navigation, showToast, t]);

  /**
   * Upload existing PDF form document
   */
  const handlePickDocument = useCallback(async () => {
    try {
      setScreenError('');
      const doc = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!doc.canceled && doc.assets && doc.assets[0]) {
        const file = doc.assets[0];
        setSelectedImageUri(file.uri);
        setFileName(file.name);

        setIsProcessing(true);
        const ocrData = await extractTextFromImage(file.uri, { filename: file.name });
        setIsProcessing(false);
        setLastOcrResult(ocrData);

        navigation.navigate('OCRResult', {
          imageUri: file.uri,
        });
      }
    } catch (e) {
      setScreenError(e instanceof Error ? e.message : 'Failed to pick document');
    } finally {
      setIsProcessing(false);
    }
  }, [navigation]);

  const handleProceedToOCR = useCallback(() => {
    if (!selectedImageUri) return;
    navigation.navigate('OCRResult', {
      imageUri: selectedImageUri,
    });
  }, [navigation, selectedImageUri]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.title}>{t('scan.title')}</Text>
        <View style={styles.mlkitPill}>
          <Text style={styles.mlkitPillText}>ML Kit</Text>
        </View>
      </View>

      {/* Screen Error Display */}
      {screenError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{screenError}</Text>
          {showSettingsButton && (
            <Pressable
              style={styles.settingsButton}
              onPress={() => Linking.openSettings()}
            >
              <Text style={styles.settingsButtonText}>{t('scan.openSettings')}</Text>
            </Pressable>
          )}
        </View>
      ) : null}

      {/* Main Scanner Section */}
      {selectedImageUri ? (
        /* Scanned Document Preview & Review */
        <View style={styles.previewContainer}>
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View style={styles.previewStatusTag}>
                <Text style={styles.previewStatusIcon}>⚡</Text>
                <Text style={styles.previewStatusText}>Google ML Kit Scanned</Text>
              </View>
              <Text style={styles.previewFileName} numberOfLines={1}>
                {fileName}
              </Text>
            </View>

            <View style={[styles.imageWrapper, { width: previewWidth, height: previewHeight }]}>
              {fileName.toLowerCase().endsWith('.pdf') ? (
                <View style={styles.pdfPlaceholder}>
                  <Text style={{ fontSize: 56 }}>📄</Text>
                  <Text style={styles.pdfFileName}>{fileName}</Text>
                  <Text style={styles.pdfSubtext}>PDF Document Loaded</Text>
                </View>
              ) : (
                <Image
                  source={{ uri: selectedImageUri }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              )}

              {isProcessing && (
                <View style={styles.processingOverlay}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={styles.processingText}>Processing with ML Kit Text Recognition...</Text>
                </View>
              )}
            </View>

            {/* Extracted Data Summary (If Available) */}
            {lastOcrResult?.parsedData && (
              <View style={styles.parsedDataSummary}>
                <Text style={styles.parsedDataTitle}>Detected Fields from Document:</Text>
                <View style={styles.parsedDataChips}>
                  {lastOcrResult.parsedData.name && (
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>🪪 {lastOcrResult.parsedData.name}</Text>
                    </View>
                  )}
                  {lastOcrResult.parsedData.dob && (
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>🎂 {lastOcrResult.parsedData.dob}</Text>
                    </View>
                  )}
                  {lastOcrResult.parsedData.phone && (
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>📱 {lastOcrResult.parsedData.phone}</Text>
                    </View>
                  )}
                  {lastOcrResult.parsedData.address && (
                    <View style={styles.chip}>
                      <Text style={styles.chipText} numberOfLines={1}>
                        🏠 {lastOcrResult.parsedData.address}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Primary Action Buttons */}
            <View style={styles.actionButtonsRow}>
              <Pressable
                style={[styles.primaryActionBtn, isProcessing && styles.btnDisabled]}
                onPress={handleProceedToOCR}
                disabled={isProcessing}
              >
                <Text style={styles.primaryActionBtnText}>
                  ⚡ Continue to OCR & Auto-Fill ➔
                </Text>
              </Pressable>

              <Pressable
                style={styles.secondaryActionBtn}
                onPress={handleScanDocument}
                disabled={isScanning || isProcessing}
              >
                <Text style={styles.secondaryActionBtnText}>↺ Scan Again (ML Kit)</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        /* Launch Document Scanner Hero Card */
        <View style={styles.heroCard}>
          <View style={styles.heroIconBadge}>
            <Text style={styles.heroBadgeEmoji}>📑</Text>
          </View>

          <Text style={styles.heroTitle}>Native Document Scanner</Text>
          <Text style={styles.heroSubtitle}>
            Powered by Google ML Kit with on-device edge detection, auto-crop perspective correction,
            and high-precision text recognition.
          </Text>

          {/* Feature Highlights */}
          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Text style={styles.featureDot}>✓</Text>
              <Text style={styles.featureText}>Automatic document edge detection & perspective alignment</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureDot}>✓</Text>
              <Text style={styles.featureText}>Native lighting & shadow removal with full color filters</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureDot}>✓</Text>
              <Text style={styles.featureText}>100% On-device offline text recognition & bounding boxes</Text>
            </View>
          </View>

          {/* Launch Scanner Trigger */}
          <Pressable
            style={[styles.scanLaunchBtn, isScanning && styles.btnDisabled]}
            onPress={handleScanDocument}
            disabled={isScanning}
          >
            {isScanning ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Text style={styles.scanLaunchBtnIcon}>📷</Text>
                <Text style={styles.scanLaunchBtnText}>Scan Document (ML Kit)</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {/* Alternative Input Sources */}
      <View style={styles.alternativeCard}>
        <Text style={styles.alternativeTitle}>Other Document Sources</Text>
        <View style={styles.alternativeButtons}>
          <Pressable style={styles.altBtn} onPress={handlePickFromGallery}>
            <Text style={styles.altBtnIcon}>🖼️</Text>
            <Text style={styles.altBtnText}>{t('scan.fromGallery')}</Text>
          </Pressable>

          <Pressable style={styles.altBtn} onPress={handlePickDocument}>
            <Text style={styles.altBtnIcon}>📁</Text>
            <Text style={styles.altBtnText}>Upload PDF / Form</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#070C18',
  },
  container: {
    padding: Spacing.base,
    paddingBottom: Spacing.xl * 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.md,
  },
  backIcon: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: Typography.bold,
  },
  title: {
    flex: 1,
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  mlkitPill: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.4)',
  },
  mlkitPillText: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: Typography.bold,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  errorIcon: {
    fontSize: 18,
  },
  errorText: {
    flex: 1,
    color: Colors.danger,
    fontSize: Typography.xs,
    fontWeight: Typography.medium,
  },
  settingsButton: {
    backgroundColor: Colors.danger,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  settingsButtonText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: Typography.bold,
  },
  heroCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadow.md,
  },
  heroIconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  heroBadgeEmoji: {
    fontSize: 32,
  },
  heroTitle: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },
  featuresList: {
    width: '100%',
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  featureDot: {
    color: Colors.success,
    fontSize: 14,
    fontWeight: Typography.bold,
  },
  featureText: {
    color: Colors.textSecondary,
    fontSize: Typography.xs,
    flex: 1,
  },
  scanLaunchBtn: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md + 2,
    gap: Spacing.sm,
    ...Shadow.lg,
  },
  scanLaunchBtnIcon: {
    fontSize: 20,
  },
  scanLaunchBtnText: {
    color: Colors.white,
    fontSize: Typography.base,
    fontWeight: Typography.bold,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  previewContainer: {
    marginBottom: Spacing.lg,
  },
  previewCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  previewStatusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    gap: 4,
  },
  previewStatusIcon: {
    fontSize: 12,
  },
  previewStatusText: {
    color: Colors.success,
    fontSize: 11,
    fontWeight: Typography.bold,
  },
  previewFileName: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
    maxWidth: 160,
  },
  imageWrapper: {
    alignSelf: 'center',
    borderRadius: Radius.lg,
    backgroundColor: '#030712',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  pdfPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  pdfFileName: {
    color: Colors.textPrimary,
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
    marginTop: Spacing.sm,
  },
  pdfSubtext: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
    marginTop: 4,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 7, 18, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  processingText: {
    color: Colors.textPrimary,
    fontSize: Typography.xs,
    fontWeight: Typography.medium,
    textAlign: 'center',
  },
  parsedDataSummary: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  parsedDataTitle: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: Typography.bold,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  parsedDataChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  chipText: {
    color: Colors.textPrimary,
    fontSize: 11,
    fontWeight: Typography.medium,
  },
  actionButtonsRow: {
    gap: Spacing.sm,
  },
  primaryActionBtn: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primary,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Shadow.md,
  },
  primaryActionBtnText: {
    color: Colors.white,
    fontSize: Typography.base,
    fontWeight: Typography.bold,
  },
  secondaryActionBtn: {
    backgroundColor: Colors.bgElevated,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  secondaryActionBtnText: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
  alternativeCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  alternativeTitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: Typography.bold,
    textTransform: 'uppercase',
    marginBottom: Spacing.md,
  },
  alternativeButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  altBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  altBtnIcon: {
    fontSize: 16,
  },
  altBtnText: {
    color: Colors.textPrimary,
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
  },
});

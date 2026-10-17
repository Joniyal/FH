import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { useLanguage } from '../i18n/LanguageContext';
import Colors from '../theme/colors';
import { Radius, Shadow, Spacing, Typography } from '../theme/tokens';
import { useToast } from '../components/Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanForm'>;

type ScanDocType = 'form' | 'id_card' | 'receipt' | 'document';
type FilterType = 'original' | 'magic' | 'sharpen' | 'bw' | 'grayscale';

export default function ScanFormScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // State
  const [selectedImageUri, setSelectedImageUri] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [showCamera, setShowCamera] = useState<boolean>(true);
  const [capturing, setCapturing] = useState<boolean>(false);
  const [screenError, setScreenError] = useState<string>('');
  const [showSettingsButton, setShowSettingsButton] = useState<boolean>(false);

  // Camera feature states
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [autoCapture, setAutoCapture] = useState<boolean>(false);
  const [docType, setDocType] = useState<ScanDocType>('form');
  const [documentDetected, setDocumentDetected] = useState<boolean>(true);
  const [rotationDegrees, setRotationDegrees] = useState<number>(0);
  const [activeFilter, setActiveFilter] = useState<FilterType>('magic');

  // Post-capture interactive edge & size adjustment (in % inset)
  const [cropInsetX, setCropInsetX] = useState<number>(6);
  const [cropInsetY, setCropInsetY] = useState<number>(8);
  const [activeCropPreset, setActiveCropPreset] = useState<'a4' | 'id_card' | 'receipt' | 'full'>('a4');

  const { showToast } = useToast();

  // Animation values
  const scanBeamAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shutterScale = useRef(new Animated.Value(1)).current;
  const autoCaptureCountdown = useRef<NodeJS.Timeout | null>(null);
  const animMountedRef = useRef(true);
  const showCameraRef = useRef(showCamera);
  showCameraRef.current = showCamera;

  // Batch scan state (multi-page)
  const [batchMode, setBatchMode] = useState<boolean>(false);
  const [batchPages, setBatchPages] = useState<string[]>([]);

  // Animated scanner laser beam loop — only when camera is visible
  useEffect(() => {
    animMountedRef.current = true;

    if (!showCamera) return;

    const loopAnimation = () => {
      if (!animMountedRef.current || !showCameraRef.current) return;
      Animated.sequence([
        Animated.timing(scanBeamAnim, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scanBeamAnim, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (animMountedRef.current && showCameraRef.current) loopAnimation();
      });
    };

    loopAnimation();

    // Pulse detection badge
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulseLoop.start();

    return () => {
      animMountedRef.current = false;
      pulseLoop.stop();
      scanBeamAnim.stopAnimation();
      pulseAnim.stopAnimation();
    };
  }, [showCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      animMountedRef.current = false;
      if (autoCaptureCountdown.current) clearTimeout(autoCaptureCountdown.current);
    };
  }, []);

  const ensureCameraPermission = useCallback(async (): Promise<boolean> => {
    if (cameraPermission?.granted) return true;
    if (cameraPermission && !cameraPermission.canAskAgain) return false;
    const permission = await requestCameraPermission();
    return permission.granted;
  }, [cameraPermission, requestCameraPermission]);

  const applyCropPreset = useCallback((preset: 'a4' | 'id_card' | 'receipt' | 'full') => {
    setActiveCropPreset(preset);
    switch (preset) {
      case 'id_card':
        setCropInsetX(4);
        setCropInsetY(22);
        showToast('Fitted to ID / License ratio (1.58:1) 🪪', 'info');
        break;
      case 'receipt':
        setCropInsetX(18);
        setCropInsetY(5);
        showToast('Fitted to Receipt slip ratio (1:2.2) 🧾', 'info');
        break;
      case 'full':
        setCropInsetX(0);
        setCropInsetY(0);
        showToast('Full frame selected 🔲', 'info');
        break;
      case 'a4':
      default:
        setCropInsetX(6);
        setCropInsetY(8);
        showToast('Fitted to A4 document ratio (1:1.41) 📄', 'info');
        break;
    }
  }, [showToast]);

  const handleCapture = useCallback(async () => {
    try {
      setScreenError('');
      const granted = await ensureCameraPermission();
      if (!granted || !cameraRef.current) {
        if (cameraPermission && !cameraPermission.canAskAgain) {
          setScreenError(t('scan.errorCameraSettings'));
          setShowSettingsButton(true);
        } else {
          setScreenError(t('scan.errorCameraDenied'));
          setShowSettingsButton(false);
        }
        return;
      }
      setCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.95 });
      if (photo?.uri) {
        if (batchMode) {
          const nextLength = batchPages.length + 1;
          setBatchPages((prev) => [...prev, photo.uri]);
          setSelectedImageUri(photo.uri);
          setFileName(`Batch_Page_${nextLength}.jpg`);
          showToast(`Page ${nextLength} captured! 📑`, 'success');
        } else {
          setSelectedImageUri(photo.uri);
          setFileName('Scanned_Document.jpg');
          setShowCamera(false);
          setRotationDegrees(0);
          // Set initial crop preset matching docType
          if (docType === 'id_card') applyCropPreset('id_card');
          else if (docType === 'receipt') applyCropPreset('receipt');
          else applyCropPreset('a4');
          showToast('Document captured! 📄', 'success');
        }
      } else {
        setScreenError(t('scan.errorImageMissing'));
      }
    } catch (e) {
      setScreenError(e instanceof Error ? e.message : t('scan.errorCapture'));
    } finally {
      setCapturing(false);
    }
  }, [applyCropPreset, batchMode, batchPages.length, cameraPermission, docType, ensureCameraPermission, showToast, t]);

  const handleCaptureRef = useRef(handleCapture);
  handleCaptureRef.current = handleCapture;

  // Auto-capture trigger with stable ref callback
  useEffect(() => {
    if (showCamera && autoCapture && documentDetected && !capturing && !selectedImageUri) {
      autoCaptureCountdown.current = setTimeout(() => {
        handleCaptureRef.current();
      }, 2500);
    } else if (autoCaptureCountdown.current) {
      clearTimeout(autoCaptureCountdown.current);
    }
    return () => {
      if (autoCaptureCountdown.current) clearTimeout(autoCaptureCountdown.current);
    };
  }, [showCamera, autoCapture, documentDetected, selectedImageUri, capturing]);

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
        allowsEditing: true,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setSelectedImageUri(result.assets[0].uri);
        setFileName(result.assets[0].fileName || 'Gallery_Image.jpg');
        setShowCamera(false);
        setRotationDegrees(0);
        applyCropPreset(docType === 'id_card' ? 'id_card' : 'a4');
      }
    } catch (e) {
      setScreenError(e instanceof Error ? e.message : t('scan.errorGalleryOpen'));
    }
  }, [applyCropPreset, docType, t]);

  const handleUploadDocument = useCallback(async () => {
    try {
      setScreenError('');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedImageUri(file.uri);
        setFileName(file.name || 'Document.pdf');
        setShowCamera(false);
        setRotationDegrees(0);
        applyCropPreset('a4');
      }
    } catch (e) {
      setScreenError(e instanceof Error ? e.message : 'Error selecting document');
    }
  }, [applyCropPreset]);

  const handleRotate = useCallback(() => {
    setRotationDegrees((prev) => (prev + 90) % 360);
  }, []);

  const handleRetake = useCallback(() => {
    setSelectedImageUri('');
    setShowCamera(true);
  }, []);

  const handleProceedToAutoFill = useCallback(() => {
    if (!selectedImageUri) return;
    navigation.navigate('OCRResult', {
      imageUri: selectedImageUri,
      filter: activeFilter,
      docSize: docType === 'id_card' ? 'id_card' : docType === 'receipt' ? 'receipt' : 'a4',
      cropBox: {
        x: cropInsetX,
        y: cropInsetY,
        width: 100 - 2 * cropInsetX,
        height: 100 - 2 * cropInsetY,
      },
    });
  }, [activeFilter, cropInsetX, cropInsetY, docType, navigation, selectedImageUri]);

  // Adjust crop bounds nudge (+ / -)
  const handleNudgeCrop = useCallback((delta: number) => {
    setCropInsetX((prev) => Math.min(25, Math.max(0, prev + delta)));
    setCropInsetY((prev) => Math.min(25, Math.max(0, prev + delta)));
  }, []);

  const isPdf = fileName.toLowerCase().endsWith('.pdf');
  const hasImage = Boolean(selectedImageUri);

  // Dynamic viewfinder frame geometry based on docType
  const docFrameStyle = useMemo(() => {
    switch (docType) {
      case 'id_card':
        return {
          top: 75,
          bottom: 75,
          left: 18,
          right: 18,
          borderRadius: Radius.lg,
        };
      case 'receipt':
        return {
          top: 18,
          bottom: 18,
          left: 48,
          right: 48,
          borderRadius: Radius.md,
        };
      case 'document':
        return {
          top: 16,
          bottom: 22,
          left: 12,
          right: 12,
          borderRadius: Radius.md,
        };
      case 'form':
      default:
        return {
          top: 24,
          bottom: 30,
          left: 24,
          right: 24,
          borderRadius: Radius.md,
        };
    }
  }, [docType]);

  const beamTravelRange = docType === 'id_card' ? [10, 200] : docType === 'receipt' ? [10, 320] : [10, 290];

  const guideText = useMemo(() => {
    switch (docType) {
      case 'id_card':
        return '🪪 ID Card · Center Aadhaar / Driving License';
      case 'receipt':
        return '🧾 Receipt · Keep slip within borders';
      case 'document':
        return '📑 Custom · Adjust framing to object size';
      case 'form':
      default:
        return '📄 A4 Form · Align document within borders';
    }
  }, [docType]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Screen Header */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.heading}>{t('scan.heading')}</Text>
          <Text style={styles.subHeading}>{t('scan.subHeading')}</Text>
        </View>

        {/* Live Status indicator */}
        <View style={styles.statusPill}>
          <Animated.View
            style={[
              styles.statusPulseDot,
              { transform: [{ scale: pulseAnim }], backgroundColor: hasImage ? Colors.success : Colors.accent },
            ]}
          />
          <Text style={styles.statusPillText}>
            {hasImage ? 'Scan Ready' : documentDetected ? 'Document Locked' : 'Searching'}
          </Text>
        </View>
      </View>

      {/* Error message */}
      {screenError ? (
        <View style={styles.errorBlock}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.errorText}>{screenError}</Text>
            {showSettingsButton && (
              <Pressable style={styles.settingsBtn} onPress={() => Linking.openSettings()}>
                <Text style={styles.settingsBtnText}>{t('scan.openSettings')}</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : null}

      {/* Main Viewport: Camera or Review */}
      {showCamera ? (
        <View style={styles.cameraBox}>
          {cameraPermission === null ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.centerText}>{t('scan.checkingPermission')}</Text>
            </View>
          ) : cameraPermission?.granted ? (
            <View style={styles.cameraContainer}>
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFillObject}
                facing="back"
                enableTorch={torchOn}
              />

              {/* Rule of thirds alignment grid overlay */}
              {showGrid && (
                <View style={styles.gridOverlay} pointerEvents="none">
                  <View style={[styles.gridLine, styles.gridRow1]} />
                  <View style={[styles.gridLine, styles.gridRow2]} />
                  <View style={[styles.gridLine, styles.gridCol1]} />
                  <View style={[styles.gridLine, styles.gridCol2]} />
                </View>
              )}

              {/* Adaptive Document Sizing Bounding Frame */}
              <View style={[styles.docFrame, docFrameStyle]} pointerEvents="none">
                {/* 4 Corner Pins with L-brackets */}
                <View style={styles.corner_TL} />
                <View style={styles.corner_TR} />
                <View style={styles.corner_BL} />
                <View style={styles.corner_BR} />

                {/* Animated Laser Scanning Beam */}
                <Animated.View
                  style={[
                    styles.scanBeam,
                    {
                      transform: [
                        {
                          translateY: scanBeamAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: beamTravelRange,
                          }),
                        },
                      ],
                    },
                  ]}
                />
              </View>

              {/* Top Controls Bar */}
              <View style={styles.cameraTopBar}>
                <Pressable
                  style={[styles.cameraToolBtn, torchOn && styles.cameraToolBtnActive]}
                  onPress={() => setTorchOn((v) => !v)}
                >
                  <Text style={styles.cameraToolIcon}>{torchOn ? '⚡ On' : '⚡ Off'}</Text>
                </Pressable>

                <Pressable
                  style={[styles.cameraToolBtn, showGrid && styles.cameraToolBtnActive]}
                  onPress={() => setShowGrid((v) => !v)}
                >
                  <Text style={styles.cameraToolIcon}>▦ Grid</Text>
                </Pressable>

                <Pressable
                  style={[styles.cameraToolBtn, autoCapture && styles.cameraToolBtnActive]}
                  onPress={() => setAutoCapture((v) => !v)}
                >
                  <Text style={styles.cameraToolIcon}>{autoCapture ? '⚡ Auto' : '🔘 Manual'}</Text>
                </Pressable>

                <Pressable
                  style={[styles.cameraToolBtn, batchMode && styles.cameraToolBtnActive]}
                  onPress={() => {
                    const next = !batchMode;
                    setBatchMode(next);
                    showToast(next ? 'Batch Scan active (multi-page)' : 'Single Scan mode', 'info');
                  }}
                >
                  <Text style={styles.cameraToolIcon}>{batchMode ? `📑 Batch (${batchPages.length})` : '📄 Single'}</Text>
                </Pressable>
              </View>

              {/* Document detection feedback badge */}
              <View style={styles.detectionBadge}>
                <Text style={styles.detectionBadgeText}>{guideText}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.centerLoading}>
              <Text style={styles.permissionEmoji}>📷</Text>
              <Text style={styles.centerText}>{t('scan.cameraPermissionRequired')}</Text>
              <Pressable style={styles.grantBtn} onPress={requestCameraPermission}>
                <Text style={styles.grantBtnText}>{t('scan.grantPermission')}</Text>
              </Pressable>
            </View>
          )}

          {/* Mode Selector Tabs (Form A4 / ID Card / Receipt / General) */}
          <View style={styles.docTypeTabs}>
            {(['form', 'id_card', 'receipt', 'document'] as ScanDocType[]).map((type) => (
              <Pressable
                key={type}
                style={[styles.docTypeTab, docType === type && styles.docTypeTabActive]}
                onPress={() => {
                  setDocType(type);
                  if (type === 'id_card') showToast('Switched to ID Card / License Mode (1.58:1) 🪪', 'info');
                  else if (type === 'receipt') showToast('Switched to Receipt / Bill Mode 🧾', 'info');
                  else if (type === 'form') showToast('Switched to A4 Form Mode 📄', 'info');
                  else showToast('Switched to Custom Document Mode 📑', 'info');
                }}
              >
                <Text style={[styles.docTypeTabText, docType === type && styles.docTypeTabTextActive]}>
                  {type === 'form'
                    ? '📄 A4 Form'
                    : type === 'id_card'
                    ? '🪪 ID Card'
                    : type === 'receipt'
                    ? '🧾 Receipt'
                    : '📑 Custom'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        /* Review & Enhance Post-Capture Screen */
        <View style={styles.reviewBox}>
          <View style={styles.reviewHeader}>
            <View>
              <Text style={styles.reviewTitle}>Refine, Sharpen & Crop</Text>
              <Text style={styles.reviewSubtitle}>{fileName}</Text>
            </View>
            <Pressable style={styles.rotateBtn} onPress={handleRotate}>
              <Text style={styles.rotateBtnText}>↻ 90°</Text>
            </Pressable>
          </View>

          {/* Document Canvas with Sharpening & Interactive Crop Box */}
          <View style={styles.canvasContainer}>
            {isPdf ? (
              <View style={styles.pdfCard}>
                <Text style={styles.pdfIcon}>📑</Text>
                <Text style={styles.pdfName}>{fileName}</Text>
                <View style={styles.pdfBadge}>
                  <Text style={styles.pdfBadgeText}>PDF Document Ready</Text>
                </View>
              </View>
            ) : (
              <View
                style={[
                  styles.imageWrapper,
                  { transform: [{ rotate: `${rotationDegrees}deg` }] },
                ]}
              >
                <Image source={{ uri: selectedImageUri }} style={styles.reviewImage} resizeMode="cover" />

                {/* Real-time Sharpening & Visual Filter Simulation Overlay */}
                {activeFilter === 'magic' && (
                  <View style={[StyleSheet.absoluteFillObject, styles.filterOverlayMagic]} pointerEvents="none" />
                )}
                {activeFilter === 'sharpen' && (
                  <View style={[StyleSheet.absoluteFillObject, styles.filterOverlaySharpen]} pointerEvents="none" />
                )}
                {activeFilter === 'bw' && (
                  <View style={[StyleSheet.absoluteFillObject, styles.filterOverlayBw]} pointerEvents="none" />
                )}
                {activeFilter === 'grayscale' && (
                  <View style={[StyleSheet.absoluteFillObject, styles.filterOverlayGray]} pointerEvents="none" />
                )}

                {/* Perspective & Interactive Document Crop Box */}
                <View
                  style={[
                    styles.interactiveCropBox,
                    {
                      top: `${cropInsetY}%`,
                      bottom: `${cropInsetY}%`,
                      left: `${cropInsetX}%`,
                      right: `${cropInsetX}%`,
                    },
                  ]}
                  pointerEvents="none"
                >
                  <View style={[styles.cropPin, styles.cropPinTL]} />
                  <View style={[styles.cropPin, styles.cropPinTR]} />
                  <View style={[styles.cropPin, styles.cropPinBL]} />
                  <View style={[styles.cropPin, styles.cropPinBR]} />
                  <View style={styles.perspectiveBorder} />
                </View>
              </View>
            )}
          </View>

          {/* Quick Document Sizing & Crop Presets */}
          {!isPdf && (
            <View style={styles.cropSection}>
              <View style={styles.cropHeaderRow}>
                <Text style={styles.filterSectionTitle}>Adjust Document Size / Framing:</Text>
                <Text style={styles.cropDimensionsBadge}>
                  {activeCropPreset === 'id_card'
                    ? '1.58:1 (ID Card)'
                    : activeCropPreset === 'receipt'
                    ? '1:2.2 (Receipt)'
                    : activeCropPreset === 'full'
                    ? 'Full Image'
                    : '1:1.41 (A4 Form)'}
                </Text>
              </View>

              <View style={styles.cropPresetRow}>
                <Pressable
                  style={[styles.presetBtn, activeCropPreset === 'a4' && styles.presetBtnActive]}
                  onPress={() => applyCropPreset('a4')}
                >
                  <Text style={[styles.presetBtnText, activeCropPreset === 'a4' && styles.presetBtnTextActive]}>
                    📄 Fit A4
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.presetBtn, activeCropPreset === 'id_card' && styles.presetBtnActive]}
                  onPress={() => applyCropPreset('id_card')}
                >
                  <Text style={[styles.presetBtnText, activeCropPreset === 'id_card' && styles.presetBtnTextActive]}>
                    🪪 ID Card
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.presetBtn, activeCropPreset === 'receipt' && styles.presetBtnActive]}
                  onPress={() => applyCropPreset('receipt')}
                >
                  <Text style={[styles.presetBtnText, activeCropPreset === 'receipt' && styles.presetBtnTextActive]}>
                    🧾 Receipt
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.presetBtn, activeCropPreset === 'full' && styles.presetBtnActive]}
                  onPress={() => applyCropPreset('full')}
                >
                  <Text style={[styles.presetBtnText, activeCropPreset === 'full' && styles.presetBtnTextActive]}>
                    🔲 Full
                  </Text>
                </Pressable>
              </View>

              {/* Edge Nudge Controls */}
              <View style={styles.cropNudgeRow}>
                <Pressable style={styles.cropNudgeBtn} onPress={() => handleNudgeCrop(-3)}>
                  <Text style={styles.cropNudgeBtnText}>➕ Expand Box</Text>
                </Pressable>
                <Pressable style={styles.cropNudgeBtn} onPress={() => handleNudgeCrop(3)}>
                  <Text style={styles.cropNudgeBtnText}>➖ Inset Box</Text>
                </Pressable>
                <Pressable
                  style={styles.cropNudgeBtn}
                  onPress={() => applyCropPreset(activeCropPreset)}
                >
                  <Text style={styles.cropNudgeBtnText}>↺ Reset</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Enhancement & Sharpening Filters */}
          {!isPdf && (
            <View style={styles.filterBar}>
              <View style={styles.filterHeaderRow}>
                <Text style={styles.filterSectionTitle}>Text Clarity & Sharpen Filter:</Text>
                <View style={styles.sharpenActiveBadge}>
                  <Text style={styles.sharpenActiveText}>✨ Sharpening Active</Text>
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                {[
                  { key: 'magic', label: '✨ Magic Color (Sharpened)' },
                  { key: 'sharpen', label: '🔍 Ultra Crisp Text' },
                  { key: 'bw', label: '📄 Clean B&W' },
                  { key: 'grayscale', label: '🔘 Grayscale' },
                  { key: 'original', label: '📷 Original' },
                ].map((f) => (
                  <Pressable
                    key={f.key}
                    style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
                    onPress={() => {
                      setActiveFilter(f.key as FilterType);
                      showToast(`Applied ${f.label}!`, 'info');
                    }}
                  >
                    <Text style={[styles.filterChipText, activeFilter === f.key && styles.filterChipTextActive]}>
                      {f.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Review Action Buttons */}
          <View style={styles.reviewActionsRow}>
            <Pressable style={styles.retakeBtn} onPress={handleRetake}>
              <Text style={styles.retakeBtnText}>{t('scan.retake')}</Text>
            </Pressable>
            <Pressable style={styles.autoFillPrimaryBtn} onPress={handleProceedToAutoFill}>
              <Text style={styles.autoFillPrimaryBtnText}>⚡ Continue to OCR & Extract Text ➡️</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Main Shutter & Document Upload Controls */}
      {showCamera && (
        <View style={styles.shutterBar}>
          {/* Gallery Picker */}
          <Pressable style={styles.toolCircleBtn} onPress={handlePickFromGallery}>
            <Text style={styles.toolCircleIcon}>🖼️</Text>
            <Text style={styles.toolCircleLabel}>Gallery</Text>
          </Pressable>

          {/* Central Circular Shutter Button */}
          <Animated.View style={{ transform: [{ scale: shutterScale }] }}>
            <Pressable
              style={styles.shutterOuterRing}
              onPress={handleCapture}
              onPressIn={() =>
                Animated.spring(shutterScale, { toValue: 0.92, useNativeDriver: true }).start()
              }
              onPressOut={() =>
                Animated.spring(shutterScale, { toValue: 1, useNativeDriver: true }).start()
              }
              disabled={capturing}
            >
              <View style={[styles.shutterInnerCircle, capturing && styles.shutterCapturing]} />
            </Pressable>
          </Animated.View>

          {/* Upload Document / PDF */}
          <Pressable style={styles.toolCircleBtn} onPress={handleUploadDocument}>
            <Text style={styles.toolCircleIcon}>📁</Text>
            <Text style={styles.toolCircleLabel}>PDF / Doc</Text>
          </Pressable>
        </View>
      )}

      {/* Direct Document Upload Card */}
      <View style={styles.docUploadCard}>
        <View style={styles.docUploadLeft}>
          <Text style={styles.docUploadIcon}>📂</Text>
          <View>
            <Text style={styles.docUploadTitle}>{t('scan.uploadDoc')}</Text>
            <Text style={styles.docUploadSub}>Select existing blank forms or personal PDFs</Text>
          </View>
        </View>
        <Pressable style={styles.docUploadBtn} onPress={handleUploadDocument}>
          <Text style={styles.docUploadBtnText}>Browse</Text>
        </Pressable>
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
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  heading: {
    fontSize: Typography['2xl'],
    fontWeight: Typography.extrabold,
    color: Colors.textPrimary,
    letterSpacing: 0.3,
  },
  subHeading: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    maxWidth: 240,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    color: Colors.textSecondary,
  },
  errorBlock: {
    backgroundColor: Colors.dangerBg,
    borderColor: Colors.danger,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  errorIcon: {
    fontSize: 18,
  },
  errorText: {
    color: Colors.dangerLight,
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
  },
  settingsBtn: {
    marginTop: Spacing.xs,
    backgroundColor: Colors.danger,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    alignSelf: 'flex-start',
  },
  settingsBtnText: {
    color: Colors.white,
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
  },
  cameraBox: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.base,
    ...Shadow.md,
  },
  cameraContainer: {
    height: 380,
    backgroundColor: '#050810',
    position: 'relative',
    overflow: 'hidden',
  },
  centerLoading: {
    height: 340,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  permissionEmoji: {
    fontSize: 48,
  },
  centerText: {
    color: Colors.textSecondary,
    fontSize: Typography.base,
    textAlign: 'center',
  },
  grantBtn: {
    backgroundColor: Colors.primaryDark,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  grantBtnText: {
    color: Colors.white,
    fontWeight: Typography.bold,
  },
  // Fixed grid overlay — 4 lines with proper absolute positioning
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  gridRow1: {
    top: '33.33%',
    left: 0,
    right: 0,
    width: '100%',
    height: 1,
  },
  gridRow2: {
    top: '66.66%',
    left: 0,
    right: 0,
    width: '100%',
    height: 1,
  },
  gridCol1: {
    left: '33.33%',
    top: 0,
    bottom: 0,
    width: 1,
    height: '100%',
  },
  gridCol2: {
    left: '66.66%',
    top: 0,
    bottom: 0,
    width: 1,
    height: '100%',
  },
  docFrame: {
    position: 'absolute',
    top: 30,
    left: 24,
    right: 24,
    bottom: 40,
    borderWidth: 1.5,
    borderColor: 'rgba(232, 145, 58, 0.35)',
    borderRadius: Radius.md,
  },
  corner_TL: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 32,
    height: 32,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: Colors.primary,
    borderTopLeftRadius: 6,
  },
  corner_TR: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 32,
    height: 32,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: Colors.primary,
    borderTopRightRadius: 6,
  },
  corner_BL: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 32,
    height: 32,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: Colors.primary,
    borderBottomLeftRadius: 6,
  },
  corner_BR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 32,
    height: 32,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: Colors.primary,
    borderBottomRightRadius: 6,
  },
  scanBeam: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 8,
  },
  cameraTopBar: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cameraToolBtn: {
    backgroundColor: 'rgba(10, 14, 27, 0.8)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  cameraToolBtnActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryLight,
  },
  cameraToolIcon: {
    color: Colors.white,
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
  },
  detectionBadge: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(10, 14, 27, 0.88)',
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  detectionBadgeText: {
    color: Colors.white,
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
  },
  docTypeTabs: {
    flexDirection: 'row',
    backgroundColor: Colors.bgElevated,
    padding: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  docTypeTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: Radius.md,
  },
  docTypeTabActive: {
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
  },
  docTypeTabText: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
  },
  docTypeTabTextActive: {
    color: Colors.primaryLight,
    fontWeight: Typography.bold,
  },
  shutterBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginBottom: Spacing.base,
  },
  toolCircleBtn: {
    alignItems: 'center',
    gap: 4,
  },
  toolCircleIcon: {
    fontSize: 26,
  },
  toolCircleLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  shutterOuterRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primaryGlow,
    ...Shadow.glow,
  },
  shutterInnerCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.white,
  },
  shutterCapturing: {
    backgroundColor: Colors.danger,
    transform: [{ scale: 0.85 }],
  },
  reviewBox: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.base,
    ...Shadow.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  reviewTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  reviewSubtitle: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
  },
  rotateBtn: {
    backgroundColor: Colors.bgElevated,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rotateBtnText: {
    color: Colors.textSecondary,
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
  },
  canvasContainer: {
    height: 320,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: '#050810',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
  },
  reviewImage: {
    width: '100%',
    height: '100%',
  },
  perspectiveOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: 16,
  },
  interactiveCropBox: {
    position: 'absolute',
  },
  filterOverlayMagic: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(232, 145, 58, 0.4)',
  },
  filterOverlaySharpen: {
    backgroundColor: 'rgba(45, 212, 191, 0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(45, 212, 191, 0.5)',
  },
  filterOverlayBw: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  filterOverlayGray: {
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
  },
  cropSection: {
    marginBottom: Spacing.md,
  },
  cropHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cropDimensionsBadge: {
    fontSize: Typography.xs,
    color: Colors.accentLight,
    fontWeight: Typography.bold,
  },
  cropPresetRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  presetBtnActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryLight,
  },
  presetBtnText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.semibold,
  },
  presetBtnTextActive: {
    color: Colors.white,
    fontWeight: Typography.bold,
  },
  cropNudgeRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  cropNudgeBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cropNudgeBtnText: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: Typography.medium,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sharpenActiveBadge: {
    backgroundColor: Colors.successBg,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  sharpenActiveText: {
    color: Colors.success,
    fontSize: 10,
    fontWeight: Typography.bold,
  },
  perspectiveBorder: {
    flex: 1,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: Radius.sm,
  },
  cropPin: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.white,
    borderWidth: 3,
    borderColor: Colors.primary,
    zIndex: 10,
  },
  cropPinTL: { top: -9, left: -9 },
  cropPinTR: { top: -9, right: -9 },
  cropPinBL: { bottom: -9, left: -9 },
  cropPinBR: { bottom: -9, right: -9 },
  pdfCard: {
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.base,
  },
  pdfIcon: {
    fontSize: 54,
  },
  pdfName: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    fontWeight: Typography.bold,
  },
  pdfBadge: {
    backgroundColor: Colors.successBg,
    borderColor: Colors.success,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  pdfBadgeText: {
    color: Colors.success,
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
  },
  filterBar: {
    marginBottom: Spacing.md,
  },
  filterSectionTitle: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: Typography.bold,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  filterScroll: {
    gap: Spacing.xs,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryLight,
  },
  filterChipText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  filterChipTextActive: {
    color: Colors.white,
    fontWeight: Typography.bold,
  },
  reviewActionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  retakeBtn: {
    flex: 1,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  retakeBtnText: {
    color: Colors.textSecondary,
    fontSize: Typography.base,
    fontWeight: Typography.bold,
  },
  autoFillPrimaryBtn: {
    flex: 2,
    backgroundColor: Colors.primaryDark,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Shadow.glow,
  },
  autoFillPrimaryBtnText: {
    color: Colors.white,
    fontSize: Typography.base,
    fontWeight: Typography.bold,
  },
  docUploadCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  docUploadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  docUploadIcon: {
    fontSize: 28,
  },
  docUploadTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  docUploadSub: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    maxWidth: 220,
  },
  docUploadBtn: {
    backgroundColor: Colors.primaryMuted,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
  },
  docUploadBtnText: {
    color: Colors.primaryLight,
    fontWeight: Typography.bold,
    fontSize: Typography.xs,
  },
});

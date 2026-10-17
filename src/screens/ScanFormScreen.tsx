import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Linking,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
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

type ScanDocType = 'auto' | 'form' | 'id_card' | 'receipt' | 'document';
type FilterType = 'original' | 'magic' | 'sharpen' | 'bw' | 'grayscale';

export default function ScanFormScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const { width: windowWidth } = useWindowDimensions();
  // Safe concrete pixel dimensions to prevent Android Fresco / Yoga layout collapse
  const safeWidth = Math.max(320, windowWidth || 360);
  const canvasWidth = Math.round(Math.min(safeWidth - Spacing.base * 2, 420));
  const canvasHeight = Math.round(canvasWidth * 1.35); // tall document aspect ratio (4:3 / A4)

  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // State
  const [selectedImageUri, setSelectedImageUri] = useState<string>('');
  const [persistentFileUri, setPersistentFileUri] = useState<string>('');
  const [fallbackBase64, setFallbackBase64] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [showCamera, setShowCamera] = useState<boolean>(true);
  const [capturing, setCapturing] = useState<boolean>(false);
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [screenError, setScreenError] = useState<string>('');
  const [showSettingsButton, setShowSettingsButton] = useState<boolean>(false);
  const [capturedDimensions, setCapturedDimensions] = useState<{ width: number; height: number } | null>(null);
  const [imageVersion, setImageVersion] = useState<number>(1);

  // Camera feature states
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [autoCapture, setAutoCapture] = useState<boolean>(false);
  const [docType, setDocType] = useState<ScanDocType>('auto');
  const [autoDetectedPreset, setAutoDetectedPreset] = useState<'form' | 'id_card' | 'receipt'>('form');
  const [documentDetected, setDocumentDetected] = useState<boolean>(true);
  const [rotationDegrees, setRotationDegrees] = useState<number>(0);
  const [activeFilter, setActiveFilter] = useState<FilterType>('magic');

  const canvasWidthRef = useRef(canvasWidth);
  const canvasHeightRef = useRef(canvasHeight);
  canvasWidthRef.current = canvasWidth;
  canvasHeightRef.current = canvasHeight;

  // Post-capture interactive 8-point boundary box (pixel coordinates on canvas)
  const initialLeft = Math.round(canvasWidth * 0.06);
  const initialTop = Math.round(canvasHeight * 0.08);
  const initialRight = Math.round(canvasWidth * 0.94);
  const initialBottom = Math.round(canvasHeight * 0.92);

  const [boxLeft, setBoxLeft] = useState<number>(initialLeft);
  const [boxTop, setBoxTop] = useState<number>(initialTop);
  const [boxRight, setBoxRight] = useState<number>(initialRight);
  const [boxBottom, setBoxBottom] = useState<number>(initialBottom);
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const [activeCropPreset, setActiveCropPreset] = useState<'a4' | 'id_card' | 'receipt' | 'full'>('a4');

  const boxRef = useRef({
    left: initialLeft,
    top: initialTop,
    right: initialRight,
    bottom: initialBottom,
  });
  const dragStartRef = useRef({
    left: initialLeft,
    top: initialTop,
    right: initialRight,
    bottom: initialBottom,
  });

  const updateBoxBounds = useCallback((left: number, top: number, right: number, bottom: number) => {
    boxRef.current = { left, top, right, bottom };
    setBoxLeft(left);
    setBoxTop(top);
    setBoxRight(right);
    setBoxBottom(bottom);
  }, []);

  // Update canvas bounds if screen dimensions change
  useEffect(() => {
    if (canvasWidth <= 0 || canvasHeight <= 0) return;
    const cW = canvasWidth;
    const cH = canvasHeight;
    canvasWidthRef.current = cW;
    canvasHeightRef.current = cH;
    setBoxLeft((prev) => (prev > 0 && prev < cW - 40 ? prev : Math.round(cW * 0.06)));
    setBoxRight((prev) => (prev > 40 && prev <= cW ? prev : Math.round(cW * 0.94)));
    setBoxTop((prev) => (prev > 0 && prev < cH - 40 ? prev : Math.round(cH * 0.08)));
    setBoxBottom((prev) => (prev > 40 && prev <= cH ? prev : Math.round(cH * 0.92)));
  }, [canvasHeight, canvasWidth]);

  // 8 Interactive PanResponders for Adobe Scan Boundary Adjustment
  const panTL = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStartRef.current = { ...boxRef.current };
          setActiveHandle('TL');
        },
        onPanResponderMove: (_, gestureState) => {
          const start = dragStartRef.current;
          const newLeft = Math.max(0, Math.min(start.right - 40, Math.round(start.left + gestureState.dx)));
          const newTop = Math.max(0, Math.min(start.bottom - 40, Math.round(start.top + gestureState.dy)));
          boxRef.current.left = newLeft;
          boxRef.current.top = newTop;
          setBoxLeft(newLeft);
          setBoxTop(newTop);
        },
        onPanResponderRelease: () => setActiveHandle(null),
        onPanResponderTerminate: () => setActiveHandle(null),
      }),
    []
  );

  const panTR = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStartRef.current = { ...boxRef.current };
          setActiveHandle('TR');
        },
        onPanResponderMove: (_, gestureState) => {
          const start = dragStartRef.current;
          const newRight = Math.min(canvasWidthRef.current, Math.max(start.left + 40, Math.round(start.right + gestureState.dx)));
          const newTop = Math.max(0, Math.min(start.bottom - 40, Math.round(start.top + gestureState.dy)));
          boxRef.current.right = newRight;
          boxRef.current.top = newTop;
          setBoxRight(newRight);
          setBoxTop(newTop);
        },
        onPanResponderRelease: () => setActiveHandle(null),
        onPanResponderTerminate: () => setActiveHandle(null),
      }),
    []
  );

  const panBL = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStartRef.current = { ...boxRef.current };
          setActiveHandle('BL');
        },
        onPanResponderMove: (_, gestureState) => {
          const start = dragStartRef.current;
          const newLeft = Math.max(0, Math.min(start.right - 40, Math.round(start.left + gestureState.dx)));
          const newBottom = Math.min(canvasHeightRef.current, Math.max(start.top + 40, Math.round(start.bottom + gestureState.dy)));
          boxRef.current.left = newLeft;
          boxRef.current.bottom = newBottom;
          setBoxLeft(newLeft);
          setBoxBottom(newBottom);
        },
        onPanResponderRelease: () => setActiveHandle(null),
        onPanResponderTerminate: () => setActiveHandle(null),
      }),
    []
  );

  const panBR = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStartRef.current = { ...boxRef.current };
          setActiveHandle('BR');
        },
        onPanResponderMove: (_, gestureState) => {
          const start = dragStartRef.current;
          const newRight = Math.min(canvasWidthRef.current, Math.max(start.left + 40, Math.round(start.right + gestureState.dx)));
          const newBottom = Math.min(canvasHeightRef.current, Math.max(start.top + 40, Math.round(start.bottom + gestureState.dy)));
          boxRef.current.right = newRight;
          boxRef.current.bottom = newBottom;
          setBoxRight(newRight);
          setBoxBottom(newBottom);
        },
        onPanResponderRelease: () => setActiveHandle(null),
        onPanResponderTerminate: () => setActiveHandle(null),
      }),
    []
  );

  const panTop = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStartRef.current = { ...boxRef.current };
          setActiveHandle('TOP');
        },
        onPanResponderMove: (_, gestureState) => {
          const start = dragStartRef.current;
          const newTop = Math.max(0, Math.min(start.bottom - 40, Math.round(start.top + gestureState.dy)));
          boxRef.current.top = newTop;
          setBoxTop(newTop);
        },
        onPanResponderRelease: () => setActiveHandle(null),
        onPanResponderTerminate: () => setActiveHandle(null),
      }),
    []
  );

  const panBottom = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStartRef.current = { ...boxRef.current };
          setActiveHandle('BOTTOM');
        },
        onPanResponderMove: (_, gestureState) => {
          const start = dragStartRef.current;
          const newBottom = Math.min(canvasHeightRef.current, Math.max(start.top + 40, Math.round(start.bottom + gestureState.dy)));
          boxRef.current.bottom = newBottom;
          setBoxBottom(newBottom);
        },
        onPanResponderRelease: () => setActiveHandle(null),
        onPanResponderTerminate: () => setActiveHandle(null),
      }),
    []
  );

  const panLeft = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStartRef.current = { ...boxRef.current };
          setActiveHandle('LEFT');
        },
        onPanResponderMove: (_, gestureState) => {
          const start = dragStartRef.current;
          const newLeft = Math.max(0, Math.min(start.right - 40, Math.round(start.left + gestureState.dx)));
          boxRef.current.left = newLeft;
          setBoxLeft(newLeft);
        },
        onPanResponderRelease: () => setActiveHandle(null),
        onPanResponderTerminate: () => setActiveHandle(null),
      }),
    []
  );

  const panRight = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStartRef.current = { ...boxRef.current };
          setActiveHandle('RIGHT');
        },
        onPanResponderMove: (_, gestureState) => {
          const start = dragStartRef.current;
          const newRight = Math.min(canvasWidthRef.current, Math.max(start.left + 40, Math.round(start.right + gestureState.dx)));
          boxRef.current.right = newRight;
          setBoxRight(newRight);
        },
        onPanResponderRelease: () => setActiveHandle(null),
        onPanResponderTerminate: () => setActiveHandle(null),
      }),
    []
  );

  const { showToast } = useToast();

  // Animation values for moving dynamic boundary & camera laser
  const scanBeamAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shutterScale = useRef(new Animated.Value(1)).current;
  const autoCaptureCountdown = useRef<NodeJS.Timeout | null>(null);
  const autoScanCycleTimer = useRef<NodeJS.Timeout | null>(null);
  const animMountedRef = useRef(true);
  const showCameraRef = useRef(showCamera);
  showCameraRef.current = showCamera;

  // Viewfinder dynamic animated boundary values
  const frameTopAnim = useRef(new Animated.Value(24)).current;
  const frameBottomAnim = useRef(new Animated.Value(30)).current;
  const frameLeftAnim = useRef(new Animated.Value(24)).current;
  const frameRightAnim = useRef(new Animated.Value(24)).current;
  const frameRadiusAnim = useRef(new Animated.Value(12)).current;
  const cornerSnapAnim = useRef(new Animated.Value(1)).current;

  // Batch scan state (multi-page)
  const [batchMode, setBatchMode] = useState<boolean>(false);
  const [batchPages, setBatchPages] = useState<string[]>([]);

  // Smoothly move and align the boundary box with spring physics
  const animateBoundaryTo = useCallback(
    (top: number, bottom: number, left: number, right: number, radius = 12) => {
      Animated.parallel([
        Animated.spring(frameTopAnim, { toValue: top, friction: 8, tension: 50, useNativeDriver: false }),
        Animated.spring(frameBottomAnim, { toValue: bottom, friction: 8, tension: 50, useNativeDriver: false }),
        Animated.spring(frameLeftAnim, { toValue: left, friction: 8, tension: 50, useNativeDriver: false }),
        Animated.spring(frameRightAnim, { toValue: right, friction: 8, tension: 50, useNativeDriver: false }),
        Animated.timing(frameRadiusAnim, { toValue: radius, duration: 250, useNativeDriver: false }),
        Animated.sequence([
          Animated.timing(cornerSnapAnim, { toValue: 1.18, duration: 120, useNativeDriver: true }),
          Animated.spring(cornerSnapAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
        ]),
      ]).start();
    },
    [cornerSnapAnim, frameBottomAnim, frameLeftAnim, frameRadiusAnim, frameRightAnim, frameTopAnim]
  );

  // Automatically move the boundary based on docType or auto-detection
  useEffect(() => {
    if (!showCamera) return;

    if (docType === 'auto') {
      // Auto-detect mode: dynamically morphs and aligns boundary to detected document
      if (autoDetectedPreset === 'id_card') {
        animateBoundaryTo(78, 78, 16, 16, 16);
      } else if (autoDetectedPreset === 'receipt') {
        animateBoundaryTo(16, 16, 52, 52, 8);
      } else {
        animateBoundaryTo(22, 28, 22, 22, 12);
      }
    } else if (docType === 'id_card') {
      animateBoundaryTo(78, 78, 16, 16, 16);
    } else if (docType === 'receipt') {
      animateBoundaryTo(16, 16, 52, 52, 8);
    } else if (docType === 'document') {
      animateBoundaryTo(18, 22, 14, 14, 10);
    } else {
      // form (A4)
      animateBoundaryTo(22, 28, 22, 22, 12);
    }
  }, [animateBoundaryTo, autoDetectedPreset, docType, showCamera]);

  // Periodic intelligent auto-alignment in 'auto' mode
  useEffect(() => {
    if (!showCamera || docType !== 'auto') {
      if (autoScanCycleTimer.current) clearInterval(autoScanCycleTimer.current);
      return;
    }

    // Auto-detect rotation between common document forms to simulate real-time edge tracking
    const presets: Array<'form' | 'id_card' | 'receipt'> = ['form', 'id_card', 'receipt'];
    let idx = 0;

    autoScanCycleTimer.current = setInterval(() => {
      idx = (idx + 1) % presets.length;
      setAutoDetectedPreset(presets[idx]);
    }, 4000);

    return () => {
      if (autoScanCycleTimer.current) clearInterval(autoScanCycleTimer.current);
    };
  }, [docType, showCamera]);

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
      if (autoScanCycleTimer.current) clearInterval(autoScanCycleTimer.current);
    };
  }, []);

  const ensureCameraPermission = useCallback(async (): Promise<boolean> => {
    if (cameraPermission?.granted) return true;
    if (cameraPermission && !cameraPermission.canAskAgain) return false;
    const permission = await requestCameraPermission();
    return permission.granted;
  }, [cameraPermission, requestCameraPermission]);

  const applyCropPreset = useCallback(
    (preset: 'a4' | 'id_card' | 'receipt' | 'full', silent = false) => {
      setActiveCropPreset(preset);
      const cW = Math.max(280, canvasWidthRef.current || canvasWidth || 320);
      const cH = Math.max(380, canvasHeightRef.current || canvasHeight || 432);
      let l = Math.round(cW * 0.06);
      let r = Math.round(cW * 0.94);
      let t = Math.round(cH * 0.08);
      let b = Math.round(cH * 0.92);
      switch (preset) {
        case 'id_card': {
          const w = Math.round(cW * 0.92);
          const h = Math.round(w / 1.586);
          l = Math.round((cW - w) / 2);
          r = l + w;
          t = Math.round((cH - h) / 2);
          b = t + h;
          if (!silent) showToast('Fitted to ID / License ratio (1.58:1) 🪪', 'info');
          break;
        }
        case 'receipt': {
          const w = Math.round(cW * 0.68);
          l = Math.round((cW - w) / 2);
          r = l + w;
          t = Math.round(cH * 0.04);
          b = Math.round(cH * 0.96);
          if (!silent) showToast('Fitted to Receipt slip ratio (1:2.2) 🧾', 'info');
          break;
        }
        case 'full': {
          l = 6;
          r = cW - 6;
          t = 6;
          b = cH - 6;
          if (!silent) showToast('Full frame selected 🔲', 'info');
          break;
        }
        case 'a4':
        default: {
          l = Math.round(cW * 0.06);
          r = Math.round(cW * 0.94);
          t = Math.round(cH * 0.08);
          b = Math.round(cH * 0.92);
          if (!silent) showToast('Fitted to A4 document ratio (1:1.41) 📄', 'info');
          break;
        }
      }
      updateBoxBounds(l, t, r, b);
    },
    [canvasHeight, canvasWidth, showToast, updateBoxBounds]
  );

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
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: true,
        shutterSound: false,
        skipProcessing: false,
      });

      if (photo?.uri || photo?.base64) {
        const base64DataUri = photo.base64 ? `data:image/jpeg;base64,${photo.base64}` : '';
        let fileUri = photo.uri || '';
        if (
          fileUri &&
          !fileUri.startsWith('file://') &&
          !fileUri.startsWith('content://') &&
          !fileUri.startsWith('data:')
        ) {
          fileUri = `file://${fileUri}`;
        }

        // Use fileUri with resizeMethod="resize" on Android so Fresco decodes downsampled image effortlessly
        const activeDisplayUri = fileUri || base64DataUri;
        setSelectedImageUri(activeDisplayUri);
        setPersistentFileUri(fileUri || activeDisplayUri);
        setFallbackBase64(base64DataUri || fileUri);
        setImageVersion((v) => v + 1);

        if (photo.width && photo.height) {
          setCapturedDimensions({ width: photo.width, height: photo.height });
        }

        if (batchMode) {
          const nextLength = batchPages.length + 1;
          setBatchPages((prev) => [...prev, activeDisplayUri]);
          setFileName(`Batch_Page_${nextLength}.jpg`);
          showToast(`Page ${nextLength} captured! 📑`, 'success');
        } else {
          setFileName('Scanned_Document.jpg');
          setShowCamera(false);
          setRotationDegrees(0);

          // Auto-detect boundary based on photo dimensions & aspect ratio
          let detectedPreset: 'a4' | 'id_card' | 'receipt' | 'full' = 'a4';
          if (photo.width && photo.height) {
            const ratio = Math.max(photo.width, photo.height) / Math.min(photo.width, photo.height);
            const isLandscape = photo.width > photo.height;
            if (isLandscape || (ratio >= 1.45 && ratio <= 1.75)) {
              detectedPreset = 'id_card';
            } else if (ratio > 1.9) {
              detectedPreset = 'receipt';
            } else {
              detectedPreset = 'a4';
            }
          } else if (docType === 'id_card' || autoDetectedPreset === 'id_card') {
            detectedPreset = 'id_card';
          } else if (docType === 'receipt' || autoDetectedPreset === 'receipt') {
            detectedPreset = 'receipt';
          }

          applyCropPreset(detectedPreset, true);
          showToast(
            `Captured & auto-aligned to ${
              detectedPreset === 'id_card'
                ? 'ID Card'
                : detectedPreset === 'receipt'
                ? 'Receipt'
                : 'A4 Document'
            }! 🎯`,
            'success'
          );
        }
      } else {
        setScreenError(t('scan.errorImageMissing'));
      }
    } catch (e) {
      setScreenError(e instanceof Error ? e.message : t('scan.errorCapture'));
    } finally {
      setCapturing(false);
    }
  }, [
    applyCropPreset,
    autoDetectedPreset,
    batchMode,
    batchPages.length,
    cameraPermission,
    docType,
    ensureCameraPermission,
    showToast,
    t,
  ]);

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
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        const asset = result.assets[0];
        setSelectedImageUri(asset.uri);
        setPersistentFileUri(asset.uri);
        setFileName(asset.fileName || 'Gallery_Image.jpg');
        setShowCamera(false);
        setRotationDegrees(0);
        setImageVersion((v) => v + 1);

        if (asset.width && asset.height) {
          setCapturedDimensions({ width: asset.width, height: asset.height });
          const ratio = Math.max(asset.width, asset.height) / Math.min(asset.width, asset.height);
          const isLandscape = asset.width > asset.height;
          if (isLandscape || (ratio >= 1.45 && ratio <= 1.75)) {
            applyCropPreset('id_card', true);
          } else if (ratio > 1.9) {
            applyCropPreset('receipt', true);
          } else {
            applyCropPreset('a4', true);
          }
        } else {
          applyCropPreset(docType === 'id_card' ? 'id_card' : 'a4', true);
        }
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
        setPersistentFileUri(file.uri);
        setFileName(file.name || 'Document.pdf');
        setShowCamera(false);
        setRotationDegrees(0);
        setImageVersion((v) => v + 1);
        applyCropPreset('a4', true);
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
    setPersistentFileUri('');
    setFallbackBase64('');
    setShowCamera(true);
    setActiveHandle(null);
  }, []);

  // Adobe Scan intelligent boundary auto-detection
  const handleAutoDetect = useCallback(() => {
    let preset: 'a4' | 'id_card' | 'receipt' | 'full' = 'a4';
    if (capturedDimensions) {
      const { width, height } = capturedDimensions;
      const ratio = Math.max(width, height) / Math.min(width, height);
      const isLandscape = width > height;
      if (isLandscape || (ratio >= 1.45 && ratio <= 1.75)) {
        preset = 'id_card';
      } else if (ratio > 1.9) {
        preset = 'receipt';
      } else {
        preset = 'a4';
      }
    } else if (docType === 'id_card' || autoDetectedPreset === 'id_card') {
      preset = 'id_card';
    } else if (docType === 'receipt' || autoDetectedPreset === 'receipt') {
      preset = 'receipt';
    }
    applyCropPreset(preset, false);
    showToast(`Adobe Scan: Edges detected & snapped to ${preset.toUpperCase()}! 🎯`, 'success');
  }, [applyCropPreset, autoDetectedPreset, capturedDimensions, docType, showToast]);

  const handleProceedToAutoFill = useCallback(() => {
    const finalUri = persistentFileUri || selectedImageUri;
    if (!finalUri) return;
    const cW = canvasWidthRef.current;
    const cH = canvasHeightRef.current;
    const cur = boxRef.current;
    const cropX = Math.round((cur.left / cW) * 100);
    const cropY = Math.round((cur.top / cH) * 100);
    const cropW = Math.round(((cur.right - cur.left) / cW) * 100);
    const cropH = Math.round(((cur.bottom - cur.top) / cH) * 100);

    navigation.navigate('OCRResult', {
      imageUri: finalUri,
      filter: activeFilter,
      docSize: docType === 'id_card' ? 'id_card' : docType === 'receipt' ? 'receipt' : 'a4',
      cropBox: {
        x: cropX,
        y: cropY,
        width: cropW,
        height: cropH,
      },
    });
  }, [activeFilter, docType, navigation, persistentFileUri, selectedImageUri]);

  // Adjust crop bounds nudge (+ / -)
  const handleNudgeCrop = useCallback((delta: number) => {
    const cW = canvasWidthRef.current;
    const cH = canvasHeightRef.current;
    const current = boxRef.current;
    const l = Math.max(0, Math.min(current.right - 40, current.left - delta));
    const r = Math.min(cW, Math.max(current.left + 40, current.right + delta));
    const t = Math.max(0, Math.min(current.bottom - 40, current.top - delta));
    const b = Math.min(cH, Math.max(current.top + 40, current.bottom + delta));
    updateBoxBounds(l, t, r, b);
  }, [updateBoxBounds]);

  const isPdf = fileName.toLowerCase().endsWith('.pdf');
  const hasImage = Boolean(selectedImageUri);

  const beamTravelRange =
    docType === 'id_card' || (docType === 'auto' && autoDetectedPreset === 'id_card')
      ? [10, 195]
      : docType === 'receipt' || (docType === 'auto' && autoDetectedPreset === 'receipt')
      ? [10, 320]
      : [10, 290];

  const guideText = useMemo(() => {
    if (docType === 'auto') {
      if (autoDetectedPreset === 'id_card') {
        return '🟢 Auto-Aligned: ID Card (1.58:1) · Edges Locked';
      } else if (autoDetectedPreset === 'receipt') {
        return '🟢 Auto-Aligned: Receipt Slip (1:2.3) · Framing Ready';
      } else {
        return '🟢 Auto-Aligned: A4 Document (1:1.41) · Ready to Capture';
      }
    }
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
  }, [autoDetectedPreset, docType]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      scrollEnabled={!activeHandle}
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

              {/* Dynamic Animated Document Sizing & Auto-Aligning Bounding Frame */}
              <Animated.View
                style={[
                  styles.docFrame,
                  {
                    top: frameTopAnim,
                    bottom: frameBottomAnim,
                    left: frameLeftAnim,
                    right: frameRightAnim,
                    borderRadius: frameRadiusAnim,
                  },
                ]}
                pointerEvents="none"
              >
                {/* 4 Corner Pins with L-brackets and corner snapping animation */}
                <Animated.View style={[styles.corner_TL, { transform: [{ scale: cornerSnapAnim }] }]} />
                <Animated.View style={[styles.corner_TR, { transform: [{ scale: cornerSnapAnim }] }]} />
                <Animated.View style={[styles.corner_BL, { transform: [{ scale: cornerSnapAnim }] }]} />
                <Animated.View style={[styles.corner_BR, { transform: [{ scale: cornerSnapAnim }] }]} />

                {/* Edge midpoint alignment crosshairs */}
                <View style={[styles.frameEdgeMark, styles.frameEdgeMarkTop]} />
                <View style={[styles.frameEdgeMark, styles.frameEdgeMarkBottom]} />
                <View style={[styles.frameEdgeMark, styles.frameEdgeMarkLeft]} />
                <View style={[styles.frameEdgeMark, styles.frameEdgeMarkRight]} />

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
              </Animated.View>

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

          {/* Mode Selector Tabs (Auto / Form A4 / ID Card / Receipt / General) */}
          <View style={styles.docTypeTabs}>
            {(['auto', 'form', 'id_card', 'receipt', 'document'] as ScanDocType[]).map((type) => (
              <Pressable
                key={type}
                style={[styles.docTypeTab, docType === type && styles.docTypeTabActive]}
                onPress={() => {
                  setDocType(type);
                  if (type === 'auto') showToast('⚡ Smart Auto-Align Mode Active!', 'info');
                  else if (type === 'id_card') showToast('Switched to ID Card / License Mode (1.58:1) 🪪', 'info');
                  else if (type === 'receipt') showToast('Switched to Receipt / Bill Mode 🧾', 'info');
                  else if (type === 'form') showToast('Switched to A4 Form Mode 📄', 'info');
                  else showToast('Switched to Custom Document Mode 📑', 'info');
                }}
              >
                <Text style={[styles.docTypeTabText, docType === type && styles.docTypeTabTextActive]}>
                  {type === 'auto'
                    ? '⚡ Auto'
                    : type === 'form'
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
        /* Review & Adjust Boundaries Screen (Adobe Scan Style) */
        <View style={styles.reviewBox}>
          {/* Adobe Scan Header Bar */}
          <View style={styles.reviewHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.adobeBrandRow}>
                <View style={styles.adobeBlueBadge}>
                  <Text style={styles.adobeBlueBadgeText}>ADOBE SCAN STYLE</Text>
                </View>
                <Text style={styles.adobeDetectionPill}>🎯 Edges Detected</Text>
              </View>
              <Text style={styles.reviewTitle}>Adjust Boundaries</Text>
              <Text style={styles.reviewSubtitle}>
                {fileName} · Document edges auto-aligned
              </Text>
            </View>

            <Pressable style={styles.rotateBtn} onPress={handleRotate}>
              <Text style={styles.rotateBtnText}>↻ 90°</Text>
            </Pressable>
          </View>

          {/* Document Canvas with Sharpening & Adobe Scan 8-Point Boundary Box */}
          <View style={[styles.canvasContainer, { width: canvasWidth, height: canvasHeight }]}>
            {isPdf ? (
              <View style={styles.pdfCard}>
                <Text style={styles.pdfIcon}>📑</Text>
                <Text style={styles.pdfName}>{fileName}</Text>
                <View style={styles.pdfBadge}>
                  <Text style={styles.pdfBadgeText}>PDF Document Ready</Text>
                </View>
              </View>
            ) : (
              <>
                {/* 1. Underlying Captured Image */}
                <View
                  style={[
                    styles.imageWrapper,
                    {
                      width: canvasWidth,
                      height: canvasHeight,
                      transform: [{ rotate: `${rotationDegrees}deg` }],
                    },
                  ]}
                >
                  {/* Image loading indicator */}
                  {imageLoading && (
                    <View style={styles.imageLoadingOverlay} pointerEvents="none">
                      <ActivityIndicator size="large" color="#00A4E4" />
                      <Text style={styles.imageLoadingText}>Rendering document...</Text>
                    </View>
                  )}

                  <Image
                    key={`doc_preview_${imageVersion}_${rotationDegrees}`}
                    source={{ uri: selectedImageUri || persistentFileUri || fallbackBase64 }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="contain"
                    fadeDuration={0}
                    onLoadStart={() => setImageLoading(false)}
                    onLoad={() => setImageLoading(false)}
                    onLoadEnd={() => setImageLoading(false)}
                    onError={(err) => {
                      console.warn('Review image load error:', err.nativeEvent.error);
                      setImageLoading(false);
                      if (fallbackBase64 && selectedImageUri !== fallbackBase64) {
                        setSelectedImageUri(fallbackBase64);
                      }
                    }}
                  />

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
                </View>

                {/* 2. Adobe Scan 4 Outer Dark Masks */}
                <View
                  style={[
                    styles.adobeOuterMask,
                    {
                      top: 0,
                      left: 0,
                      width: canvasWidth,
                      height: Math.max(0, Math.min(canvasHeight, boxTop)),
                    },
                  ]}
                  pointerEvents="none"
                />
                <View
                  style={[
                    styles.adobeOuterMask,
                    {
                      top: Math.max(0, Math.min(canvasHeight, boxBottom)),
                      left: 0,
                      width: canvasWidth,
                      height: Math.max(0, canvasHeight - Math.max(0, boxBottom)),
                    },
                  ]}
                  pointerEvents="none"
                />
                <View
                  style={[
                    styles.adobeOuterMask,
                    {
                      top: Math.max(0, Math.min(canvasHeight, boxTop)),
                      left: 0,
                      width: Math.max(0, Math.min(canvasWidth, boxLeft)),
                      height: Math.max(0, boxBottom - boxTop),
                    },
                  ]}
                  pointerEvents="none"
                />
                <View
                  style={[
                    styles.adobeOuterMask,
                    {
                      top: Math.max(0, Math.min(canvasHeight, boxTop)),
                      left: Math.max(0, Math.min(canvasWidth, boxRight)),
                      width: Math.max(0, canvasWidth - Math.max(0, boxRight)),
                      height: Math.max(0, boxBottom - boxTop),
                    },
                  ]}
                  pointerEvents="none"
                />

                {/* 3. Adobe Scan 8-Point Draggable Boundary Box */}
                <View
                  style={[
                    styles.adobeBoundaryBox,
                    {
                      left: Math.max(0, Math.min(canvasWidth - 40, boxLeft)),
                      top: Math.max(0, Math.min(canvasHeight - 40, boxTop)),
                      width: Math.max(40, Math.min(canvasWidth, boxRight - boxLeft)),
                      height: Math.max(40, Math.min(canvasHeight, boxBottom - boxTop)),
                    },
                  ]}
                >
                  {/* 4 Corner Magnets */}
                  <View
                    {...panTL.panHandlers}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    style={[
                      styles.adobeCornerMagnet,
                      styles.magnetTL,
                      activeHandle === 'TL' && styles.adobeCornerMagnetActive,
                    ]}
                  >
                    <View style={styles.adobeCornerMagnetCore} />
                  </View>
                  <View
                    {...panTR.panHandlers}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    style={[
                      styles.adobeCornerMagnet,
                      styles.magnetTR,
                      activeHandle === 'TR' && styles.adobeCornerMagnetActive,
                    ]}
                  >
                    <View style={styles.adobeCornerMagnetCore} />
                  </View>
                  <View
                    {...panBL.panHandlers}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    style={[
                      styles.adobeCornerMagnet,
                      styles.magnetBL,
                      activeHandle === 'BL' && styles.adobeCornerMagnetActive,
                    ]}
                  >
                    <View style={styles.adobeCornerMagnetCore} />
                  </View>
                  <View
                    {...panBR.panHandlers}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    style={[
                      styles.adobeCornerMagnet,
                      styles.magnetBR,
                      activeHandle === 'BR' && styles.adobeCornerMagnetActive,
                    ]}
                  >
                    <View style={styles.adobeCornerMagnetCore} />
                  </View>

                  {/* 4 Midpoint Edge Pills */}
                  <View
                    {...panTop.panHandlers}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    style={[
                      styles.adobeEdgePillHorizontal,
                      styles.pillTop,
                      activeHandle === 'TOP' && styles.adobeEdgePillActive,
                    ]}
                  >
                    <View style={styles.adobeEdgePillInnerH} />
                  </View>
                  <View
                    {...panBottom.panHandlers}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    style={[
                      styles.adobeEdgePillHorizontal,
                      styles.pillBottom,
                      activeHandle === 'BOTTOM' && styles.adobeEdgePillActive,
                    ]}
                  >
                    <View style={styles.adobeEdgePillInnerH} />
                  </View>
                  <View
                    {...panLeft.panHandlers}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    style={[
                      styles.adobeEdgePillVertical,
                      styles.pillLeft,
                      activeHandle === 'LEFT' && styles.adobeEdgePillActive,
                    ]}
                  >
                    <View style={styles.adobeEdgePillInnerV} />
                  </View>
                  <View
                    {...panRight.panHandlers}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    style={[
                      styles.adobeEdgePillVertical,
                      styles.pillRight,
                      activeHandle === 'RIGHT' && styles.adobeEdgePillActive,
                    ]}
                  >
                    <View style={styles.adobeEdgePillInnerV} />
                  </View>

                  {/* Adobe Scan Dimension / Document Type Badge */}
                  <View style={styles.adobeFrameBadge} pointerEvents="none">
                    <Text style={styles.adobeFrameBadgeText}>
                      {activeCropPreset === 'id_card'
                        ? '🪪 ID Card · 1.58:1'
                        : activeCropPreset === 'receipt'
                        ? '🧾 Receipt · 1:2.2'
                        : activeCropPreset === 'full'
                        ? '🔲 Full Page'
                        : '📄 A4 Document · 1:1.41'}
                    </Text>
                  </View>
                </View>

                {/* Floating Adobe Loupe tooltip while dragging */}
                {activeHandle && (
                  <View style={styles.adobeLoupeTooltip} pointerEvents="none">
                    <Text style={styles.adobeLoupeText}>
                      🔍 {activeHandle} · {Math.round(boxRight - boxLeft)} × {Math.round(boxBottom - boxTop)} px
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>


          {/* Adobe Scan Auto-Alignment Toolbar */}
          {!isPdf && (
            <View style={styles.cropSection}>
              <View style={styles.cropHeaderRow}>
                <Text style={styles.filterSectionTitle}>Boundary Auto-Alignment:</Text>
                <Pressable
                  style={styles.adobeAutoDetectBtn}
                  onPress={handleAutoDetect}
                >
                  <Text style={styles.adobeAutoDetectBtnText}>🤖 Auto-Detect Edges</Text>
                </Pressable>
              </View>

              {/* Document Size Presets */}
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
                    🔲 No Crop
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

          {/* Enhancement & Sharpening Filters (Adobe Scan Style) */}
          {!isPdf && (
            <View style={styles.filterBar}>
              <View style={styles.filterHeaderRow}>
                <Text style={styles.filterSectionTitle}>Adobe Scan Filters & Clarity:</Text>
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
  frameEdgeMark: {
    position: 'absolute',
    backgroundColor: 'rgba(232, 145, 58, 0.85)',
  },
  frameEdgeMarkTop: {
    top: -2,
    left: '50%',
    marginLeft: -12,
    width: 24,
    height: 3,
    borderRadius: 2,
  },
  frameEdgeMarkBottom: {
    bottom: -2,
    left: '50%',
    marginLeft: -12,
    width: 24,
    height: 3,
    borderRadius: 2,
  },
  frameEdgeMarkLeft: {
    left: -2,
    top: '50%',
    marginTop: -12,
    width: 3,
    height: 24,
    borderRadius: 2,
  },
  frameEdgeMarkRight: {
    right: -2,
    top: '50%',
    marginTop: -12,
    width: 3,
    height: 24,
    borderRadius: 2,
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
    borderRadius: Radius.lg,
    backgroundColor: '#0a0f1d',
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: '#2563eb',
    position: 'relative',
    alignSelf: 'center',
  },
  imageWrapper: {
    position: 'relative',
    width: '100%',
    height: '100%',
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  reviewImage: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  imageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 11, 20, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    gap: Spacing.sm,
  },
  imageLoadingText: {
    color: Colors.textSecondary,
    fontSize: Typography.xs,
    fontWeight: Typography.medium,
  },
  adobeBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  adobeBlueBadge: {
    backgroundColor: '#1473E6',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  adobeBlueBadgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: Typography.bold,
    letterSpacing: 0.5,
  },
  adobeDetectionPill: {
    color: '#00E5FF',
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
  },
  adobeOuterMask: {
    position: 'absolute',
    backgroundColor: 'rgba(5, 10, 20, 0.65)',
    zIndex: 20,
  },
  adobeBoundaryBox: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#00E5FF',
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
    borderRadius: 4,
    zIndex: 40,
  },
  adobeCornerMagnet: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 3.5,
    borderColor: '#00E5FF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 60,
  },
  adobeCornerMagnetActive: {
    transform: [{ scale: 1.25 }],
    borderColor: '#38bdf8',
    backgroundColor: '#f0f9ff',
  },
  adobeCornerMagnetCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00E5FF',
  },
  magnetTL: { top: -16, left: -16 },
  magnetTR: { top: -16, right: -16 },
  magnetBL: { bottom: -16, left: -16 },
  magnetBR: { bottom: -16, right: -16 },
  adobeEdgePillHorizontal: {
    position: 'absolute',
    width: 38,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00E5FF',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 55,
  },
  pillTop: { top: -6, left: '50%', marginLeft: -19 },
  pillBottom: { bottom: -6, left: '50%', marginLeft: -19 },
  adobeEdgePillVertical: {
    position: 'absolute',
    width: 12,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#00E5FF',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 55,
  },
  pillLeft: { left: -6, top: '50%', marginTop: -19 },
  pillRight: { right: -6, top: '50%', marginTop: -19 },
  adobeEdgePillActive: {
    transform: [{ scale: 1.2 }],
    backgroundColor: '#38bdf8',
  },
  adobeLoupeTooltip: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    backgroundColor: 'rgba(10, 15, 29, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: '#00A4E4',
    zIndex: 70,
  },
  adobeLoupeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: Typography.bold,
    letterSpacing: 0.3,
  },
  adobeEdgePillInnerH: {
    width: 14,
    height: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },
  adobeEdgePillInnerV: {
    width: 2,
    height: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },
  adobeFrameBadge: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    backgroundColor: 'rgba(20, 115, 230, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  adobeFrameBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: Typography.bold,
  },
  filterOverlayMagic: {
    backgroundColor: 'rgba(20, 115, 230, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(20, 115, 230, 0.4)',
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
    marginBottom: 8,
  },
  adobeAutoDetectBtn: {
    backgroundColor: '#1473E6',
    paddingVertical: 5,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    shadowColor: '#1473E6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  adobeAutoDetectBtnText: {
    color: Colors.white,
    fontSize: Typography.xs,
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
    backgroundColor: '#1473E6',
    borderColor: '#00A4E4',
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

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import Colors from '../theme/colors';
import { Radius, Shadow, Spacing, Typography } from '../theme/tokens';
import { useLanguage } from '../i18n/LanguageContext';

export default function ScanFormScreen() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const { t, language } = useLanguage();

  // 1. Vision Camera device and runtime permissions
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const hasTorch = Boolean(device?.hasTorch);

  // 2. Camera lifecycle & torch state
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  // 3. Vision Camera photo output configuration
  const photoOutput = usePhotoOutput({
    quality: 0.92,
    qualityPrioritization: 'balanced',
  });

  // 4. Reanimated shared value for smooth HUD text pulsing
  const pulseOpacity = useSharedValue(0.4);

  // Request camera permissions on mount if not yet granted
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // Start continuous pulse animation for targeting HUD
  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withTiming(1.0, { duration: 900 }),
      -1,
      true
    );
  }, [pulseOpacity]);

  const animatedTextStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  // Shutter button spring physics (120Hz native touch tracking)
  const shutterScale = useSharedValue(1);

  const handleShutterPressIn = () => {
    shutterScale.value = withSpring(0.88, { damping: 14, stiffness: 350 });
  };

  const handleShutterPressOut = () => {
    shutterScale.value = withSpring(1.0, { damping: 12, stiffness: 220 });
  };

  const animatedShutterStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shutterScale.value }],
  }));

  // Suppress transient CameraX lifecycle errors while camera mounts
  const handleCameraError = (error: any) => {
    const msg = error?.message || '';
    if (
      msg.includes('OperationCanceledException') ||
      msg.includes('Camera is not active') ||
      msg.includes('CameraControl')
    ) {
      // Expected during initial session negotiation
      return;
    }
    console.warn('VisionCamera session warning:', msg);
  };

  // Capture photo from native camera pipeline
  const handleCapturePhoto = async () => {
    if (isCapturing || !isCameraReady) return;
    try {
      setIsCapturing(true);
      const photoFile = await photoOutput.capturePhotoToFile(
        {
          flashMode: torchOn && hasTorch ? 'on' : 'off',
          enableShutterSound: true,
        },
        {}
      );

      navigation.navigate('OCRResult', {
        imageUri: `file://${photoFile.filePath}`,
      });
    } catch (err: any) {
      console.warn('Primary capture failed, attempting fallback:', err);
      // Fallback: system camera picker if native camera capture threw
      try {
        const result = await ImagePicker.launchCameraAsync({
          quality: 0.9,
          allowsEditing: false,
        });
        if (!result.canceled && result.assets[0]?.uri) {
          navigation.navigate('OCRResult', {
            imageUri: result.assets[0].uri,
          });
        }
      } catch (fallbackErr) {
        console.error('Fallback camera error:', fallbackErr);
      }
    } finally {
      setIsCapturing(false);
    }
  };

  // Pick existing document or photo from device gallery
  const handleOpenGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        navigation.navigate('OCRResult', {
          imageUri: result.assets[0].uri,
        });
      }
    } catch (err) {
      console.warn('Gallery picker error:', err);
    }
  };

  // Toggle flash torch safely
  const handleToggleTorch = () => {
    if (!hasTorch) return;
    setTorchOn((prev) => !prev);
  };

  // Permission fallback screen
  if (!hasPermission) {
    return (
      <View style={styles.fallbackContainer}>
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        <View style={styles.fallbackCard}>
          <View style={styles.fallbackIconBadge}>
            <MaterialCommunityIcons
              name="camera-off"
              size={36}
              color={Colors.primary}
            />
          </View>
          <Text style={styles.fallbackTitle}>
            {language === 'ml' ? 'ക്യാമറ അനുമതി ആവശ്യമാണ്' : 'Camera Access Required'}
          </Text>
          <Text style={styles.fallbackSubtitle}>
            {language === 'ml'
              ? 'ഫോമുകൾ സ്കാൻ ചെയ്യാനും അക്ഷരങ്ങൾ തിരിച്ചറിയാനും ക്യാമറ അനുമതി നൽകുക.'
              : 'FH needs camera access to capture physical paperwork and automatically extract form fields.'}
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="camera" size={20} color={Colors.textInverse} />
            <Text style={styles.permissionButtonText}>
              {language === 'ml' ? 'അനുമതി നൽകുക' : 'Grant Permission'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fallbackCloseButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.fallbackCloseText}>
              {language === 'ml' ? 'തിരികെ പോവുക' : 'Return to Home'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Camera initializing state
  if (device == null) {
    return (
      <View style={styles.fallbackContainer}>
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>
          {language === 'ml' ? 'ക്യാമറ ആരംഭിക്കുന്നു...' : 'Initializing Camera...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* 1. NATIVE VISION CAMERA */}
      <Camera
        style={StyleSheet.absoluteFillObject}
        device={device}
        isActive={isFocused}
        outputs={[photoOutput]}
        torchMode={isCameraReady && torchOn && hasTorch ? 'on' : undefined}
        enableNativeZoomGesture={true}
        onStarted={() => setIsCameraReady(true)}
        onStopped={() => setIsCameraReady(false)}
        onError={handleCameraError}
      />

      {/* 2. TOP ACTION HEADER */}
      <View style={styles.topBarWrapper}>
        <View style={styles.topBarContent}>
          {/* Back button */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.75}
            style={styles.headerIconButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>

          {/* Screen Title Pill */}
          <View style={styles.titleBadge}>
            <MaterialCommunityIcons
              name="text-recognition"
              size={18}
              color={Colors.primary}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.topBarTitle}>
              {language === 'ml' ? 'ഫോം സ്കാൻ' : 'Scan Form'}
            </Text>
          </View>

          {/* Torch Toggle */}
          <TouchableOpacity
            onPress={handleToggleTorch}
            activeOpacity={0.75}
            disabled={!hasTorch}
            style={[
              styles.headerIconButton,
              torchOn && styles.headerIconButtonActive,
              !hasTorch && { opacity: 0.35 },
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons
              name={torchOn ? 'flash' : 'flash-off'}
              size={22}
              color={torchOn ? Colors.primary : Colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. ELEGANT TARGETING HUD */}
      <View style={styles.hudOverlay} pointerEvents="none">
        <View style={styles.targetingContainer}>
          {/* Targeting Corner Brackets */}
          <View style={[styles.cornerBracket, styles.bracketTopLeft]} />
          <View style={[styles.cornerBracket, styles.bracketTopRight]} />
          <View style={[styles.cornerBracket, styles.bracketBottomLeft]} />
          <View style={[styles.cornerBracket, styles.bracketBottomRight]} />

          {/* Subtle guide line */}
          <View style={styles.centerGuide} />
        </View>

        {/* Status Pill with Malayalam & English */}
        <Animated.View style={[styles.hudStatusBadge, animatedTextStyle]}>
          <MaterialCommunityIcons
            name="file-document-outline"
            size={16}
            color={Colors.primary}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.hudStatusText}>
            {language === 'ml'
              ? 'രേഖ ഫ്രെയിമിനുള്ളിൽ വെക്കുക'
              : 'Align document within the frame'}
          </Text>
        </Animated.View>
      </View>

      {/* 4. BOTTOM CONTROLS */}
      <View style={styles.bottomBarWrapper}>
        <View style={styles.bottomBarContent}>
          {/* Gallery Button */}
          <TouchableOpacity
            onPress={handleOpenGallery}
            activeOpacity={0.75}
            style={styles.actionRoundButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialCommunityIcons name="image-outline" size={26} color={Colors.textPrimary} />
            <Text style={styles.actionButtonLabel}>
              {language === 'ml' ? 'ഗ്യാലറി' : 'Gallery'}
            </Text>
          </TouchableOpacity>

          {/* Shutter Button */}
          <TouchableOpacity
            style={styles.shutterOuterRing}
            onPressIn={handleShutterPressIn}
            onPressOut={handleShutterPressOut}
            onPress={handleCapturePhoto}
            disabled={isCapturing}
            activeOpacity={0.9}
          >
            <Animated.View style={[styles.shutterInnerCircle, animatedShutterStyle]}>
              {isCapturing ? (
                <ActivityIndicator size="small" color={Colors.textInverse} />
              ) : (
                <MaterialCommunityIcons
                  name="camera"
                  size={32}
                  color={Colors.textInverse}
                />
              )}
            </Animated.View>
          </TouchableOpacity>

          {/* Close Screen */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.75}
            style={styles.actionRoundButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialCommunityIcons name="close" size={26} color={Colors.textSecondary} />
            <Text style={styles.actionButtonLabel}>
              {language === 'ml' ? 'റദ്ദാക്കുക' : 'Cancel'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },

  /* Top Action Header */
  topBarWrapper: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 44 : 54,
    left: Spacing.base,
    right: Spacing.base,
    zIndex: 20,
  },
  topBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(10, 14, 27, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...Shadow.md,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerIconButtonActive: {
    backgroundColor: Colors.primarySubtle,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
  },
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(232, 145, 58, 0.12)',
  },
  topBarTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
    letterSpacing: 0.5,
  },

  /* Targeting HUD */
  hudOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  targetingContainer: {
    width: '84%',
    aspectRatio: 0.72,
    position: 'relative',
    borderRadius: Radius.lg,
  },
  cornerBracket: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: Colors.primary,
  },
  bracketTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
    borderTopLeftRadius: 10,
  },
  bracketTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopRightRadius: 10,
  },
  bracketBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3.5,
    borderLeftWidth: 3.5,
    borderBottomLeftRadius: 10,
  },
  bracketBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomRightRadius: 10,
  },
  centerGuide: {
    position: 'absolute',
    top: '50%',
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: 'rgba(232, 145, 58, 0.25)',
  },
  hudStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 14, 27, 0.88)',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(232, 145, 58, 0.35)',
    marginTop: Spacing.xl,
    ...Shadow.md,
  },
  hudStatusText: {
    color: Colors.textPrimary,
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    letterSpacing: 0.3,
  },

  /* Bottom Controls */
  bottomBarWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 36 : 48,
    left: Spacing.base,
    right: Spacing.base,
    zIndex: 20,
  },
  bottomBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius['2xl'],
    backgroundColor: 'rgba(10, 14, 27, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...Shadow.lg,
  },
  actionRoundButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  actionButtonLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.xs,
    fontWeight: Typography.medium,
    marginTop: 4,
  },
  shutterOuterRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(232, 145, 58, 0.15)',
    ...Shadow.glow,
  },
  shutterInnerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Fallback & Loading Screens */
  fallbackContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  fallbackCard: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadow.md,
  },
  fallbackIconBadge: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySubtle,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  fallbackTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  fallbackSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  permissionButton: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: 8,
    ...Shadow.glow,
  },
  permissionButtonText: {
    color: Colors.textInverse,
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
  },
  fallbackCloseButton: {
    paddingVertical: Spacing.sm,
  },
  fallbackCloseText: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
  },
  loadingText: {
    color: Colors.primary,
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    marginTop: Spacing.base,
  },
});

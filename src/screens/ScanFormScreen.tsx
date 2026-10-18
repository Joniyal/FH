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
} from 'react-native-vision-camera';
import { BlurView } from '@react-native-community/blur';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

export default function ScanFormScreen() {
  const navigation = useNavigation<any>();

  // 1. Vision Camera hooks for device and runtime permissions
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');

  // Flash / Torch state toggle
  const [torchOn, setTorchOn] = useState<boolean>(false);

  // 2. Reanimated shared value for smooth HUD text pulsing
  const pulseOpacity = useSharedValue(0.3);

  // Request camera permissions on mount if not yet granted
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // Start continuous infinite pulse animation (0.3 <-> 1.0)
  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withTiming(1.0, { duration: 1000 }),
      -1,
      true
    );
  }, [pulseOpacity]);

  // Animated style binding for HUD status text
  const animatedTextStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  // Handle Pick Document / Image from device gallery
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

  // 1. Fallback screen if camera permission is denied
  if (!hasPermission) {
    return (
      <View style={styles.fallbackContainer}>
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        <View style={styles.fallbackCard}>
          <Feather name="camera-off" size={48} color="#00E5FF" style={styles.fallbackIcon} />
          <Text style={styles.fallbackTitle}>CAMERA ACCESS REQUIRED</Text>
          <Text style={styles.fallbackSubtitle}>
            To engage the AI targeting scanner and digitize your documents, please grant camera permissions.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
            activeOpacity={0.8}
          >
            <Text style={styles.permissionButtonText}>ENABLE SENSORS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fallbackCloseButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.fallbackCloseText}>RETURN TO DASHBOARD</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 2. Fallback loader if camera device is initializing
  if (device == null) {
    return (
      <View style={styles.fallbackContainer}>
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        <ActivityIndicator size="large" color="#00E5FF" />
        <Text style={styles.loadingText}>INITIALIZING OPTICAL SENSORS...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* 2. ROOT CONTAINER & STATUS BAR */}
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* 3. LAYER 0: THE CAMERA */}
      <Camera
        style={StyleSheet.absoluteFillObject}
        device={device}
        isActive={true}
        torchMode={torchOn ? 'on' : 'off'}
        enableNativeZoomGesture={true}
      />

      {/* 4. LAYER 1: TOP ACTION BAR (FROSTED PILL) */}
      <View style={styles.topBarWrapper}>
        <BlurView
          blurType="dark"
          blurAmount={60}
          overlayColor="rgba(10, 15, 29, 0.65)"
          style={styles.topBarBlur}
        >
          {/* Left: Flash / Torch Toggle */}
          <TouchableOpacity
            onPress={() => setTorchOn((prev) => !prev)}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather
              name="zap"
              size={22}
              color={torchOn ? '#00E5FF' : '#FFFFFF'}
            />
          </TouchableOpacity>

          {/* Center: AI Scanner Brand */}
          <Text style={styles.topBarTitle}>AI SCANNER</Text>

          {/* Right: Sliders / Settings Icon */}
          <TouchableOpacity
            onPress={() => {}}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="sliders" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </BlurView>
      </View>

      {/* 5. LAYER 2: THE CYBER CYAN TARGETING HUD */}
      <View style={styles.hudOverlay} pointerEvents="none">
        <View style={styles.targetingContainer}>
          {/* Top-Left Corner Bracket */}
          <View style={[styles.cornerBracket, styles.bracketTopLeft]} />

          {/* Top-Right Corner Bracket */}
          <View style={[styles.cornerBracket, styles.bracketTopRight]} />

          {/* Bottom-Left Corner Bracket */}
          <View style={[styles.cornerBracket, styles.bracketBottomLeft]} />

          {/* Bottom-Right Corner Bracket */}
          <View style={[styles.cornerBracket, styles.bracketBottomRight]} />
        </View>

        {/* Pulsing Status Text */}
        <Animated.Text style={[styles.hudStatusText, animatedTextStyle]}>
          DETECTING DOCUMENT...
        </Animated.Text>
      </View>

      {/* 6. LAYER 3: BOTTOM CONTROL BAR (FROSTED PILL) */}
      <View style={styles.bottomBarWrapper}>
        <BlurView
          blurType="dark"
          blurAmount={60}
          overlayColor="rgba(10, 15, 29, 0.65)"
          style={styles.bottomBarBlur}
        >
          {/* Left: Gallery Icon */}
          <TouchableOpacity
            onPress={handleOpenGallery}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="image" size={28} color="#AAAAAA" />
          </TouchableOpacity>

          {/* Center: Cyber Shutter Button */}
          <TouchableOpacity
            style={styles.shutterOuterRing}
            onPress={() => {}}
            activeOpacity={0.85}
          >
            <View style={styles.shutterInnerCircle} />
          </TouchableOpacity>

          {/* Right: Close Screen */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="x" size={28} color="#AAAAAA" />
          </TouchableOpacity>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },

  /* LAYER 1: Top Action Bar */
  topBarWrapper: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    width: '90%',
    zIndex: 10,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
    backgroundColor: 'rgba(10, 15, 29, 0.75)',
  },
  topBarBlur: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    fontFamily: Platform.OS === 'android' ? 'sans-serif-medium' : 'System',
  },

  /* LAYER 2: Targeting HUD */
  hudOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  targetingContainer: {
    width: '80%',
    aspectRatio: 0.75,
    position: 'relative',
  },
  cornerBracket: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#00E5FF',
    shadowColor: '#00E5FF',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  bracketTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  bracketTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bracketBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bracketBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  hudStatusText: {
    color: '#00E5FF',
    fontSize: 12,
    letterSpacing: 1.5,
    marginTop: 30,
    textAlign: 'center',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 229, 255, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },

  /* LAYER 3: Bottom Control Bar */
  bottomBarWrapper: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    width: '85%',
    zIndex: 10,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
    backgroundColor: 'rgba(10, 15, 29, 0.75)',
  },
  bottomBarBlur: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 40,
  },
  shutterOuterRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: '#00E5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInnerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#00E5FF',
    shadowColor: '#00E5FF',
    shadowRadius: 8,
    shadowOpacity: 0.8,
    elevation: 8,
  },

  /* Fallback & Loading Screens */
  fallbackContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  fallbackCard: {
    width: '100%',
    backgroundColor: '#0A0F1D',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    padding: 28,
    alignItems: 'center',
    shadowColor: '#00E5FF',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  fallbackIcon: {
    marginBottom: 16,
  },
  fallbackTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'System',
  },
  fallbackSubtitle: {
    color: '#8A99AD',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    width: '100%',
    backgroundColor: '#00E5FF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#00E5FF',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  permissionButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  fallbackCloseButton: {
    paddingVertical: 10,
  },
  fallbackCloseText: {
    color: '#5A6E85',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  loadingText: {
    color: '#00E5FF',
    fontSize: 12,
    letterSpacing: 1.5,
    marginTop: 18,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'System',
  },
});

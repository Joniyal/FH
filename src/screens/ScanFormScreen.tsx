import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { useLanguage } from '../i18n/LanguageContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanForm'>;

export default function ScanFormScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [selectedImageUri, setSelectedImageUri] = useState<string>('');
  const [showCamera, setShowCamera] = useState<boolean>(true);
  const [capturing, setCapturing] = useState<boolean>(false);
  const [screenError, setScreenError] = useState<string>('');
  const [showSettingsButton, setShowSettingsButton] = useState<boolean>(false);

  // Ask for camera permission if not granted.
  const ensureCameraPermission = async (): Promise<boolean> => {
    if (cameraPermission?.granted) {
      return true;
    }

    if (cameraPermission && !cameraPermission.canAskAgain) {
      return false;
    }

    const permission = await requestCameraPermission();
    return permission.granted;
  };

  // Capture a form image using the camera.
  const handleCapture = async () => {
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
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        setSelectedImageUri(photo.uri);
        setShowCamera(false);
      } else {
        setScreenError(t('scan.errorImageMissing'));
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : t('scan.errorCapture');
      setScreenError(message);
    } finally {
      setCapturing(false);
    }
  };

  // Pick a form image from gallery.
  const handlePickFromGallery = async () => {
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setSelectedImageUri(result.assets[0].uri);
        setShowCamera(false);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : t('scan.errorGalleryOpen');
      setScreenError(message);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.heading}>{t('scan.heading')}</Text>
      <Text style={styles.subHeading}>{t('scan.subHeading')}</Text>

      {screenError ? (
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>{screenError}</Text>

          {showSettingsButton && (
            <Pressable style={styles.settingsButton} onPress={() => Linking.openSettings()}>
              <Text style={styles.settingsButtonText}>{t('scan.openSettings')}</Text>
            </Pressable>
          )}
        </View>
      ) : null}

      {/* Camera section */}
      {showCamera ? (
        <View style={styles.cameraWrapper}>
          {cameraPermission === null ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.text}>{t('scan.checkingPermission')}</Text>
            </View>
          ) : cameraPermission?.granted ? (
            <CameraView ref={cameraRef} style={styles.camera} facing="back" />
          ) : (
            <View style={styles.centerBox}>
              <Text style={styles.text}>{t('scan.cameraPermissionRequired')}</Text>
              <Pressable style={styles.primaryButton} onPress={requestCameraPermission}>
                <Text style={styles.primaryButtonText}>{t('scan.grantPermission')}</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.previewWrapper}>
          {selectedImageUri ? (
            <Image source={{ uri: selectedImageUri }} style={styles.previewImage} />
          ) : (
            <Text style={styles.text}>{t('scan.previewUnavailable')}</Text>
          )}
        </View>
      )}

      {/* Action buttons */}
      <Pressable
        style={[styles.primaryButton, capturing && styles.buttonDisabled]}
        onPress={handleCapture}
        disabled={capturing}
        accessibilityRole="button"
      >
        <Text style={styles.primaryButtonText}>
          {capturing ? t('scan.capturing') : t('scan.capture')}
        </Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={handlePickFromGallery}>
        <Text style={styles.secondaryButtonText}>{t('scan.pickGallery')}</Text>
      </Pressable>

      <Pressable
        style={styles.secondaryButton}
        onPress={() => setShowCamera((prev) => !prev)}
      >
        <Text style={styles.secondaryButtonText}>
          {showCamera ? t('scan.showPreview') : t('scan.openCamera')}
        </Text>
      </Pressable>

      <Pressable
        style={[styles.primaryButton, !selectedImageUri && styles.buttonDisabled]}
        disabled={!selectedImageUri}
        onPress={() => navigation.navigate('OCRResult', { imageUri: selectedImageUri })}
      >
        <Text style={styles.primaryButtonText}>{t('scan.toOcr')}</Text>
      </Pressable>
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
    paddingBottom: 24,
  },
  heading: {
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 6,
    color: '#0F172A',
  },
  subHeading: {
    fontSize: 18,
    lineHeight: 26,
    color: '#334155',
    marginBottom: 10,
  },
  cameraWrapper: {
    height: 320,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
    backgroundColor: '#E2E8F0',
  },
  errorBlock: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsButton: {
    marginTop: 8,
    backgroundColor: '#991B1B',
    borderRadius: 10,
    paddingVertical: 10,
  },
  settingsButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
  },
  camera: {
    flex: 1,
  },
  previewWrapper: {
    height: 320,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  primaryButton: {
    backgroundColor: '#1D4ED8',
    paddingVertical: 18,
    borderRadius: 16,
    marginBottom: 10,
  },
  primaryButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 10,
  },
  secondaryButtonText: {
    fontSize: 21,
    color: '#0F172A',
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  text: {
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
  },
});

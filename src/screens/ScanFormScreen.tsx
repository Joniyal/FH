import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanForm'>;

export default function ScanFormScreen({ navigation }: Props) {
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [selectedImageUri, setSelectedImageUri] = useState<string>('');
  const [showCamera, setShowCamera] = useState<boolean>(true);
  const [capturing, setCapturing] = useState<boolean>(false);
  const [screenError, setScreenError] = useState<string>('');

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
          setScreenError('ക്യാമറ അനുമതി Settingsൽ നിന്ന് അനുവദിക്കുക.');
        } else {
          setScreenError('ക്യാമറ അനുമതി നൽകിയിട്ടില്ല.');
        }
        return;
      }

      setCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        setSelectedImageUri(photo.uri);
        setShowCamera(false);
      } else {
        setScreenError('ചിത്രം ലഭിച്ചില്ല. വീണ്ടും ശ്രമിക്കുക.');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'ചിത്രം എടുക്കുമ്പോൾ പിശക് സംഭവിച്ചു.';
      setScreenError(message);
    } finally {
      setCapturing(false);
    }
  };

  // Pick a form image from gallery.
  const handlePickFromGallery = async () => {
    try {
      setScreenError('');
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        if (!permission.canAskAgain) {
          setScreenError('ഗാലറി അനുമതി Settingsൽ നിന്ന് അനുവദിക്കുക.');
        } else {
          setScreenError('ഗാലറി അനുമതി നൽകിയിട്ടില്ല.');
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
      const message = e instanceof Error ? e.message : 'Gallery തുറക്കുമ്പോൾ പിശക് സംഭവിച്ചു.';
      setScreenError(message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>📷 ഫോം സ്കാൻ ചെയ്യുക</Text>
      <Text style={styles.subHeading}>ചിത്രം വ്യക്തമായി എടുക്കുക. എഴുത്ത് സമമായി കാണണം.</Text>

      {screenError ? (
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>{screenError}</Text>

          {(screenError.includes('settingsൽ നിന്ന്') ||
            screenError.toLowerCase().includes('settings')) && (
            <Pressable style={styles.settingsButton} onPress={() => Linking.openSettings()}>
              <Text style={styles.settingsButtonText}>Settings തുറക്കുക</Text>
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
              <Text style={styles.text}>അനുമതി പരിശോധിക്കുന്നു...</Text>
            </View>
          ) : cameraPermission?.granted ? (
            <CameraView ref={cameraRef} style={styles.camera} facing="back" />
          ) : (
            <View style={styles.centerBox}>
              <Text style={styles.text}>ക്യാമറ അനുമതി ആവശ്യമാണ്.</Text>
              <Pressable style={styles.primaryButton} onPress={requestCameraPermission}>
                <Text style={styles.primaryButtonText}>അനുമതി നൽകുക</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.previewWrapper}>
          {selectedImageUri ? (
            <Image source={{ uri: selectedImageUri }} style={styles.previewImage} />
          ) : (
            <Text style={styles.text}>Preview ലഭ്യമല്ല.</Text>
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
          {capturing ? 'പിടിക്കുന്നു...' : '📸 ചിത്രം എടുക്കുക'}
        </Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={handlePickFromGallery}>
        <Text style={styles.secondaryButtonText}>🖼️ Galleryയിൽ നിന്ന് തിരഞ്ഞെടുക്കുക</Text>
      </Pressable>

      <Pressable
        style={styles.secondaryButton}
        onPress={() => setShowCamera((prev) => !prev)}
      >
        <Text style={styles.secondaryButtonText}>
          {showCamera ? 'പ്രിവ്യൂ കാണിക്കുക' : 'ക്യാമറ തുറക്കുക'}
        </Text>
      </Pressable>

      <Pressable
        style={[styles.primaryButton, !selectedImageUri && styles.buttonDisabled]}
        disabled={!selectedImageUri}
        onPress={() => navigation.navigate('OCRResult', { imageUri: selectedImageUri })}
      >
        <Text style={styles.primaryButtonText}>➡️ OCR പ്രോസസിലേക്ക് പോകുക</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#FFFFFF',
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

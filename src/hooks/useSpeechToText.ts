import { useCallback, useState } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

type UseSpeechToTextResult = {
  transcript: string;
  listening: boolean;
  error: string;
  startListening: () => Promise<boolean>;
  stopListening: () => void;
  clearTranscript: () => void;
};

export function useSpeechToText(language: string = 'ml-IN'): UseSpeechToTextResult {
  const [transcript, setTranscript] = useState<string>('');
  const [listening, setListening] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Native speech recognition event listeners.
  useSpeechRecognitionEvent('start', () => {
    setListening(true);
    setError('');
  });

  useSpeechRecognitionEvent('end', () => {
    setListening(false);
  });

  useSpeechRecognitionEvent('result', (event) => {
    const topResult = event.results[0]?.transcript ?? '';
    if (topResult) {
      setTranscript(topResult);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    setError(event.message);
    setListening(false);
  });

  const startListening = useCallback(async () => {
    setError('');

    try {
      const available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
      if (!available) {
        setError('Speech recognition ഇപ്പോൾ ലഭ്യമല്ല.');
        return false;
      }

      let requiresOnDeviceRecognition = false;

      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        // Fallback path: microphone permission + on-device mode.
        const micPermission =
          await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync();

        if (!micPermission.granted) {
          setError('Microphone/Speech permission not granted.');
          return false;
        }

        requiresOnDeviceRecognition = true;
      }

      ExpoSpeechRecognitionModule.start({
        lang: language,
        interimResults: true,
        continuous: false,
        addsPunctuation: true,
        requiresOnDeviceRecognition,
      });

      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Speech recognition error';
      setError(message);
      return false;
    }
  }, [language]);

  const stopListening = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      setListening(false);
    }
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  return {
    transcript,
    listening,
    error,
    startListening,
    stopListening,
    clearTranscript,
  };
}

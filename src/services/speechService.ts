import * as Speech from 'expo-speech';

// Speak text in Malayalam for guided accessibility.
export function speakMalayalam(text: string): void {
  Speech.stop();
  Speech.speak(text, {
    language: 'ml-IN',
    rate: 0.92,
    pitch: 1.0,
  });
}

export function stopMalayalamSpeech(): void {
  Speech.stop();
}

import * as Speech from 'expo-speech';

export function speakText(text: string, language: string): void {
  Speech.stop();
  Speech.speak(text, {
    language,
    rate: 0.92,
    pitch: 1.0,
  });
}

// Speak text in Malayalam for guided accessibility.
export function speakMalayalam(text: string): void {
  speakText(text, 'ml-IN');
}

export function stopMalayalamSpeech(): void {
  Speech.stop();
}

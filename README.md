# FormVault

**Intelligent Document Scanning & OCR Application**

A React Native Android application that enables users to capture, digitize, and organize physical forms and documents with ease. FormVault combines optical character recognition (OCR), voice-to-text input, and secure storage to streamline document processing workflows.

## Features

- **📸 Smart Document Scanning**: Capture high-quality images of physical forms
- **🔍 OCR Technology**: Automatic field extraction and text recognition
- **🎤 Voice-to-Text Input**: Hands-free data entry using speech recognition
- **🔒 Personal Vault**: Secure local storage for sensitive documents
- **📋 Form Preview**: Review and edit extracted data before saving
- **⚡ Fast Processing**: Optimized performance for seamless user experience

## Tech Stack

- **React Native**: Cross-platform mobile development
- **TypeScript**: Type-safe codebase
- **Gradle**: Android build system
- **OCR Service**: Document text recognition
- **Speech Recognition**: Voice input processing

## Getting Started

### Prerequisites
- Node.js (v14+)
- Android SDK
- Gradle
- Java Development Kit (JDK)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Joniyal/FH.git
cd FH
```

2. Install dependencies:
```bash
npm install
```

3. Build the APK:
```bash
cd android
./gradlew assembleDebug
```

### Running on Device

Connect your Android device via USB and run:
```bash
cd android
./gradlew installDebug
```

Or install the APK manually:
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

## Project Structure

```
src/
├── components/      # Reusable UI components
├── screens/        # Application screens
├── services/       # Business logic (OCR, speech, storage)
├── hooks/         # Custom React hooks
├── types/         # TypeScript type definitions
└── utils/         # Helper functions and utilities
```

## Building for Production

Generate a release APK:
```bash
cd android
./gradlew assembleRelease
```

## Testing

Run test suite:
```bash
npm test
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues, questions, or suggestions, please open an issue on the GitHub repository.

---

**Made with ❤️ by Joniyal**

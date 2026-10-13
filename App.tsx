import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './src/screens/HomeScreen';
import ScanFormScreen from './src/screens/ScanFormScreen';
import OCRResultScreen from './src/screens/OCRResultScreen';
import PersonalVaultScreen from './src/screens/PersonalVaultScreen';
import FilledFormPreviewScreen from './src/screens/FilledFormPreviewScreen';
import FormHistoryScreen from './src/screens/FormHistoryScreen';
import { RootStackParamList } from './src/types/navigation';
import { LanguageProvider, useLanguage } from './src/i18n/LanguageContext';
import HeaderLanguageMenu from './src/components/HeaderLanguageMenu';
import Colors from './src/theme/colors';
import ErrorBoundary from './src/components/ErrorBoundary';
import { ToastProvider } from './src/components/Toast';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Custom dark navigation theme extending the default DarkTheme
const FHDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.bg,
    card: Colors.bgCard,
    text: Colors.textPrimary,
    border: Colors.border,
    primary: Colors.primary,
    notification: Colors.primary,
  },
};

function AppNavigator() {
  const { t } = useLanguage();

  return (
    <NavigationContainer theme={FHDarkTheme}>
      <StatusBar style="light" />

      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerTitleAlign: 'center',
          headerStyle: {
            backgroundColor: Colors.bgCard,
          },
          headerTintColor: Colors.textPrimary,
          headerRight: () => <HeaderLanguageMenu />,
          headerTitleStyle: {
            fontSize: 17,
            fontWeight: '700',
            color: Colors.textPrimary,
          },
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: Colors.bg,
          },
          // Smooth slide animation
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{
            title: t('screen.homeTitle'),
            // Home screen has no back button
            headerBackVisible: false,
          }}
        />
        <Stack.Screen
          name="ScanForm"
          component={ScanFormScreen}
          options={{ title: t('screen.scanTitle') }}
        />
        <Stack.Screen
          name="OCRResult"
          component={OCRResultScreen}
          options={{ title: t('screen.ocrTitle') }}
        />
        <Stack.Screen
          name="PersonalVault"
          component={PersonalVaultScreen}
          options={{ title: t('screen.vaultTitle') }}
        />
        <Stack.Screen
          name="FilledFormPreview"
          component={FilledFormPreviewScreen}
          options={{ title: t('screen.previewTitle') }}
        />
        <Stack.Screen
          name="FormHistory"
          component={FormHistoryScreen}
          options={{ title: 'Form History' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ToastProvider>
          <AppNavigator />
        </ToastProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

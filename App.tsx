import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './src/screens/HomeScreen';
import ScanFormScreen from './src/screens/ScanFormScreen';
import OCRResultScreen from './src/screens/OCRResultScreen';
import PersonalVaultScreen from './src/screens/PersonalVaultScreen';
import FilledFormPreviewScreen from './src/screens/FilledFormPreviewScreen';
import { RootStackParamList } from './src/types/navigation';
import { LanguageProvider, useLanguage } from './src/i18n/LanguageContext';
import HeaderLanguageMenu from './src/components/HeaderLanguageMenu';

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  const { t } = useLanguage();

  return (
    <NavigationContainer>
      <StatusBar style="dark" />

      {/* Main app navigation */}
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#E0E7FF' },
          headerRight: () => <HeaderLanguageMenu />,
          headerTitleStyle: {
            fontSize: 22,
            fontWeight: '700',
          },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: t('screen.homeTitle') }}
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppNavigator />
    </LanguageProvider>
  );
}

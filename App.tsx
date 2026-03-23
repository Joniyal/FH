import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './src/screens/HomeScreen';
import ScanFormScreen from './src/screens/ScanFormScreen';
import OCRResultScreen from './src/screens/OCRResultScreen';
import PersonalVaultScreen from './src/screens/PersonalVaultScreen';
import FilledFormPreviewScreen from './src/screens/FilledFormPreviewScreen';
import { RootStackParamList } from './src/types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="dark" />

      {/* Main app navigation */}
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#E0E7FF' },
          headerTitleStyle: {
            fontSize: 22,
            fontWeight: '700',
          },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'FH (ഫോം ഹെൽപ്പ്)' }}
        />
        <Stack.Screen
          name="ScanForm"
          component={ScanFormScreen}
          options={{ title: 'ഫോം സ്കാൻ' }}
        />
        <Stack.Screen
          name="OCRResult"
          component={OCRResultScreen}
          options={{ title: 'OCR ഫലം' }}
        />
        <Stack.Screen
          name="PersonalVault"
          component={PersonalVaultScreen}
          options={{ title: 'വ്യക്തിഗത വിവരങ്ങൾ' }}
        />
        <Stack.Screen
          name="FilledFormPreview"
          component={FilledFormPreviewScreen}
          options={{ title: 'പൂരിപ്പിച്ച ഫോം പ്രിവ്യൂ' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

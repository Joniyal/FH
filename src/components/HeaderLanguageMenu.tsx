import React from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';

export default function HeaderLanguageMenu() {
  const { language, setLanguage, t } = useLanguage();

  const openMenu = () => {
    Alert.alert(t('menu.selectLanguage'), '', [
      {
        text: `${language === 'en' ? '✓ ' : ''}${t('menu.english')}`,
        onPress: () => {
          void setLanguage('en');
        },
      },
      {
        text: `${language === 'ml' ? '✓ ' : ''}${t('menu.malayalam')}`,
        onPress: () => {
          void setLanguage('ml');
        },
      },
      {
        text: t('menu.cancel'),
        style: 'cancel',
      },
    ]);
  };

  return (
    <Pressable onPress={openMenu} style={styles.button} accessibilityRole="button">
      <Text style={styles.buttonText}>⋮</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  buttonText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
  },
});

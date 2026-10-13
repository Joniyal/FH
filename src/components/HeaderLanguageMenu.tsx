import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Colors from '../theme/colors';
import { Radius, Spacing, Typography } from '../theme/tokens';
import { useLanguage } from '../i18n/LanguageContext';

export default function HeaderLanguageMenu() {
  const { language, setLanguage } = useLanguage();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, tension: 300, friction: 10 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }).start();
  };

  const toggle = () => {
    const next = language === 'en' ? 'ml' : 'en';
    void setLanguage(next);
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={toggle}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.pill}
        accessibilityRole="button"
        accessibilityLabel="Switch language"
      >
        <View style={styles.row}>
          <Text style={[styles.label, language === 'en' && styles.active]}>EN</Text>
          <View style={styles.dividerDot} />
          <Text style={[styles.label, language === 'ml' && styles.active]}>മ</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.full,
    paddingVertical: 5,
    paddingHorizontal: Spacing.md,
    marginRight: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  label: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  active: {
    color: Colors.primaryLight,
    fontWeight: Typography.bold,
  },
  dividerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderLight,
  },
});

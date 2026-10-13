import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Colors from '../theme/colors';
import { Radius, Shadow, Spacing, Typography } from '../theme/tokens';

type LargeActionButtonProps = {
  label: string;
  subLabel?: string;
  icon?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
};

export default function LargeActionButton({
  label,
  subLabel,
  icon,
  onPress,
  variant = 'primary',
  disabled = false,
}: LargeActionButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  };

  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';

  return (
    <Animated.View style={[{ transform: [{ scale }] }, disabled && styles.disabled]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[
          styles.button,
          isPrimary && styles.buttonPrimary,
          isSecondary && styles.buttonSecondary,
          variant === 'ghost' && styles.buttonGhost,
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <View style={styles.content}>
          {icon ? (
            <View style={[styles.iconWrap, isPrimary && styles.iconWrapPrimary]}>
              <Text style={styles.icon}>{icon}</Text>
            </View>
          ) : null}
          <View style={styles.textBlock}>
            <Text style={[
              styles.text,
              isSecondary && styles.textSecondary,
              variant === 'ghost' && styles.textGhost,
            ]}>
              {label}
            </Text>
            {subLabel ? (
              <Text style={[
                styles.subText,
                isSecondary && styles.subTextSecondary,
              ]}>
                {subLabel}
              </Text>
            ) : null}
          </View>
          <Text style={[
            styles.arrow,
            isSecondary && styles.arrowSecondary,
          ]}>›</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.transparent,
  },
  buttonPrimary: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.borderAccent,
    ...Shadow.glow,
  },
  buttonSecondary: {
    backgroundColor: Colors.bgCard,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  buttonGhost: {
    backgroundColor: Colors.transparent,
    borderColor: Colors.borderLight,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapPrimary: {
    backgroundColor: Colors.primaryMuted,
  },
  icon: {
    fontSize: 22,
    lineHeight: 28,
  },
  textBlock: {
    flex: 1,
  },
  text: {
    color: Colors.textPrimary,
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    lineHeight: 26,
  },
  textSecondary: {
    color: Colors.textPrimary,
  },
  textGhost: {
    color: Colors.textSecondary,
  },
  subText: {
    color: Colors.primaryLight,
    fontSize: Typography.sm,
    marginTop: 3,
    lineHeight: 18,
  },
  subTextSecondary: {
    color: Colors.textSecondary,
  },
  arrow: {
    color: Colors.primaryLight,
    fontSize: 28,
    fontWeight: Typography.bold,
    lineHeight: 34,
  },
  arrowSecondary: {
    color: Colors.textMuted,
  },
  disabled: {
    opacity: 0.45,
  },
});

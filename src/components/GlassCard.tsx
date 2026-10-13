import React, { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Colors from '../theme/colors';
import { Radius, Shadow, Spacing } from '../theme/tokens';

type GlassCardProps = {
  children: ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'accent' | 'glow';
};

export default function GlassCard({
  children,
  style,
  variant = 'default',
}: GlassCardProps) {
  return (
    <View
      style={[
        styles.card,
        variant === 'accent' && styles.accentBorder,
        variant === 'glow' && styles.glowBorder,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgGlass,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: Spacing.base,
    marginBottom: Spacing.md,
    ...Shadow.md,
  },
  accentBorder: {
    borderColor: Colors.borderAccent,
  },
  glowBorder: {
    borderColor: Colors.primary,
    ...Shadow.glow,
  },
});

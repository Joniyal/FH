import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Colors from '../theme/colors';
import { Radius, Shadow, Spacing } from '../theme/tokens';

type GlassCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'accent' | 'glow';
  testID?: string;
};

export default function GlassCard({
  children,
  style,
  variant = 'default',
  testID,
}: GlassCardProps) {
  return (
    <View
      testID={testID}
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

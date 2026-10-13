import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Colors from '../theme/colors';
import { Typography } from '../theme/tokens';

type ProgressRingProps = {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  showPercentText?: boolean;
};

export default function ProgressRing({
  percentage,
  size = 76,
  strokeWidth = 6,
  color = Colors.primary,
  label,
  showPercentText = true,
}: ProgressRingProps) {
  const clampedPercent = Math.min(100, Math.max(0, Math.round(percentage)));
  const innerSize = size - strokeWidth * 2;

  // Modern pill-ring style badge
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Outer track */}
      <View
        style={[
          styles.outerTrack,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: Colors.borderLight,
          },
        ]}
      />

      {/* Progress highlight border (active color) */}
      <View
        style={[
          styles.outerTrack,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: color,
            borderTopColor: clampedPercent > 25 ? color : Colors.transparent,
            borderRightColor: clampedPercent > 50 ? color : Colors.transparent,
            borderBottomColor: clampedPercent > 75 ? color : Colors.transparent,
            borderLeftColor: clampedPercent > 5 ? color : Colors.transparent,
            transform: [{ rotate: '-45deg' }],
          },
        ]}
      />

      {/* Inner center content */}
      <View
        style={[
          styles.innerCircle,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
          },
        ]}
      >
        {showPercentText && (
          <Text style={[styles.percentText, { color }]}>{clampedPercent}%</Text>
        )}
        {label ? <Text style={styles.labelText}>{label}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  outerTrack: {
    position: 'absolute',
  },
  innerCircle: {
    backgroundColor: Colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  percentText: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
  },
  labelText: {
    fontSize: Typography.xs - 2,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 1,
  },
});

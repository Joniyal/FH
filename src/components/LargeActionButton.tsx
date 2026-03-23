import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

type LargeActionButtonProps = {
  label: string;
  subLabel?: string;
  onPress: () => void;
};

export default function LargeActionButton({
  label,
  subLabel,
  onPress,
}: LargeActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.text}>{label}</Text>
      {subLabel ? <Text style={styles.subText}>{subLabel}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    backgroundColor: '#1D4ED8',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E40AF',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  subText: {
    color: '#DBEAFE',
    fontSize: 16,
    marginTop: 6,
  },
});

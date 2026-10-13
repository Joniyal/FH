import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Colors from '../theme/colors';
import { Radius, Shadow, Spacing, Typography } from '../theme/tokens';

const STEPS = [
  {
    icon: '📷',
    title: 'Scan Any Paper Form',
    desc: 'Point your camera at any application form, college admission slip, or official document. Auto-detect borders and enhance clarity.',
  },
  {
    icon: '🔐',
    title: 'Offline Vault Protection',
    desc: 'Keep your name, phone number, address, and date of birth stored privately in your offline encrypted Vault. No cloud uploads.',
  },
  {
    icon: '⚡',
    title: 'Auto-Fill & Voice Assist',
    desc: 'Match blank form boxes automatically with your Vault data. Use voice recognition in English or Malayalam to answer missing questions.',
  },
];

type OnboardingModalProps = {
  visible: boolean;
  onDismiss: () => void;
};

export default function OnboardingModal({ visible, onDismiss }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState<number>(0);

  const isLast = currentStep === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onDismiss();
      setCurrentStep(0);
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleSkip = () => {
    onDismiss();
    setCurrentStep(0);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleSkip}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.stepIndicatorRow}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.stepDot,
                  i === currentStep && styles.stepDotActive,
                  i < currentStep && styles.stepDotDone,
                ]}
              />
            ))}
          </View>

          <View style={styles.contentBox}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>{STEPS[currentStep].icon}</Text>
            </View>
            <Text style={styles.title}>{STEPS[currentStep].title}</Text>
            <Text style={styles.desc}>{STEPS[currentStep].desc}</Text>
          </View>

          <View style={styles.actionRow}>
            <Pressable style={styles.skipBtn} onPress={handleSkip}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>

            <Pressable style={styles.nextBtn} onPress={handleNext}>
              <Text style={styles.nextText}>{isLast ? 'Get Started 🚀' : 'Next →'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.lg,
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: Spacing.lg,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.borderLight,
  },
  stepDotActive: {
    width: 24,
    backgroundColor: Colors.primary,
  },
  stepDotDone: {
    backgroundColor: Colors.success,
  },
  contentBox: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
  },
  iconText: {
    fontSize: 34,
  },
  title: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  desc: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  skipText: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
  nextBtn: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primary,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    ...Shadow.glow,
  },
  nextText: {
    color: Colors.white,
    fontSize: Typography.base,
    fontWeight: Typography.bold,
  },
});

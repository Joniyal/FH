import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Colors from '../theme/colors';
import { Radius, Shadow, Spacing, Typography } from '../theme/tokens';
import { PersonalFieldKey, PersonalVaultData } from '../types/app';

export type FormTemplate = {
  id: string;
  title: string;
  category: string;
  icon: string;
  description: string;
  requiredFields: PersonalFieldKey[];
};

export const COMMON_TEMPLATES: FormTemplate[] = [
  {
    id: 'college_admission',
    title: 'College Admission Form',
    category: 'Education',
    icon: '🎓',
    description: 'Standard Indian university admission and registration form.',
    requiredFields: ['name', 'dob', 'address', 'phone'],
  },
  {
    id: 'passport_india',
    title: 'Indian Passport Application',
    category: 'Government',
    icon: '🛂',
    description: 'Ministry of External Affairs Passport Seva Kendra application.',
    requiredFields: ['name', 'dob', 'address', 'phone'],
  },
  {
    id: 'job_application',
    title: 'Standard Job Application',
    category: 'Employment',
    icon: '💼',
    description: 'Candidate personal details and contact declaration form.',
    requiredFields: ['name', 'phone', 'address', 'dob'],
  },
  {
    id: 'driving_license',
    title: 'Driving License Learner Form',
    category: 'Transport',
    icon: '🚗',
    description: 'Parivahan Sarathi driving license application form.',
    requiredFields: ['name', 'dob', 'address', 'phone'],
  },
  {
    id: 'bank_account',
    title: 'Bank Account Opening (KYC)',
    category: 'Banking',
    icon: '🏦',
    description: 'Customer verification and account opening declaration.',
    requiredFields: ['name', 'address', 'phone', 'dob'],
  },
];

type QuickFillTemplatesModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelectTemplate: (template: FormTemplate) => void;
};

export default function QuickFillTemplatesModal({
  visible,
  onClose,
  onSelectTemplate,
}: QuickFillTemplatesModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Quick-fill Templates</Text>
              <Text style={styles.subtitle}>Select a common Indian form to auto-fill instantly</Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {COMMON_TEMPLATES.map((tpl) => (
              <Pressable
                key={tpl.id}
                style={styles.templateCard}
                onPress={() => onSelectTemplate(tpl)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.icon}>{tpl.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{tpl.title}</Text>
                    <Text style={styles.cardCategory}>{tpl.category}</Text>
                  </View>
                  <View style={styles.autoBadge}>
                    <Text style={styles.autoBadgeText}>⚡ Auto-fill</Text>
                  </View>
                </View>
                <Text style={styles.cardDesc}>{tpl.description}</Text>
                <View style={styles.fieldTagsRow}>
                  {tpl.requiredFields.map((f) => (
                    <View key={f} style={styles.fieldTag}>
                      <Text style={styles.fieldTagText}>• {f.toUpperCase()}</Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    maxHeight: '82%',
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.base,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
  },
  scroll: {
    marginBottom: Spacing.md,
  },
  templateCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: 6,
  },
  icon: {
    fontSize: 28,
  },
  cardTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  cardCategory: {
    fontSize: Typography.xs,
    color: Colors.textWarm,
  },
  autoBadge: {
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  autoBadgeText: {
    color: Colors.primaryLight,
    fontSize: Typography.xs - 2,
    fontWeight: Typography.bold,
  },
  cardDesc: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  fieldTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  fieldTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  fieldTagText: {
    color: Colors.textMuted,
    fontSize: Typography.xs - 2,
    fontWeight: Typography.medium,
  },
});

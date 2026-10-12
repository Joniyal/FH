import React, { useMemo, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PersonalFieldKey } from '../types/app';
import { RootStackParamList } from '../types/navigation';
import { DEFAULT_FIELD_POSITIONS } from '../utils/overlayLayout';
import { useLanguage } from '../i18n/LanguageContext';

type Props = NativeStackScreenProps<RootStackParamList, 'FilledFormPreview'>;

export default function FilledFormPreviewScreen({ route }: Props) {
  const { t } = useLanguage();
  const fieldLabels: Record<PersonalFieldKey, string> = {
    name: t('field.name'),
    address: t('field.address'),
    phone: t('field.phone'),
    dob: t('field.dob'),
  };

  const imageUri = route.params?.imageUri;
  const filledFields = route.params?.filledFields ?? {};
  const hasAnyFilledValue = (Object.values(filledFields) as string[]).some((value) =>
    Boolean(value?.trim())
  );

  const [canvasWidth, setCanvasWidth] = useState<number>(0);
  const [canvasHeight, setCanvasHeight] = useState<number>(0);

  const overlayItems = useMemo(
    () =>
      (Object.keys(fieldLabels) as PersonalFieldKey[])
        .filter((fieldKey) => Boolean(filledFields[fieldKey]?.trim()))
        .map((fieldKey) => {
          const position = DEFAULT_FIELD_POSITIONS[fieldKey];

          return {
            fieldKey,
            label: fieldLabels[fieldKey],
            value: filledFields[fieldKey] ?? '',
            left: canvasWidth * position.xRatio,
            top: canvasHeight * position.yRatio,
          };
        }),
    [canvasHeight, canvasWidth, filledFields, fieldLabels]
  );

  const handleCanvasLayout = (event: LayoutChangeEvent) => {
    setCanvasWidth(event.nativeEvent.layout.width);
    setCanvasHeight(event.nativeEvent.layout.height);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.heading}>{t('preview.heading')}</Text>
      <Text style={styles.subHeading}>{t('preview.subHeading')}</Text>

      <View style={styles.previewCard}>
        <Text style={styles.previewTitle}>{t('preview.cardTitle')}</Text>

        {imageUri ? (
          <View style={styles.formCanvas} onLayout={handleCanvasLayout}>
            <Image source={{ uri: imageUri }} style={styles.formImage} resizeMode="contain" />

            {/* Overlay generated output text on top of the scanned form */}
            {overlayItems.map((item) => (
              <View
                key={item.fieldKey}
                style={[
                  styles.overlayTextWrap,
                  {
                    left: item.left,
                    top: item.top,
                  },
                ]}
              >
                <Text style={styles.overlayLabel}>{item.label}</Text>
                <Text style={styles.overlayValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.previewText}>{t('preview.noImage')}</Text>
        )}
      </View>

      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>{t('preview.tipTitle')}</Text>
        <Text style={styles.tipText}>{t('preview.tipText')}</Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>{t('preview.summaryTitle')}</Text>

        {!hasAnyFilledValue ? (
          <Text style={styles.emptyHint}>{t('preview.empty')}</Text>
        ) : null}

        {(Object.keys(fieldLabels) as PersonalFieldKey[]).map((fieldKey) => (
          <View key={fieldKey} style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{fieldLabels[fieldKey]}</Text>
            <Text style={styles.summaryValue}>{filledFields[fieldKey] || t('common.empty')}</Text>
          </View>
        ))}
      </View>

      <Pressable
        style={[
          styles.primaryButton,
          (!imageUri || !hasAnyFilledValue) && styles.primaryButtonDisabled,
        ]}
        disabled={!imageUri || !hasAnyFilledValue}
      >
        <Text style={styles.primaryButtonText}>{t('preview.ready')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 28,
  },
  heading: {
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 6,
    color: '#0F172A',
  },
  subHeading: {
    fontSize: 20,
    lineHeight: 30,
    color: '#334155',
    marginBottom: 14,
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 12,
    minHeight: 190,
  },
  formCanvas: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
  },
  formImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  overlayTextWrap: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: '72%',
  },
  overlayLabel: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '700',
  },
  overlayValue: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '700',
  },
  previewTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    color: '#0F172A',
  },
  previewText: {
    fontSize: 18,
    lineHeight: 28,
    color: '#475569',
  },
  tipCard: {
    backgroundColor: '#ECFEFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#A5F3FC',
    marginBottom: 14,
  },
  tipTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#155E75',
    marginBottom: 6,
  },
  tipText: {
    fontSize: 18,
    lineHeight: 28,
    color: '#0E7490',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 14,
    marginBottom: 14,
  },
  summaryTitle: {
    fontSize: 21,
    fontWeight: '700',
    marginBottom: 8,
    color: '#0F172A',
  },
  emptyHint: {
    fontSize: 17,
    color: '#64748B',
    marginBottom: 8,
  },
  summaryRow: {
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#475569',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0F172A',
  },
  primaryButton: {
    backgroundColor: '#1D4ED8',
    borderRadius: 16,
    paddingVertical: 18,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
});

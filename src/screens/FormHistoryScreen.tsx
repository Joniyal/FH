import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { FormHistoryEntry } from '../types/app';
import { clearFormHistory, deleteFormHistoryEntry, getFormHistory } from '../services/storageService';
import { useLanguage } from '../i18n/LanguageContext';
import Colors from '../theme/colors';
import { Radius, Shadow, Spacing, Typography } from '../theme/tokens';
import { useToast } from '../components/Toast';
import SkeletonItem from '../components/SkeletonLoader';

type Props = NativeStackScreenProps<RootStackParamList, 'FormHistory'>;

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FormHistoryScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [history, setHistory] = useState<FormHistoryEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getFormHistory();
      setHistory(data);
    } catch {
      showToast('Could not load history', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleDelete = async (id: string) => {
    try {
      await deleteFormHistoryEntry(id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
      showToast('Entry removed', 'info');
    } catch {
      showToast('Failed to delete entry', 'error');
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All History',
      'Are you sure you want to delete all saved scan history? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearFormHistory();
            setHistory([]);
            showToast('All history cleared', 'info');
          },
        },
      ]
    );
  };

  const handleSelectEntry = (entry: FormHistoryEntry) => {
    navigation.navigate('FilledFormPreview', {
      imageUri: entry.imageUri,
      filledFields: entry.filledFields,
    });
  };

  return (
    <View style={styles.container}>
      {/* Header bar with clear button */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.heading}>Form History</Text>
          <Text style={styles.subHeading}>Past scans and auto-filled documents</Text>
        </View>
        {history.length > 0 && (
          <Pressable style={styles.clearBtn} onPress={handleClearAll}>
            <Text style={styles.clearBtnText}>Clear All</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <SkeletonItem height={80} borderRadius={Radius.lg} style={{ marginBottom: Spacing.md }} />
          <SkeletonItem height={80} borderRadius={Radius.lg} style={{ marginBottom: Spacing.md }} />
          <SkeletonItem height={80} borderRadius={Radius.lg} style={{ marginBottom: Spacing.md }} />
        </View>
      ) : history.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No Scans Yet</Text>
          <Text style={styles.emptyText}>
            Forms you scan or upload will be stored here automatically for quick re-access.
          </Text>
          <Pressable
            style={styles.scanNowBtn}
            onPress={() => navigation.navigate('ScanForm')}
          >
            <Text style={styles.scanNowBtnText}>📷  Scan New Form</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const filledCount = Object.values(item.filledFields).filter(Boolean).length;
            const isPdf = item.imageUri?.toLowerCase().endsWith('.pdf');
            return (
              <Pressable
                style={styles.historyCard}
                onPress={() => handleSelectEntry(item)}
              >
                <View style={styles.historyCardLeft}>
                  <View style={styles.typeIconBox}>
                    <Text style={styles.typeIcon}>
                      {isPdf ? '📄' : item.formType === 'scan' ? '📷' : '📂'}
                    </Text>
                  </View>
                  <View style={styles.metaBox}>
                    <Text style={styles.historyTitle}>
                      {item.filledFields.name ? `${item.filledFields.name}'s Form` : 'Application Form'}
                    </Text>
                    <Text style={styles.historyDate}>{formatDate(item.timestamp)}</Text>
                    <View style={styles.pillRow}>
                      <View style={styles.badgePill}>
                        <Text style={styles.badgePillText}>{filledCount}/4 fields</Text>
                      </View>
                      {isPdf && (
                        <View style={[styles.badgePill, styles.pdfPill]}>
                          <Text style={styles.pdfPillText}>PDF</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                <Pressable
                  style={styles.deleteBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDelete(item.id);
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.deleteBtnIcon}>🗑️</Text>
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    padding: Spacing.base,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  heading: {
    fontSize: Typography['2xl'],
    fontWeight: Typography.extrabold,
    color: Colors.textPrimary,
  },
  subHeading: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  clearBtn: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  clearBtnText: {
    color: Colors.dangerLight,
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
  },
  loadingContainer: {
    marginTop: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    fontSize: 54,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  emptyText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  scanNowBtn: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primary,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    ...Shadow.glow,
  },
  scanNowBtnText: {
    color: Colors.white,
    fontSize: Typography.base,
    fontWeight: Typography.bold,
  },
  listContent: {
    paddingBottom: Spacing['2xl'],
    gap: Spacing.sm,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  historyCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  typeIconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  typeIcon: {
    fontSize: 22,
  },
  metaBox: {
    flex: 1,
  },
  historyTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  historyDate: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  badgePill: {
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgePillText: {
    fontSize: Typography.xs - 2,
    color: Colors.primaryLight,
    fontWeight: Typography.bold,
  },
  pdfPill: {
    backgroundColor: Colors.dangerBg,
    borderColor: Colors.danger,
  },
  pdfPillText: {
    fontSize: Typography.xs - 2,
    color: Colors.dangerLight,
    fontWeight: Typography.bold,
  },
  deleteBtn: {
    padding: Spacing.sm,
  },
  deleteBtnIcon: {
    fontSize: 18,
  },
});

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Colors from '../theme/colors';
import { Radius, Shadow, Spacing, Typography } from '../theme/tokens';

type NavTab = 'Home' | 'ScanForm' | 'PersonalVault' | 'FormHistory';

type BottomNavBarProps = {
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
};

const TABS: { key: NavTab; icon: string; label: string }[] = [
  { key: 'Home', icon: '🏠', label: 'Home' },
  { key: 'ScanForm', icon: '📷', label: 'Scan' },
  { key: 'PersonalVault', icon: '🔐', label: 'Vault' },
  { key: 'FormHistory', icon: '📋', label: 'History' },
];

export default function BottomNavBar({ activeTab, onNavigate }: BottomNavBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const isCenterScan = tab.key === 'ScanForm';

          if (isCenterScan) {
            return (
              <Pressable
                key={tab.key}
                style={[styles.centerScanBtn, isActive && styles.centerScanBtnActive]}
                onPress={() => onNavigate(tab.key)}
                accessibilityRole="button"
                accessibilityLabel="Scan Form"
              >
                <Text style={styles.centerScanIcon}>📷</Text>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={tab.key}
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
              onPress={() => onNavigate(tab.key)}
              accessibilityRole="button"
            >
              <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>
                {tab.icon}
              </Text>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    backgroundColor: 'transparent',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(17, 24, 39, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: Radius.full,
    paddingVertical: 8,
    paddingHorizontal: Spacing.sm,
    ...Shadow.md,
  },
  tabBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
  },
  tabBtnActive: {
    backgroundColor: 'rgba(232, 145, 58, 0.14)',
  },
  tabIcon: {
    fontSize: 20,
    opacity: 0.7,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: Typography.xs - 1,
    color: Colors.textMuted,
    fontWeight: Typography.medium,
    marginTop: 2,
  },
  tabLabelActive: {
    color: Colors.primaryLight,
    fontWeight: Typography.bold,
  },
  centerScanBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -16,
    ...Shadow.glow,
    borderWidth: 3,
    borderColor: Colors.bgCard,
  },
  centerScanBtnActive: {
    backgroundColor: Colors.primaryLight,
  },
  centerScanIcon: {
    fontSize: 22,
  },
});

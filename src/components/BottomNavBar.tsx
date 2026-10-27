import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../theme/colors';
import { Radius, Shadow, Spacing, Typography } from '../theme/tokens';

type NavTab = 'Home' | 'ScanForm' | 'PersonalVault' | 'FormHistory';

type BottomNavBarProps = {
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
};

const TABS: { key: NavTab; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }[] = [
  { key: 'Home', icon: 'home', label: 'Home' },
  { key: 'ScanForm', icon: 'camera', label: 'Scan' },
  { key: 'PersonalVault', icon: 'shield-lock', label: 'Vault' },
  { key: 'FormHistory', icon: 'clipboard-text-clock', label: 'History' },
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
                style={({ pressed }) => [
                  styles.centerScanBtn,
                  isActive && styles.centerScanBtnActive,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
                ]}
                onPress={() => onNavigate(tab.key)}
                accessibilityRole="button"
                accessibilityLabel="Scan Form"
                accessibilityState={{ selected: isActive }}
              >
                <MaterialCommunityIcons name="camera" size={24} color={Colors.white} />
              </Pressable>
            );
          }

          return (
            <Pressable
              key={tab.key}
              style={({ pressed }) => [
                styles.tabBtn,
                isActive && styles.tabBtnActive,
                pressed && { opacity: 0.75 },
              ]}
              onPress={() => onNavigate(tab.key)}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
            >
              <MaterialCommunityIcons
                name={tab.icon}
                size={22}
                color={isActive ? Colors.primaryLight : Colors.textMuted}
              />
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -20,
    ...Shadow.glow,
    borderWidth: 3,
    borderColor: Colors.bgCard,
  },
  centerScanBtnActive: {
    backgroundColor: Colors.primaryLight,
  },
});

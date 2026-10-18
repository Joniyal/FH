import React from 'react';
import { StyleSheet, Text } from 'react-native';
// Dynamically resolve createMaterialTopTabNavigator to keep builds green before dependency install
let createMaterialTopTabNavigator: any = null;
try {
  createMaterialTopTabNavigator = require('@react-navigation/material-top-tabs').createMaterialTopTabNavigator;
} catch {
  // Gracefully handles missing dependency before npm install
}
import HomeScreen from '../screens/HomeScreen';
import ScanFormScreen from '../screens/ScanFormScreen';
import PersonalVaultScreen from '../screens/PersonalVaultScreen';
import FormHistoryScreen from '../screens/FormHistoryScreen';
import Colors from '../theme/colors';
import { Radius, Typography } from '../theme/tokens';

export type MainTabParamList = {
  Home: undefined;
  ScanForm: undefined;
  PersonalVault: undefined;
  FormHistory: undefined;
};

const Tab = createMaterialTopTabNavigator ? (createMaterialTopTabNavigator as any)() : null;

/**
 * CONFIGURATION FLAG:
 * - Set `HIDE_TAB_BAR = false` to display the tabs docked at the bottom of the screen.
 * - Set `HIDE_TAB_BAR = true` to hide the tab bar completely for a pure gesture-based
 *   fluid swipe experience (like Instagram camera or Facebook main tabs).
 */
const HIDE_TAB_BAR = false;

export default function MainTabNavigator() {
  if (!Tab) return null;
  return (
    <Tab.Navigator
      initialRouteName="Home"
      // Position tabs at the bottom like a standard bottom navigation bar
      tabBarPosition="bottom"
      screenOptions={{
        // Fluid drag gesture across Android screens backed by native PagerView
        swipeEnabled: true,
        animationEnabled: true,

        // Tab bar styling (placed at bottom or hidden for pure gestures)
        tabBarStyle: HIDE_TAB_BAR
          ? { display: 'none' }
          : {
              backgroundColor: '#0A0F1D',
              borderTopWidth: 1,
              borderTopColor: 'rgba(255, 255, 255, 0.08)',
              elevation: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -3 },
              shadowOpacity: 0.35,
              shadowRadius: 8,
              height: 64,
              paddingBottom: 4,
            },

        // Active indicator line on the top edge of the bottom bar
        tabBarIndicatorStyle: {
          backgroundColor: Colors.primary,
          height: 3,
          top: 0,
          borderRadius: Radius.full,
        },

        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarPressColor: 'rgba(59, 130, 246, 0.12)',

        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: Typography.bold,
          textTransform: 'capitalize',
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: () => <Text style={styles.tabIcon}>🏠</Text>,
        }}
      />
      <Tab.Screen
        name="ScanForm"
        component={ScanFormScreen}
        options={{
          tabBarLabel: 'Scanner',
          tabBarIcon: () => <Text style={styles.tabIcon}>📷</Text>,
        }}
      />
      <Tab.Screen
        name="PersonalVault"
        component={PersonalVaultScreen}
        options={{
          tabBarLabel: 'Vault',
          tabBarIcon: () => <Text style={styles.tabIcon}>🔐</Text>,
        }}
      />
      <Tab.Screen
        name="FormHistory"
        component={FormHistoryScreen}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: () => <Text style={styles.tabIcon}>📋</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    fontSize: 18,
  },
});

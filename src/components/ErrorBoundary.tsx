import React, { Component, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../theme/colors';
import { Radius, Spacing, Typography } from '../theme/tokens';

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

/**
 * App-level error boundary. Catches unhandled JS errors and shows a
 * friendly recovery screen instead of a blank white crash.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="alert-circle-outline" size={44} color={Colors.warning} />
            </View>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>
              {this.state.error?.message || 'An unexpected error occurred.'}
            </Text>
            <Pressable style={styles.retryBtn} onPress={this.handleReset}>
              <MaterialCommunityIcons name="refresh" size={20} color={Colors.white} style={{ marginRight: Spacing.xs }} />
              <Text style={styles.retryText}>Try Again</Text>
            </Pressable>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing['2xl'],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    width: '100%',
    maxWidth: 360,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.warningBg,
    borderWidth: 1,
    borderColor: Colors.warning,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Typography['2xl'],
    fontWeight: Typography.extrabold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primary,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing['2xl'],
  },
  retryText: {
    color: Colors.white,
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
  },
});

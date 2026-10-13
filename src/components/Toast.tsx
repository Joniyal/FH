import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Colors from '../theme/colors';
import { Radius, Shadow, Spacing, Typography } from '../theme/tokens';

type ToastType = 'success' | 'error' | 'info' | 'warning';

type ToastContextType = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

export const useToast = () => useContext(ToastContext);

const TOAST_ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠️',
  info: 'ℹ️',
};

const TOAST_COLORS: Record<ToastType, { border: string; bg: string; text: string }> = {
  success: { border: Colors.success, bg: 'rgba(5, 46, 22, 0.95)', text: Colors.successLight },
  error: { border: Colors.danger, bg: 'rgba(76, 5, 25, 0.95)', text: Colors.dangerLight },
  warning: { border: Colors.warning, bg: 'rgba(69, 26, 3, 0.95)', text: Colors.warningLight },
  info: { border: Colors.accent, bg: 'rgba(13, 45, 42, 0.95)', text: Colors.accentLight },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, type });

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, tension: 150, friction: 9, useNativeDriver: true }),
    ]).start();

    timerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 250, useNativeDriver: true }),
      ]).start(() => {
        setToast(null);
      });
    }, 2800);
  }, [opacity, translateY]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Animated.View
          style={[
            styles.toastWrapper,
            {
              opacity,
              transform: [{ translateY }],
            },
          ]}
          pointerEvents="none"
        >
          <View
            style={[
              styles.toastBox,
              {
                borderColor: TOAST_COLORS[toast.type].border,
                backgroundColor: TOAST_COLORS[toast.type].bg,
              },
            ]}
          >
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: TOAST_COLORS[toast.type].border },
              ]}
            >
              <Text style={styles.iconText}>{TOAST_ICONS[toast.type]}</Text>
            </View>
            <Text style={[styles.message, { color: TOAST_COLORS[toast.type].text }]}>
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    top: 54,
    left: 20,
    right: 20,
    zIndex: 9999,
    alignItems: 'center',
  },
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.full,
    borderWidth: 1,
    maxWidth: '100%',
    ...Shadow.md,
  },
  iconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.white,
  },
  message: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    flexShrink: 1,
  },
});

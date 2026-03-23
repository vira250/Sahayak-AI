import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';

type ToastKind = 'success' | 'error' | 'info';
type ToastPosition = 'bottom' | 'center';

interface ToastPayload {
  id: string;
  message: string;
  kind: ToastKind;
  position: ToastPosition;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind, position?: ToastPosition) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const getKindStyles = (kind: ToastKind) => {
  switch (kind) {
    case 'success':
      return { border: '#136A5C', bg: '#E6FFF8', text: '#0F3B34' };
    case 'error':
      return { border: '#B42318', bg: '#FFEDEA', text: '#5F1A14' };
    default:
      return { border: '#1B3A5C', bg: '#ECF4FF', text: '#14304E' };
  }
};

const ToastOverlay: React.FC<{ toast: ToastPayload | null }> = ({ toast }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  React.useEffect(() => {
    if (!toast) return;
    opacity.setValue(0);
    translateY.setValue(10);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [toast, opacity, translateY]);

  if (!toast) return null;

  const theme = getKindStyles(toast.kind);
  const positionStyle = toast.position === 'center' ? styles.centerToast : styles.bottomToast;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Animated.View
        style={[
          styles.toast,
          positionStyle,
          {
            borderColor: theme.border,
            backgroundColor: theme.bg,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <Text style={[styles.toastText, { color: theme.text }]}>{toast.message}</Text>
      </Animated.View>
    </View>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((message: string, kind: ToastKind = 'info', position: ToastPosition = 'bottom') => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setToast({
      id: `toast_${Date.now()}`,
      message,
      kind,
      position,
    });

    timeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 2200);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastOverlay toast={toast} />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    elevation: 999,
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    width: '88%',
    maxWidth: 420,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  bottomToast: {
    bottom: Platform.OS === 'ios' ? 110 : 90,
  },
  centerToast: {
    top: '50%',
    marginTop: -26,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
